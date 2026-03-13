"""
Parse Sirene CSV files and load into Supabase PostgreSQL.
Run: python scripts/load_sirene.py

Requires: SUPABASE_DB_URL environment variable (direct PostgreSQL connection string).
Get it from Supabase > Settings > Database > Connection string (URI).

Example: postgresql://postgres.[ref]:[password]@aws-0-eu-west-3.pooler.supabase.com:6543/postgres
"""

import os
import sys
import csv
import io
import time
import psycopg2
import pandas as pd
from tqdm import tqdm

DB_URL = os.environ.get("SUPABASE_DB_URL")
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
CHUNK_SIZE = 100_000


def get_connection():
    if not DB_URL:
        print("ERROR: Set SUPABASE_DB_URL environment variable")
        print("Get it from Supabase > Settings > Database > Connection string (URI)")
        print("Example: postgresql://postgres.[ref]:[password]@aws-0-eu-west-3.pooler.supabase.com:6543/postgres")
        sys.exit(1)
    return psycopg2.connect(DB_URL)


def find_csv(prefix: str) -> str:
    """Find the CSV file starting with given prefix in data/raw/."""
    for f in os.listdir(DATA_DIR):
        if f.startswith(prefix) and f.endswith(".csv"):
            return os.path.join(DATA_DIR, f)
    raise FileNotFoundError(f"No CSV found matching {prefix}* in {DATA_DIR}")


def load_companies(conn):
    """Load StockUniteLegale CSV → companies table."""
    csv_path = find_csv("StockUniteLegale")
    print(f"\nLoading companies from {os.path.basename(csv_path)}...")

    cur = conn.cursor()
    total_inserted = 0
    start = time.time()

    for chunk in tqdm(
        pd.read_csv(csv_path, chunksize=CHUNK_SIZE, dtype=str, low_memory=False),
        desc="Companies",
    ):
        # Filter: active only
        chunk = chunk[chunk["etatAdministratifUniteLegale"] == "A"]

        # Filter: exclude personnes physiques (catégorie juridique starting with "1")
        if "categorieJuridiqueUniteLegale" in chunk.columns:
            chunk = chunk[~chunk["categorieJuridiqueUniteLegale"].str.startswith("1", na=False)]

        if len(chunk) == 0:
            continue

        # Prepare data
        rows = []
        for _, row in chunk.iterrows():
            rows.append((
                row.get("siren", ""),
                row.get("denominationUniteLegale"),
                row.get("sigleUniteLegale"),
                row.get("activitePrincipaleUniteLegale"),
                row.get("categorieJuridiqueUniteLegale"),
                row.get("dateCreationUniteLegale"),
                row.get("trancheEffectifsUniteLegale"),
                row.get("categorieEntreprise"),
                "A",
            ))

        # Use COPY for fast insert
        buf = io.StringIO()
        for r in rows:
            line = "\t".join(
                v if v and str(v) != "nan" else "\\N" for v in r
            )
            buf.write(line + "\n")
        buf.seek(0)

        try:
            cur.copy_from(
                buf,
                "companies",
                columns=(
                    "siren", "denomination", "sigle", "naf_code",
                    "forme_juridique", "date_creation", "tranche_effectif",
                    "categorie_entreprise", "etat_administratif",
                ),
                null="\\N",
            )
            conn.commit()
            total_inserted += len(rows)
        except Exception as e:
            conn.rollback()
            # On conflict, fall back to INSERT ... ON CONFLICT
            for r in rows:
                try:
                    cur.execute("""
                        INSERT INTO companies (siren, denomination, sigle, naf_code,
                            forme_juridique, date_creation, tranche_effectif,
                            categorie_entreprise, etat_administratif)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (siren) DO NOTHING
                    """, tuple(None if str(v) == "nan" else v for v in r))
                except Exception:
                    conn.rollback()
                    continue
            conn.commit()
            total_inserted += len(rows)

    elapsed = time.time() - start
    print(f"  → {total_inserted:,} companies loaded in {elapsed:.0f}s")
    cur.close()


