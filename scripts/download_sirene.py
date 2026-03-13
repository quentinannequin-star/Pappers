"""
Download Sirene stock CSV files from data.gouv.fr.
Run: python scripts/download_sirene.py

Downloads ~8 GB total (2 ZIP files containing CSVs).
"""

import os
import zipfile
import requests
from tqdm import tqdm

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")

FILES = {
    "StockUniteLegale": "https://object.files.data.gouv.fr/data-pipeline-open/siren/stock/StockUniteLegale_utf8.zip",
    "StockEtablissement": "https://object.files.data.gouv.fr/data-pipeline-open/siren/stock/StockEtablissement_utf8.zip",
}


def download_file(url: str, dest_path: str):
    """Download a file with progress bar."""
    print(f"\nDownloading {os.path.basename(dest_path)}...")

    resp = requests.get(url, stream=True, timeout=30)
    resp.raise_for_status()
    total = int(resp.headers.get("content-length", 0))

    with open(dest_path, "wb") as f, tqdm(
        total=total,
        unit="B",
        unit_scale=True,
        unit_divisor=1024,
        desc=os.path.basename(dest_path),
    ) as pbar:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)
            pbar.update(len(chunk))


def extract_zip(zip_path: str, dest_dir: str):
    """Extract ZIP file."""
    print(f"Extracting {os.path.basename(zip_path)}...")
    with zipfile.ZipFile(zip_path, "r") as z:
        z.extractall(dest_dir)
    print(f"  → Extracted to {dest_dir}")


def main():
    os.makedirs(DATA_DIR, exist_ok=True)

    for name, url in FILES.items():
        zip_path = os.path.join(DATA_DIR, f"{name}.zip")

        # Check if CSV already exists
        csv_candidates = [
            f for f in os.listdir(DATA_DIR) if f.startswith(name) and f.endswith(".csv")
        ] if os.path.exists(DATA_DIR) else []

        if csv_candidates:
            print(f"✓ {name} CSV already exists: {csv_candidates[0]}")
            continue

        # Download
        if not os.path.exists(zip_path):
            download_file(url, zip_path)
        else:
            print(f"✓ {name} ZIP already downloaded")

        # Extract
        extract_zip(zip_path, DATA_DIR)

        # Remove ZIP to save space
        os.remove(zip_path)
        print(f"  → Removed ZIP to save disk space")

    print("\n✅ All Sirene files ready in data/raw/")
    for f in sorted(os.listdir(DATA_DIR)):
        size_mb = os.path.getsize(os.path.join(DATA_DIR, f)) / (1024 * 1024)
        print(f"  {f}: {size_mb:.0f} MB")


if __name__ == "__main__":
    main()
