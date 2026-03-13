"""
Load reference data (NAF codes, départements, régions) into Supabase.
Run: python scripts/load_references.py
"""

import os
import json
import httpx
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://uhpypnptmdbepwhqkmyb.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

if not SUPABASE_KEY:
    raise ValueError("Set SUPABASE_SERVICE_KEY environment variable")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def load_regions():
    """Load régions from geo.api.gouv.fr"""
    print("Loading régions...")
    resp = httpx.get("https://geo.api.gouv.fr/regions")
    resp.raise_for_status()
    regions = resp.json()

    rows = [{"code": r["code"], "nom": r["nom"]} for r in regions]
    supabase.table("ref_regions").upsert(rows).execute()
    print(f"  → {len(rows)} régions loaded")


def load_departements():
    """Load départements from geo.api.gouv.fr"""
    print("Loading départements...")
    resp = httpx.get("https://geo.api.gouv.fr/departements")
    resp.raise_for_status()
    depts = resp.json()

    rows = [
        {
            "code": d["code"],
            "nom": d["nom"],
            "code_region": d["codeRegion"],
        }
        for d in depts
    ]
    supabase.table("ref_departements").upsert(rows).execute()
    print(f"  → {len(rows)} départements loaded")


def load_naf_codes():
    """
    Load NAF Rev2 codes.
    Using the INSEE NAF nomenclature.
    """
    print("Loading NAF codes...")

    # Try to load from local CSV first
    naf_file = os.path.join(os.path.dirname(__file__), "..", "data", "ref", "naf_rev2.csv")

    if os.path.exists(naf_file):
        import csv
        rows = []
        with open(naf_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f, delimiter=";")
            for row in reader:
                code = row.get("code") or row.get("Code")
                libelle = row.get("libelle") or row.get("Libellé") or row.get("label")
                if code and libelle:
                    rows.append({"code": code.strip(), "libelle": libelle.strip()})
    else:
        # Fallback: fetch from INSEE API
        print("  NAF CSV not found, using built-in codes...")
        rows = _get_builtin_naf()

    if rows:
        # Upsert in batches of 200
        for i in range(0, len(rows), 200):
            batch = rows[i : i + 200]
            supabase.table("ref_naf").upsert(batch).execute()
        print(f"  → {len(rows)} NAF codes loaded")
    else:
        print("  ⚠ No NAF codes found")


def _get_builtin_naf():
    """Minimal built-in NAF codes for the most common M&A sectors."""
    # This is a subset — the full list (732 codes) should be loaded from CSV
    return [
        {"code": "01.11Z", "libelle": "Culture de céréales"},
        {"code": "10.71A", "libelle": "Fabrication industrielle de pain"},
        {"code": "25.11Z", "libelle": "Fabrication de structures métalliques"},
        {"code": "41.20A", "libelle": "Construction de maisons individuelles"},
        {"code": "43.21A", "libelle": "Travaux d'installation électrique"},
        {"code": "43.22A", "libelle": "Travaux d'installation d'eau et de gaz"},
        {"code": "43.32A", "libelle": "Travaux de menuiserie bois et PVC"},
        {"code": "43.34Z", "libelle": "Travaux de peinture et vitrerie"},
        {"code": "46.69B", "libelle": "Commerce de gros de fournitures et équipements industriels"},
        {"code": "47.11F", "libelle": "Hypermarchés"},
        {"code": "49.41A", "libelle": "Transports routiers de fret interurbains"},
        {"code": "56.10A", "libelle": "Restauration traditionnelle"},
        {"code": "62.01Z", "libelle": "Programmation informatique"},
        {"code": "62.02A", "libelle": "Conseil en systèmes et logiciels informatiques"},
        {"code": "64.20Z", "libelle": "Activités des sociétés holding"},
        {"code": "68.20A", "libelle": "Location de logements"},
        {"code": "68.20B", "libelle": "Location de terrains et d'autres biens immobiliers"},
        {"code": "69.10Z", "libelle": "Activités juridiques"},
        {"code": "69.20Z", "libelle": "Activités comptables"},
        {"code": "70.10Z", "libelle": "Activités des sièges sociaux"},
        {"code": "70.22Z", "libelle": "Conseil pour les affaires et la gestion"},
        {"code": "71.12B", "libelle": "Ingénierie, études techniques"},
        {"code": "73.11Z", "libelle": "Activités des agences de publicité"},
        {"code": "82.11Z", "libelle": "Services administratifs combinés de bureau"},
        {"code": "86.21Z", "libelle": "Activité des médecins généralistes"},
        {"code": "86.23Z", "libelle": "Pratique dentaire"},
        {"code": "96.02A", "libelle": "Coiffure"},
        {"code": "96.02B", "libelle": "Soins de beauté"},
    ]


if __name__ == "__main__":
    load_regions()
    load_departements()
    load_naf_codes()
    print("\n✅ All reference data loaded!")