def load_etablissements(conn):
    """Load StockEtablissement CSV → etablissements table."""
    csv_path = find_csv("StockEtablissement")
    print(f"\nLoading établissements from {os.path.basename(csv_path)}...")

    cur = conn.cursor()
    total_inserted = 0
    start = time.time()

    for chunk in tqdm(
        pd.read_csv(csv_path, chunksize=CHUNK_SIZE, dtype=str, low_memory=False),
        desc="Établissements",
    ):
        # Filter: active only
        chunk = chunk[chunk["etatAdministratifEtablissement"] == "A"]

        if len(chunk) == 0:
            continue

        rows = []
        for _, row in chunk.iterrows():
            siren = str(row.get("siren", ""))
            nic = str(row.get("nic", ""))
            siret = siren + nic if siren and nic else ""

            # Derive département from codeCommuneEtablissement
            code_commune = str(row.get("codeCommuneEtablissement", ""))
            if code_commune.startswith(("971", "972", "973", "974", "976")):
                departement = code_commune[:3]
            elif len(code_commune) >= 2:
                departement = code_commune[:2]
            else:
                departement = None

            est_siege = str(row.get("etablissementSiege", "")).lower() == "true"

            rows.append((
                siret,
                siren,
                nic,
                row.get("denominationUsuelleEtablissement"),
                row.get("enseigne1Etablissement"),
                row.get("activitePrincipaleEtablissement"),
                est_siege,
                row.get("numeroVoieEtablissement"),
                row.get("typeVoieEtablissement"),
                row.get("libelleVoieEtablissement"),
                row.get("codePostalEtablissement"),
                row.get("libelleCommuneEtablissement"),
                code_commune if code_commune else None,
                departement,
                "A",
                row.get("dateCreationEtablissement"),
                row.get("trancheEffectifsEtablissement"),
            ))

        # Use COPY
        buf = io.StringIO()
        for r in rows:
            values = []
            for v in r:
                if v is None or (isinstance(v, str) and v == "nan") or (isinstance(v, float)):
                    values.append("\\N")
                elif isinstance(v, bool):
                    values.append("t" if v else "f")
                else:
                    s = str(v)
                    if s == "nan":
                        values.append("\\N")
                    else:
                        values.append(s)
            buf.write("\t".join(values) + "\n")
        buf.seek(0)

        try:
            cur.copy_from(
                buf,
                "etablissements",
                columns=(
                    "siret", "siren", "nic", "denomination_usuelle", "enseigne",
                    "naf_code", "est_siege", "numero_voie", "type_voie",
                    "libelle_voie", "code_postal", "commune", "code_commune",
                    "departement", "etat_administratif", "date_creation",
                    "tranche_effectif",
                ),
                null="\\N",
            )
            conn.commit()
            total_inserted += len(rows)
        except Exception as e:
            conn.rollback()
            # Fallback to individual inserts
            for r in rows:
                try:
                    cur.execute("""
                        INSERT INTO etablissements (siret, siren, nic, denomination_usuelle,
                            enseigne, naf_code, est_siege, numero_voie, type_voie,
                            libelle_voie, code_postal, commune, code_commune,
                            departement, etat_administratif, date_creation, tranche_effectif)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        ON CONFLICT (siret) DO NOTHING
                    """, tuple(None if str(v) == "nan" else v for v in r))
                except Exception:
                    conn.rollback()
                    continue
            conn.commit()
            total_inserted += len(rows)

    elapsed = time.time() - start
    print(f"  → {total_inserted:,} établissements loaded in {elapsed:.0f}s")
    cur.close()


def main():
    print("=" * 60)
    print("ALVORA DB — Sirene Data Loader")
    print("=" * 60)

    conn = get_connection()
    print("✓ Connected to Supabase PostgreSQL")

    load_companies(conn)
    load_etablissements(conn)

    conn.close()
    print("\n✅ All done!")


if __name__ == "__main__":
    main()
