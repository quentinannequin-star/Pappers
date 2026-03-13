"""
Load Sirene CSV files into Supabase via REST API (no direct PostgreSQL needed).
Works on IPv4-only networks where direct DB connection fails.

Run: python scripts/load_sirene_rest.py

Requires env vars in ../.env.local:
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
"""

import os
import sys
import csv
import time
import json
import requests
import pandas as pd

# Load from .env.local
ENV_PATH = os.path.join(os.path.dirname(__file__), "..", ".env.local")
env = {}
if os.path.exists(ENV_PATH):
    with open(ENV_PATH) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()

SUPABASE_URL = env.get("NEXT_PUBLIC_SUPABASE_URL", "")
SERVICE_KEY = env.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SERVICE_KEY:
    print("ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
    sys.exit(1)

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
CHUNK_SIZE = 50_000  # rows per pandas chunk
BATCH_SIZE = 500     # rows per API call
API_URL = f"{SUPABASE_URL}/rest/v1"
HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=ignore-duplicates",
}


def clean(val):
    """Return None for NaN/empty values."""
    if val is None:
        return None
    s = str(val).strip()
    if s in ("", "nan", "NaN", "None", "NaT"):
        return None
    return s


def upsert_batch(table: str, rows: list, retries=3):
    """POST a batch of rows to Supabase REST API."""
    url = f"{API_URL}/{table}"
    for attempt in range(retries):
        try:
            resp = requests.post(url, headers=HEADERS, json=rows, timeout=60)
            if resp.status_code in (200, 201):
                return True
            elif resp.status_code == 409:
                # Conflict = duplicates, that's fine
                return True
            elif resp.status_code == 429:
                # Rate limited
                time.sleep(2 ** attempt)
                continue
            else:
                print(f"  WARN: {resp.status_code} - {resp.text[:200]}")
                if attempt < retries - 1:
                    time.sleep(1)
                    continue
                return False
        except requests.exceptions.RequestException as e:
            print(f"  WARN: Request error: {e}")
            if attempt < retries - 1:
                time.sleep(2)
                continue
            return False
    return False


def load_companies():
    """Load StockUniteLegale CSV → companies table via REST."""
    csv_path = os.path.join(DATA_DIR, "StockUniteLegale_utf8.csv")
    if not os.path.exists(csv_path):
        print(f"ERROR: {csv_path} not found")
        return

    print(f"\nLoading companies from {os.path.basename(csv_path)}...")
    total_inserted = 0
    total_skipped = 0
    start = time.time()
    chunk_num = 0

    for chunk in pd.read_csv(csv_path, chunksize=CHUNK_SIZE, dtype=str, low_memory=False):
        chunk_num += 1

        # Filter: active only
        chunk = chunk[chunk["etatAdministratifUniteLegale"] == "A"]

        # Filter: exclude personnes physiques
        if "categorieJuridiqueUniteLegale" in chunk.columns:
            chunk = chunk[~chunk["categorieJuridiqueUniteLegale"].str.startswith("1", na=False)]

        if len(chunk) == 0:
            continue

        # Build rows
        rows = []
        for _, row in chunk.iterrows():
            siren = clean(row.get("siren"))
            if not siren:
                continue
            rows.append({
                "siren": siren,
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
            ok = upsert_batch("companies", batch)
            if ok:
                total_inserted += len(batch)
            else:
                total_skipped += len(batch)

        elapsed = time.time() - start
        rate = total_inserted / elapsed if elapsed > 0 else 0
        print(f"  Chunk {chunk_num}: {total_inserted:,} inserted, {rate:.0f} rows/s", end="\r")

    elapsed = time.time() - start
    print(f"\n  → {total_inserted:,} companies loaded in {elapsed:.0f}s ({total_skipped} skipped)")


def load_etablissements():
    """Load StockEtablissement CSV → etablissements table via REST."""
    csv_path = os.path.join(DATA_DIR, "StockEtablissement_utf8.csv")
    if not os.path.exists(csv_path):
        print(f"ERROR: {csv_path} not found")
        return

    print(f"\nLoading établissements from {os.path.basename(csv_path)}...")
    total_inserted = 0
    total_skipped = 0
    start = time.time()
    chunk_num = 0

    for chunk in pd.read_csv(csv_path, chunksize=CHUNK_SIZE, dtype=str, low_memory=False):
        chunk_num += 1

        # Filter: active only
        chunk = chunk[chunk["etatAdministratifEtablissement"] == "A"]

        if len(chunk) == 0:
            continue

        rows = []
        for _, row in chunk.iterrows():
            siren = clean(row.get("siren"))
            nic = clean(row.get("nic"))
            if not siren or not nic:
                continue

            siret = siren + nic

            # Derive département
            code_commune = clean(row.get("codeCommuneEtablissement")) or ""
            if code_commune.startswith(("971", "972", "973", "974", "976")):
                departement = code_commune[:3]
            elif len(code_commune) >= 2:
                departement = code_commune[:2]
            else:
                departement = None

            est_siege = str(row.get("etablissementSiege", "")).lower() == "true"

            rows.append({
                "siret": siret,
                "siren": siren,
                "nic": nic,
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

        # Send in batches
        for i in range(0, len(rows), BATCH_SIZE):
            batch = rows[i:i + BATCH_SIZE]
            ok = upsert_batch("etablissements", batch)
            if ok:
                total_inserted += len(batch)
            else:
                total_skipped += len(batch)

        elapsed = time.time() - start
        rate = total_inserted / elapsed if elapsed > 0 else 0
        print(f"  Chunk {chunk_num}: {total_inserted:,} inserted, {rate:.0f} rows/s", end="\r")

    elapsed = time.time() - start
    print(f"\n  → {total_inserted:,} établissements loaded in {elapsed:.0f}s ({total_skipped} skipped)")


def main():
    print("=" * 60)
    print("ALVORA DB — Sirene Data Loader (REST API)")
    print("=" * 60)
    print(f"Supabase URL: {SUPABASE_URL}")
    print(f"Data dir: {DATA_DIR}")

    # Quick connectivity test
    print("\nTesting connection...")
    resp = requests.get(
        f"{API_URL}/companies?select=siren&limit=1",
        headers=HEADERS, timeout=10
    )
    if resp.status_code == 200:
        print("✓ Connected to Supabase REST API")
    else:
        print(f"ERROR: API returned {resp.status_code}: {resp.text[:200]}")
        sys.exit(1)

    load_companies()
    load_etablissements()

    print("\n✅ All done!")


if __name__ == "__main__":
    main()
