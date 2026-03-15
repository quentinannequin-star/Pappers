#!/usr/bin/env python3
"""
Fast Sirene data loader using direct PostgreSQL COPY.
Upserts in chunks to avoid statement timeout.
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
    # Set generous statement timeout (10 min)
    cur = conn.cursor()
    cur.execute("SET statement_timeout = '600s'")
    conn.commit()
    return conn


def clean(val):
    """Clean a value for COPY: replace tabs/newlines with spaces."""
    if not val:
        return "\\N"
    return val.replace("\t", " ").replace("\n", " ").replace("\r", "").replace("\\", "\\\\")


def get_dept_from_commune(code_commune):
    if not code_commune:
        return None
    if code_commune.startswith("97") or code_commune.startswith("98"):
        return code_commune[:3]
    return code_commune[:2]


def load_companies():
    """Load companies: read CSV, deduplicate by siren (keep last), upsert in chunks."""
    print("=" * 60)
    print("LOADING COMPANIES")
    print("=" * 60)

    conn = get_conn()
    cur = conn.cursor()

    total_read = 0
    total_upserted = 0
    start_time = time.time()

    # We'll collect rows, deduplicate by siren (keep latest), and upsert in chunks
    siren_map = {}  # siren -> row data (deduplicates, keeping last seen)

    print("  Phase 1: Reading & deduplicating CSV...")
    with open(COMPANIES_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            total_read += 1
            if total_read % 1_000_000 == 0:
                elapsed = time.time() - start_time
                print(f"    Read {total_read:,} rows, {len(siren_map):,} unique SIRENs ({elapsed:.0f}s)")

            if row.get("statutDiffusionUniteLegale") == "N":
                continue
            # Skip closed companies — useless for M&A screening
            if row.get("etatAdministratifUniteLegale") == "C":
                continue

            siren = row["siren"]
            siren_map[siren] = {
                "siren": siren,
                "denomination": row.get("denominationUniteLegale") or None,
                "sigle": row.get("sigleUniteLegale") or None,
                "naf_code": row.get("activitePrincipaleUniteLegale") or None,
                "forme_juridique": row.get("categorieJuridiqueUniteLegale") or None,
                "date_creation": row.get("dateCreationUniteLegale") or None,
                "tranche_effectif": row.get("trancheEffectifsUniteLegale") or None,
                "categorie_entreprise": row.get("categorieEntreprise") or None,
                "etat_administratif": row.get("etatAdministratifUniteLegale") or "A",
            }

    unique_count = len(siren_map)
    elapsed = time.time() - start_time
    print(f"  Phase 1 done: {total_read:,} rows read, {unique_count:,} unique SIRENs ({elapsed:.0f}s)")

    # Phase 2: Upsert in chunks using temp table
    print(f"\n  Phase 2: INSERT {unique_count:,} companies (skip duplicates)...")

    # Check how many already in DB (for resuming)
    cur.execute("SELECT count(*) FROM companies")
    existing = cur.fetchone()[0]
    if existing > 0:
        print(f"    {existing:,} already in DB — resuming (duplicates will be skipped)")

    all_rows = list(siren_map.values())
    siren_map = None  # Free memory

    # Use temp table + INSERT ... ON CONFLICT DO NOTHING per chunk
    cur.execute("""
        CREATE TEMP TABLE tmp_co (
            siren TEXT, denomination TEXT, sigle TEXT, naf_code TEXT,
            forme_juridique TEXT, date_creation TEXT, tranche_effectif TEXT,
            categorie_entreprise TEXT, etat_administratif TEXT
        )
    """)
    conn.commit()

    for i in range(0, len(all_rows), CHUNK_SIZE):
        chunk = all_rows[i:i + CHUNK_SIZE]

        cur.execute("TRUNCATE tmp_co")
        lines = []
        for row in chunk:
            lines.append("\t".join([
                clean(row["siren"]),
                clean(row["denomination"]),
                clean(row["sigle"]),
                clean(row["naf_code"]),
                clean(row["forme_juridique"]),
                clean(row["date_creation"]),
                clean(row["tranche_effectif"]),
                clean(row["categorie_entreprise"]),
                clean(row["etat_administratif"]),
            ]))
        buf = io.StringIO("\n".join(lines) + "\n")
        cur.copy_from(buf, "tmp_co", sep="\t", null="\\N",
                      columns=["siren", "denomination", "sigle", "naf_code",
                               "forme_juridique", "date_creation", "tranche_effectif",
                               "categorie_entreprise", "etat_administratif"])
        cur.execute("""
            INSERT INTO companies (siren, denomination, sigle, naf_code, forme_juridique,
                                   date_creation, tranche_effectif, categorie_entreprise, etat_administratif)
            SELECT * FROM tmp_co
            ON CONFLICT (siren) DO NOTHING
        """)
        conn.commit()

        total_upserted += len(chunk)
        elapsed = time.time() - start_time
        rate = total_upserted / elapsed if elapsed > 0 else 0
        print(f"    Inserted: {total_upserted:,} / {unique_count:,} ({rate:,.0f} rows/s)")

    cur.execute("DROP TABLE IF EXISTS tmp_co")
    cur.execute("SELECT count(*) FROM companies")
    final_count = cur.fetchone()[0]
    conn.commit()

    elapsed = time.time() - start_time
    print(f"\n  DONE! {final_count:,} total companies in {elapsed:.0f}s")
    conn.close()


def load_etablissements():
    """Load etablissements: TRUNCATE + fast INSERT."""
    print("\n" + "=" * 60)
    print("LOADING ETABLISSEMENTS")
    print("=" * 60)

    conn = get_conn()
    cur = conn.cursor()

    # Check how many already in DB (for resuming)
    cur.execute("SELECT count(*) FROM etablissements")
    existing = cur.fetchone()[0]
    if existing > 0:
        print(f"  {existing:,} already in DB — resuming (duplicates will be skipped)")

    total_inserted = 0
    total_skipped = 0
    start_time = time.time()
    batch = []

    with open(ETAB_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)

        for row in reader:
            if row.get("statutDiffusionEtablissement") == "N":
                total_skipped += 1
                continue
            # Skip closed establishments
            if row.get("etatAdministratifEtablissement") == "F":
                total_skipped += 1
                continue

            code_commune = row.get("codeCommuneEtablissement") or None
            dept = get_dept_from_commune(code_commune)

            batch.append("\t".join([
                clean(row["siret"]),
                clean(row["siren"]),
                clean(row.get("nic") or None),
                clean(row.get("denominationUsuelleEtablissement") or None),
                clean(row.get("enseigne1Etablissement") or None),
                clean(row.get("activitePrincipaleEtablissement") or None),
                "t" if row.get("etablissementSiege") == "true" else "f",
                clean(row.get("numeroVoieEtablissement") or None),
                clean(row.get("typeVoieEtablissement") or None),
                clean(row.get("libelleVoieEtablissement") or None),
                clean(row.get("codePostalEtablissement") or None),
                clean(row.get("libelleCommuneEtablissement") or None),
                clean(code_commune),
                clean(dept),
                clean(row.get("etatAdministratifEtablissement") or "A"),
                clean(row.get("dateCreationEtablissement") or None),
                clean(row.get("trancheEffectifsEtablissement") or None),
            ]))

            if len(batch) >= CHUNK_SIZE:
                inserted = insert_etab_batch(cur, conn, batch)
                total_inserted += inserted
                elapsed = time.time() - start_time
                rate = total_inserted / elapsed if elapsed > 0 else 0
                print(f"  Etablissements: {total_inserted:,} inserted ({rate:,.0f} rows/s)")
                batch = []

        if batch:
            inserted = insert_etab_batch(cur, conn, batch)
            total_inserted += inserted

    cur.execute("SELECT count(*) FROM etablissements")
    final_count = cur.fetchone()[0]

    elapsed = time.time() - start_time
    print(f"\n  DONE! {final_count:,} total etablissements in {elapsed:.0f}s")
    print(f"  Skipped {total_skipped:,} non-diffusible/closed")
    conn.close()


def insert_etab_batch(cur, conn, lines):
    """COPY into temp table, then INSERT ... ON CONFLICT DO NOTHING."""
    try:
        cur.execute("TRUNCATE tmp_etab")
    except Exception:
        conn.rollback()
        cur.execute("""
            CREATE TEMP TABLE tmp_etab (
                siret TEXT, siren TEXT, nic TEXT, denomination_usuelle TEXT,
                enseigne TEXT, naf_code TEXT, est_siege TEXT,
                numero_voie TEXT, type_voie TEXT, libelle_voie TEXT,
                code_postal TEXT, commune TEXT, code_commune TEXT,
                departement TEXT, etat_administratif TEXT, date_creation TEXT,
                tranche_effectif TEXT
            )
        """)
        conn.commit()

    buf = io.StringIO("\n".join(lines) + "\n")
    cur.copy_from(buf, "tmp_etab", sep="\t", null="\\N",
                  columns=["siret", "siren", "nic", "denomination_usuelle", "enseigne",
                           "naf_code", "est_siege", "numero_voie", "type_voie",
                           "libelle_voie", "code_postal", "commune", "code_commune",
                           "departement", "etat_administratif", "date_creation",
                           "tranche_effectif"])
    cur.execute("""
        INSERT INTO etablissements (siret, siren, nic, denomination_usuelle, enseigne,
                                     naf_code, est_siege, numero_voie, type_voie,
                                     libelle_voie, code_postal, commune, code_commune,
                                     departement, etat_administratif, date_creation,
                                     tranche_effectif)
        SELECT siret, siren, nic, denomination_usuelle, enseigne,
               naf_code, est_siege::boolean, numero_voie, type_voie,
               libelle_voie, code_postal, commune, code_commune,
               departement, etat_administratif, date_creation,
               tranche_effectif
        FROM tmp_etab
        ON CONFLICT (siret) DO NOTHING
    """)
    conn.commit()
    return len(lines)


if __name__ == "__main__":
    print("Sirene Data Loader (Direct PostgreSQL)")
    print(f"DB: {DB_URL.split('@')[1]}")
    print()

    if "--etab-only" in sys.argv:
        load_etablissements()
    elif "--companies-only" in sys.argv:
        load_companies()
    else:
        load_companies()
        load_etablissements()

    print("\nAll done!")
