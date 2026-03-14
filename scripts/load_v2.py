#!/usr/bin/env python3
"""
Sirene Data Loader v2 — Optimized for Supabase Nano compute.

Strategy:
1. DROP all indexes (except PK)
2. TRUNCATE companies
3. COPY companies from CSV (active only, deduplicated)
4. UPDATE companies with siege address from etablissements CSV
5. REBUILD indexes in bulk

Usage:
  python3 -u scripts/load_v2.py                # Full load
  python3 -u scripts/load_v2.py --siege-only   # Only enrich with siege addresses
"""
import psycopg2
import csv
import io
import time
import sys
import os

DB_URL = "postgresql://postgres:Bienvenuscopenbar1@db.uhpypnptmdbepwhqkmyb.supabase.co:5432/postgres"
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
COMPANIES_CSV = os.path.join(DATA_DIR, "StockUniteLegale_utf8.csv")
ETAB_CSV = os.path.join(DATA_DIR, "StockEtablissement_utf8.csv")
CHUNK_SIZE = 50_000


def get_conn():
    conn = psycopg2.connect(DB_URL, connect_timeout=30)
    cur = conn.cursor()
    cur.execute("SET statement_timeout = '0'")  # No timeout for bulk ops
    conn.commit()
    return conn


def clean(val):
    if not val:
        return "\\N"
    return val.replace("\t", " ").replace("\n", " ").replace("\r", "").replace("\\", "\\\\")


def get_dept_from_commune(code_commune):
    if not code_commune:
        return None
    if code_commune.startswith("97") or code_commune.startswith("98"):
        return code_commune[:3]
    return code_commune[:2]


def build_adresse(numero, type_voie, libelle):
    parts = []
    if numero:
        parts.append(numero)
    if type_voie:
        parts.append(type_voie)
    if libelle:
        parts.append(libelle)
    return " ".join(parts) if parts else None


# ============================================================
# STEP 1: Drop indexes
# ============================================================
def drop_indexes(cur, conn):
    print("  Dropping indexes...")
    cur.execute("""
        DROP INDEX IF EXISTS idx_companies_naf;
        DROP INDEX IF EXISTS idx_companies_etat;
        DROP INDEX IF EXISTS idx_companies_effectif;
        DROP INDEX IF EXISTS idx_companies_categorie;
        DROP INDEX IF EXISTS idx_companies_dept;
        DROP INDEX IF EXISTS idx_companies_denomination;
        DROP INDEX IF EXISTS idx_companies_denomination_trgm;
    """)
    conn.commit()
    print("  Indexes dropped.")


