"""
Load Sirene CSV files into Supabase via REST API (no direct PostgreSQL needed).
Run: python scripts/load_sirene_api.py

Uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.
"""

import os
import sys
import time
import requests
import pandas as pd
from tqdm import tqdm

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://uhpypnptmdbepwhqkmyb.supabase.co")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
BATCH_SIZE = 500  # Supabase REST API batch limit
CHUNK_SIZE = 50_000  # pandas read chunk


def headers():
    return {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=ignore-duplicates",
    }


def find_csv(prefix: str) -> str:
    for f in os.listdir(DATA_DIR):
        if f.startswith(prefix) and f.endswith(".csv"):
            return os.path.join(DATA_DIR, f)
    raise FileNotFoundError(f"No CSV found matching {prefix}* in {DATA_DIR}")


def upsert_batch(table: str, rows: list[dict]) -> int:
    """Insert batch via Supabase REST API. Returns count inserted."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    resp = requests.post(url, json=rows, headers=headers())
    if resp.status_code in (200, 201):
        return len(rows)
    elif resp.status_code == 409:
        # Duplicates ignored
        return len(rows)
    else:
        print(f"  ERROR {resp.status_code}: {resp.text[:200]}")
        return 0


def clean(val):
    """Convert pandas NaN/nan to None."""
    if pd.isna(val):
        return None
    s = str(val)
    if s == "nan":
        return None
    return s


def load_companies():
    csv_path = find_csv("StockUniteLegale")
    print(f"\nLoading companies from {os.path.basename(csv_path)}...")

    total = 0
    start = time.time()

    for chunk in tqdm(
        pd.read_csv(csv_path, chunksize=CHUNK_SIZE, dtype=str, low_memory=False),
        desc="Companies",
    ):
        # Filter: active only
        chunk = chunk[chunk["etatAdministratifUniteLegale"] == "A"]

        # Filter: exclude personnes physiques
        if "categorieJuridiqueUniteLegale" in chunk.columns:
            chunk = chunk[~chunk["categorieJuridiqueUniteLegale"].str.startswith("1", na=False)]

        if len(chunk) == 0:
            continue

        rows = []
        for _, row in chunk.iterrows():
            rows.append({
                "siren": clean(row.get("siren")),
                "denomination": clean(row.get("denominationUniteLegale")),
                "sigle": clean(row.get("sigleUniteLegale")),
                "naf_code": clean(row.get("activitePrincipaleUniteLegale")),
                "forme_juridique": clean(row.get("categorieJuridiqueUniteLegale")),
                "date_creation": clean(row.get("dateCreationUniteLegale")),
                "tranche_effectif": clean(row.get("trancheEffectifsUniteLegale")),
                "categorie_entreprise": clean(row.get("categorieEntreprise")),
                "etat_administratif": "A",
            })

        # Send in batches
        for i in range(0, len(rows), BATCH_SIZE):
            batch = rows[i:i + BATCH_SIZE]
            total += upsert_batch("companies", batch)

    elapsed = time.time() - start
    print(f"  → {total:,} companies loaded in {elapsed:.0f}s")


def load_etablissements():
    csv_path = find_csv("StockEtablissement")
    print(f"\nLoading établissements from {os.path.basename(csv_path)}...")

    total = 0
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
            siren = clean(row.get("siren")) or ""
            nic = clean(row.get("nic")) or ""
            siret = siren + nic if siren and nic else ""

            code_commune = clean(row.get("codeCommuneEtablissement")) or ""
            if code_commune.startswith(("971", "972", "973", "974", "976")):
                departement = code_commune[:3]
            elif len(code_commune) >= 2:
                departement = code_commune[:2]
            else:
                departement = None

            est_siege = str(row.get("etablissementSiege", "")).lower() == "true"

            rows.append({
                "siret": siret if siret else None,
                "siren": siren if siren else None,
                "nic": nic if nic else None,
                "denomination_usuelle": clean(row.get("denominationUsuelleEtablissement")),
                "enseigne": clean(row.get("enseigne1Etablissement")),
                "naf_code": clean(row.get("activitePrincipaleEtablissement")),
                "est_siege": est_siege,
                "numero_voie": clean(row.get("numeroVoieEtablissement")),
                "type_voie": clean(row.get("typeVoieEtablissement")),
                "libelle_voie": clean(row.get("libelleVoieEtablissement")),
                "code_postal": clean(row.get("codePostalEtablissement")),
                "commune": clean(row.get("libelleCommuneEtablissement")),
                "code_commune": code_commune if code_commune else None,
                "departement": departement,
                "etat_administratif": "A",
                "date_creation": clean(row.get("dateCreationEtablissement")),
                "tranche_effectif": clean(row.get("trancheEffectifsEtablissement")),
            })

        for i in range(0, len(rows), BATCH_SIZE):
            batch = rows[i:i + BATCH_SIZE]
            total += upsert_batch("etablissements", batch)

    elapsed = time.time() - start
    print(f"  → {total:,} établissements loaded in {elapsed:.0f}s")


def main():
    if not SERVICE_KEY:
        print("ERROR: Set SUPABASE_SERVICE_ROLE_KEY environment variable")
        sys.exit(1)

    print("=" * 60)
    print("ALVORA DB — Sirene Data Loader (REST API)")
    print("=" * 60)

    # Quick connectivity test
    url = f"{SUPABASE_URL}/rest/v1/companies?select=siren&limit=1"
    resp = requests.get(url, headers=headers())
    if resp.status_code != 200:
        print(f"ERROR: Cannot connect to Supabase API: {resp.status_code} {resp.text}")
        sys.exit(1)
    print("✓ Connected to Supabase REST API")

    load_companies()
    load_etablissements()

    print("\n✅ All done!")


if __name__ == "__main__":
    main()
