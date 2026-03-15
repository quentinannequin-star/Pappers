#!/usr/bin/env python3
"""
Sirene data loader via Supabase REST API.
Works on any network (HTTPS port 443).
Resumable — uses ON CONFLICT DO NOTHING (resolution=ignore-duplicates).
"""
import csv
import json
import time
import sys
import os
import requests

SUPABASE_URL = "https://uhpypnptmdbepwhqkmyb.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVocHlwbnB0bWRiZXB3aHFrbXliIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzM2MTMwOCwiZXhwIjoyMDg4OTM3MzA4fQ.X9tN4coCeWksNwj4jGhAB-fwtItdYyAG6N2JYwJLVic"

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
COMPANIES_CSV = os.path.join(DATA_DIR, "StockUniteLegale_utf8.csv")
ETAB_CSV = os.path.join(DATA_DIR, "StockEtablissement_utf8.csv")

BATCH_SIZE = 500
HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=ignore-duplicates"
}


def post_batch(table, rows):
    """POST a batch to Supabase REST API. Returns True on success."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    for attempt in range(5):
        try:
            r = requests.post(url, headers=HEADERS, json=rows, timeout=30)
            if r.status_code in (200, 201):
                return True
            if r.status_code == 409:  # Conflict — already exists, that's fine
                return True
            print(f"  WARN: {r.status_code} - {r.text[:200]}", flush=True)
            if r.status_code >= 500:
                time.sleep(2 ** attempt)
                continue
            return True  # 4xx other than 409 — skip batch
        except requests.exceptions.RequestException as e:
            print(f"  WARN: {e}", flush=True)
            time.sleep(2 ** attempt)
    return False


def get_dept_from_commune(code_commune):
    if not code_commune:
        return None
    if code_commune.startswith("97") or code_commune.startswith("98"):
        return code_commune[:3]
    return code_commune[:2]


def load_companies():
    print("=" * 60)
    print("LOADING COMPANIES (REST API)")
    print("=" * 60)

    total_read = 0
    total_sent = 0
    start_time = time.time()
    siren_map = {}

    # Phase 1: Read & deduplicate
    print("  Phase 1: Reading CSV & deduplicating...")
    with open(COMPANIES_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            total_read += 1
            if total_read % 1_000_000 == 0:
                elapsed = time.time() - start_time
                print(f"    Read {total_read:,} rows, {len(siren_map):,} unique ({elapsed:.0f}s)", flush=True)

            if row.get("statutDiffusionUniteLegale") == "N":
                continue
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
                "etat_administratif": "A",
            }

    unique_count = len(siren_map)
    elapsed = time.time() - start_time
    print(f"  Phase 1 done: {total_read:,} rows, {unique_count:,} active companies ({elapsed:.0f}s)", flush=True)

    # Phase 2: POST in batches
    print(f"\n  Phase 2: Uploading {unique_count:,} companies...", flush=True)
    all_rows = list(siren_map.values())
    siren_map = None

    for i in range(0, len(all_rows), BATCH_SIZE):
        batch = all_rows[i:i + BATCH_SIZE]
        post_batch("companies", batch)
        total_sent += len(batch)
        if total_sent % 5000 == 0:
            elapsed = time.time() - start_time
            rate = total_sent / elapsed if elapsed > 0 else 0
            print(f"    Sent: {total_sent:,} / {unique_count:,} ({rate:,.0f} rows/s)", flush=True)

    elapsed = time.time() - start_time
    print(f"\n  DONE! Sent {total_sent:,} companies in {elapsed:.0f}s", flush=True)


def load_etablissements():
    print("\n" + "=" * 60)
    print("LOADING ETABLISSEMENTS (REST API)")
    print("=" * 60)

    total_read = 0
    total_sent = 0
    total_skipped = 0
    start_time = time.time()
    batch = []

    with open(ETAB_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            total_read += 1
            if row.get("statutDiffusionEtablissement") == "N":
                total_skipped += 1
                continue
            if row.get("etatAdministratifEtablissement") == "F":
                total_skipped += 1
                continue

            code_commune = row.get("codeCommuneEtablissement") or None
            dept = get_dept_from_commune(code_commune)

            batch.append({
                "siret": row["siret"],
                "siren": row["siren"],
                "nic": row.get("nic") or None,
                "denomination_usuelle": row.get("denominationUsuelleEtablissement") or None,
                "enseigne": row.get("enseigne1Etablissement") or None,
                "naf_code": row.get("activitePrincipaleEtablissement") or None,
                "est_siege": row.get("etablissementSiege") == "true",
                "numero_voie": row.get("numeroVoieEtablissement") or None,
                "type_voie": row.get("typeVoieEtablissement") or None,
                "libelle_voie": row.get("libelleVoieEtablissement") or None,
                "code_postal": row.get("codePostalEtablissement") or None,
                "commune": row.get("libelleCommuneEtablissement") or None,
                "code_commune": code_commune,
                "departement": dept,
                "etat_administratif": row.get("etatAdministratifEtablissement") or "A",
                "date_creation": row.get("dateCreationEtablissement") or None,
                "tranche_effectif": row.get("trancheEffectifsEtablissement") or None,
            })

            if len(batch) >= BATCH_SIZE:
                post_batch("etablissements", batch)
                total_sent += len(batch)
                batch = []
                if total_sent % 5000 == 0:
                    elapsed = time.time() - start_time
                    rate = total_sent / elapsed if elapsed > 0 else 0
                    print(f"  Etab: {total_sent:,} sent ({rate:,.0f} rows/s) [read: {total_read:,}]", flush=True)

        if batch:
            post_batch("etablissements", batch)
            total_sent += len(batch)

    elapsed = time.time() - start_time
    print(f"\n  DONE! Sent {total_sent:,} etablissements in {elapsed:.0f}s", flush=True)
    print(f"  Skipped {total_skipped:,} closed/non-diffusible", flush=True)


if __name__ == "__main__":
    print("Sirene Data Loader (REST API — works on any network)")
    print()

    if "--etab-only" in sys.argv:
        load_etablissements()
    elif "--companies-only" in sys.argv:
        load_companies()
    else:
        load_companies()
        load_etablissements()

    print("\nAll done!")