# ============================================================
# STEP 2: Load companies (TRUNCATE + raw COPY, no ON CONFLICT)
# ============================================================
def load_companies(cur, conn):
    print("\n" + "=" * 60)
    print("LOADING COMPANIES")
    print("=" * 60)

    # Phase 1: Read CSV, deduplicate, filter active only
    print("  Phase 1: Reading CSV & deduplicating...")
    start_time = time.time()
    total_read = 0
    siren_map = {}

    with open(COMPANIES_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            total_read += 1
            if total_read % 2_000_000 == 0:
                elapsed = time.time() - start_time
                print(f"    Read {total_read:,} rows, {len(siren_map):,} unique ({elapsed:.0f}s)", flush=True)

            if row.get("statutDiffusionUniteLegale") == "N":
                continue
            if row.get("etatAdministratifUniteLegale") == "C":
                continue

            siren = row["siren"]
            siren_map[siren] = (
                siren,
                row.get("denominationUniteLegale") or None,
                row.get("sigleUniteLegale") or None,
                row.get("activitePrincipaleUniteLegale") or None,
                row.get("categorieJuridiqueUniteLegale") or None,
                row.get("dateCreationUniteLegale") or None,
                row.get("trancheEffectifsUniteLegale") or None,
                row.get("categorieEntreprise") or None,
                "A",
            )

    unique_count = len(siren_map)
    elapsed = time.time() - start_time
    print(f"  Phase 1 done: {total_read:,} rows → {unique_count:,} active companies ({elapsed:.0f}s)", flush=True)

    # Phase 2: TRUNCATE + raw COPY (no index overhead)
    print(f"\n  Phase 2: TRUNCATE + COPY {unique_count:,} companies...")
    cur.execute("TRUNCATE companies CASCADE")
    conn.commit()
    print("    Table truncated.", flush=True)

    # Add siege columns if they don't exist
    for col in ["siege_code_postal", "siege_ville", "siege_departement", "siege_adresse"]:
        try:
            cur.execute(f"ALTER TABLE companies ADD COLUMN IF NOT EXISTS {col} TEXT")
            conn.commit()
        except Exception:
            conn.rollback()

    all_rows = list(siren_map.values())
    siren_map = None  # Free memory
    total_copied = 0

    for i in range(0, len(all_rows), CHUNK_SIZE):
        chunk = all_rows[i:i + CHUNK_SIZE]
        lines = []
        for row in chunk:
            lines.append("\t".join(clean(v) for v in row))
        buf = io.StringIO("\n".join(lines) + "\n")
        cur.copy_from(buf, "companies", sep="\t", null="\\N",
                      columns=["siren", "denomination", "sigle", "naf_code",
                               "forme_juridique", "date_creation", "tranche_effectif",
                               "categorie_entreprise", "etat_administratif"])
        conn.commit()
        total_copied += len(chunk)
        elapsed = time.time() - start_time
        rate = total_copied / elapsed if elapsed > 0 else 0
        print(f"    COPY: {total_copied:,} / {unique_count:,} ({rate:,.0f} rows/s)", flush=True)

    all_rows = None
    elapsed = time.time() - start_time
    print(f"\n  Companies loaded: {total_copied:,} in {elapsed:.0f}s", flush=True)


# ============================================================
# STEP 3: Enrich with siege addresses from etablissements CSV
# ============================================================
def enrich_siege(cur, conn):
    print("\n" + "=" * 60)
    print("ENRICHING WITH SIEGE ADDRESSES")
    print("=" * 60)

    start_time = time.time()
    total_read = 0
    total_sieges = 0
    total_updated = 0
    batch = []

    # Create temp table for siege data
    cur.execute("""
        CREATE TEMP TABLE tmp_siege (
            siren TEXT,
            code_postal TEXT,
            ville TEXT,
            departement TEXT,
            adresse TEXT
        )
    """)
    conn.commit()

    print("  Reading etablissements CSV (sieges only)...", flush=True)

    with open(ETAB_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            total_read += 1
            if total_read % 5_000_000 == 0:
                elapsed = time.time() - start_time
                print(f"    Read {total_read:,} rows, {total_sieges:,} sieges ({elapsed:.0f}s)", flush=True)

            # Only keep: siege + diffusible
            if row.get("etablissementSiege") != "true":
                continue
            if row.get("statutDiffusionEtablissement") == "N":
                continue

            total_sieges += 1
            code_commune = row.get("codeCommuneEtablissement") or None
            dept = get_dept_from_commune(code_commune)
            adresse = build_adresse(
                row.get("numeroVoieEtablissement"),
                row.get("typeVoieEtablissement"),
                row.get("libelleVoieEtablissement"),
            )

            batch.append("\t".join([
                clean(row["siren"]),
                clean(row.get("codePostalEtablissement")),
                clean(row.get("libelleCommuneEtablissement")),
                clean(dept),
                clean(adresse),
            ]))

            if len(batch) >= CHUNK_SIZE:
                _flush_siege_batch(cur, conn, batch)
                total_updated += len(batch)
                elapsed = time.time() - start_time
                rate = total_updated / elapsed if elapsed > 0 else 0
                print(f"    Updated: {total_updated:,} sieges ({rate:,.0f} rows/s)", flush=True)
                batch = []

    if batch:
        _flush_siege_batch(cur, conn, batch)
        total_updated += len(batch)

    cur.execute("DROP TABLE IF EXISTS tmp_siege")
    conn.commit()

    elapsed = time.time() - start_time
    print(f"\n  Siege enrichment done: {total_updated:,} updates from {total_sieges:,} sieges ({elapsed:.0f}s)", flush=True)


def _flush_siege_batch(cur, conn, batch):
    cur.execute("TRUNCATE tmp_siege")
    buf = io.StringIO("\n".join(batch) + "\n")
    cur.copy_from(buf, "tmp_siege", sep="\t", null="\\N",
                  columns=["siren", "code_postal", "ville", "departement", "adresse"])
    cur.execute("""
        UPDATE companies c
        SET siege_code_postal = s.code_postal,
            siege_ville = s.ville,
            siege_departement = s.departement,
            siege_adresse = s.adresse
        FROM tmp_siege s
        WHERE c.siren = s.siren
    """)
    conn.commit()


# ============================================================
# STEP 4: Rebuild indexes
# ============================================================
def rebuild_indexes(cur, conn):
    print("\n" + "=" * 60)
    print("REBUILDING INDEXES")
    print("=" * 60)
    start_time = time.time()

    indexes = [
        ("idx_companies_naf", "CREATE INDEX idx_companies_naf ON companies(naf_code)"),
        ("idx_companies_etat", "CREATE INDEX idx_companies_etat ON companies(etat_administratif)"),
        ("idx_companies_effectif", "CREATE INDEX idx_companies_effectif ON companies(tranche_effectif)"),
        ("idx_companies_categorie", "CREATE INDEX idx_companies_categorie ON companies(categorie_entreprise)"),
        ("idx_companies_dept", "CREATE INDEX idx_companies_dept ON companies(siege_departement)"),
        ("idx_companies_denomination_trgm", "CREATE INDEX idx_companies_denomination_trgm ON companies USING gin(denomination gin_trgm_ops)"),
    ]

    for name, sql in indexes:
        t = time.time()
        cur.execute(f"DROP INDEX IF EXISTS {name}")
        cur.execute(sql)
        conn.commit()
        print(f"  {name}: {time.time() - t:.1f}s", flush=True)

    elapsed = time.time() - start_time
    print(f"\n  All indexes rebuilt in {elapsed:.0f}s", flush=True)


# ============================================================
# MAIN
# ============================================================
if __name__ == "__main__":
    print("=" * 60)
    print("SIRENE DATA LOADER v2 (Optimized)")
    print(f"DB: {DB_URL.split('@')[1]}")
    print("=" * 60)

    conn = get_conn()
    cur = conn.cursor()

    if "--siege-only" in sys.argv:
        enrich_siege(cur, conn)
        rebuild_indexes(cur, conn)
    else:
        drop_indexes(cur, conn)
        load_companies(cur, conn)
        enrich_siege(cur, conn)
        rebuild_indexes(cur, conn)

    # Final stats
    cur.execute("SELECT count(*) FROM companies")
    total = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM companies WHERE siege_ville IS NOT NULL")
    with_siege = cur.fetchone()[0]
    print(f"\nFINAL: {total:,} companies, {with_siege:,} with siege address")

    conn.close()
    print("All done!")
