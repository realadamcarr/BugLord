"""
iNaturalist Data Fetcher for BugLord ML Training

This script fetches insect observation data from iNaturalist API and downloads
images organized by species for training a custom insect classifier.

Usage:
    python fetch_inaturalist_data.py --species "butterfly,beetle,ant" --per-species 100
"""

import argparse
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Dict, List
from urllib.parse import urlencode

import requests

# iNaturalist API Configuration
INATURALIST_API_BASE = "https://api.inaturalist.org/v1"
OBSERVATIONS_ENDPOINT = f"{INATURALIST_API_BASE}/observations"
TAXA_ENDPOINT = f"{INATURALIST_API_BASE}/taxa"

# Rate limiting
REQUEST_DELAY = 0.5  # seconds between requests
MAX_WORKERS = 3  # parallel downloads (reduced to avoid timeouts)
DOWNLOAD_TIMEOUT = 30  # seconds per download


class INaturalistFetcher:
    def __init__(self, output_dir: str = "dataset"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.stats = {"downloaded": 0, "skipped": 0, "errors": 0}

    # Map scientific/query names → app-friendly common labels
    LABEL_MAP = {
        "apis mellifera": "Bees",
        "bombus": "Bees",
        "apis": "Bees",
        "danaus plexippus": "Butterfly",
        "papilio": "Butterfly",
        "pieris rapae": "Butterfly",
        "coccinella septempunctata": "Ladybug",
        "harmonia": "Ladybug",
        "lucanus cervus": "beetle",
        "anax junius": "dragonfly",
        "solenopsis invicta": "ant",
        "solenopsis": "ant",
        "camponotus": "ant",
        "formica": "ant",
        "vespa": "wasp",
        "polistes": "wasp",
        "musca domestica": "fly",
        "argiope aurantia": "spider",
        "mantis religiosa": "Mantis",
        "gryllus": "grasshopper",
        "acheta": "grasshopper",
        "culex": "mosquito",
        "aedes": "mosquito",
        "blattella": "cockroach",
        "periplaneta": "cockroach",
        "scolopendra": "centipedes",
        "manduca": "caterpillar",
        "danaus plexippus larva": "caterpillar",
    }

    def get_folder_label(self, species_query: str) -> str:
        """Map a species query to the app's label for folder naming"""
        key = species_query.strip().lower()
        return self.LABEL_MAP.get(key, species_query.replace(" ", "_").lower())

    def search_taxon(self, query: str) -> Dict[str, Any]:
        """Search for a taxon by name and return its ID"""
        print(f"🔍 Searching for taxon: {query}")

        params = {
            "q": query,
            "rank": "species,genus",
            "iconic_taxa": "Insecta",  # Limit to insects
            "per_page": 1
        }

        try:
            response = requests.get(TAXA_ENDPOINT, params=params, timeout=20)
            response.raise_for_status()
            data = response.json()

            if data["results"]:
                taxon = data["results"][0]
                print(f"✅ Found: {taxon['name']} (ID: {taxon['id']})")
                return taxon
            else:
                print(f"❌ No taxon found for: {query}")
                return None

        except Exception as e:
            print(f"❌ Error searching taxon: {e}")
            return None

    def fetch_observations(self, taxon_id: int, limit: int = 100) -> List[Dict]:
        """Fetch observations for a specific taxon"""
        print(f"📥 Fetching observations for taxon {taxon_id}...")

        observations = []
        page = 1
        per_page = 200  # Max per request

        while len(observations) < limit:
            params = {
                "taxon_id": taxon_id,
                "quality_grade": "research",  # High quality observations only
                "photos": "true",
                "per_page": min(per_page, limit - len(observations)),
                "page": page,
                "order_by": "votes",  # Get most voted/popular first
                "order": "desc"
            }

            try:
                response = requests.get(OBSERVATIONS_ENDPOINT, params=params, timeout=20)
                response.raise_for_status()
                data = response.json()

                results = data.get("results", [])
                if not results:
                    break

                observations.extend(results)
                print(f"  Fetched page {page}, total: {len(observations)}/{limit}")

                page += 1
                time.sleep(REQUEST_DELAY)  # Rate limiting

            except Exception as e:
                print(f"❌ Error fetching observations: {e}")
                break

        return observations[:limit]

    def download_image(self, url: str, output_path: Path, retries: int = 2) -> bool:
        """Download a single image with retry logic"""
        for attempt in range(retries + 1):
            try:
                response = requests.get(url, timeout=DOWNLOAD_TIMEOUT, stream=True)
                response.raise_for_status()

                with open(output_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)

                return True

            except Exception as e:
                if attempt < retries:
                    time.sleep(1 * (attempt + 1))  # backoff
                    continue
                print(f"❌ Error downloading {url}: {e}")
                return False
        return False

    def process_observations(self, observations: List[Dict], species_name: str, folder_label: str = None):
        """Download images from observations"""
        label = folder_label or species_name.replace(" ", "_").lower()
        species_dir = self.output_dir / label
        species_dir.mkdir(exist_ok=True)

        print(f"\n📸 Downloading images for {species_name}...")
        print(f"   Target: {len(observations)} observations")

        download_tasks = []

        for idx, obs in enumerate(observations):
            obs_id = obs["id"]
            photos = obs.get("photos", [])

            if not photos:
                continue

            # Get the first photo (usually the best)
            photo = photos[0]

            # Use medium size for training (good balance of quality/size)
            image_url = photo.get("url", "").replace("square", "medium")

            if not image_url:
                continue

            # Create unique filename
            filename = f"{species_name.replace(' ', '_')}_{obs_id}_{idx}.jpg"
            output_path = species_dir / filename

            # Skip if already downloaded
            if output_path.exists():
                self.stats["skipped"] += 1
                continue

            download_tasks.append((image_url, output_path))

        # Download in parallel
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {
                executor.submit(self.download_image, url, path): (url, path)
                for url, path in download_tasks
            }

            for future in as_completed(futures):
                url, path = futures[future]
                try:
                    success = future.result()
                    if success:
                        self.stats["downloaded"] += 1
                        if self.stats["downloaded"] % 10 == 0:
                            print(f"   Downloaded: {self.stats['downloaded']}")
                    else:
                        self.stats["errors"] += 1
                except Exception as e:
                    self.stats["errors"] += 1
                    print(f"❌ Failed: {path.name}")

                time.sleep(REQUEST_DELAY / MAX_WORKERS)  # Rate limiting

    def fetch_species_data(self, species_query: str, images_per_species: int):
        """Complete pipeline: search taxon -> fetch observations -> download images"""
        folder_label = self.get_folder_label(species_query)

        print(f"\n{'='*60}")
        print(f"Processing: {species_query}  →  folder: {folder_label}")
        print(f"{'='*60}")

        # 1. Search for taxon
        taxon = self.search_taxon(species_query)
        if not taxon:
            return

        taxon_id = taxon["id"]
        taxon_name = taxon["name"]

        # 2. Fetch observations
        observations = self.fetch_observations(taxon_id, images_per_species)
        print(f"✅ Found {len(observations)} observations")

        if not observations:
            return

        # 3. Download images (into the mapped folder label)
        self.process_observations(observations, taxon_name, folder_label)

        # 4. Save metadata
        metadata_path = self.output_dir / f"{taxon_name.replace(' ', '_')}_metadata.json"
        metadata = {
            "taxon_id": taxon_id,
            "taxon_name": taxon_name,
            "common_name": taxon.get("preferred_common_name", ""),
            "observations_fetched": len(observations),
            "images_downloaded": self.stats["downloaded"]
        }

        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)

    def print_summary(self):
        """Print final statistics"""
        print(f"\n{'='*60}")
        print("📊 Download Summary")
        print(f"{'='*60}")
        print(f"✅ Downloaded: {self.stats['downloaded']}")
        print(f"⏭️  Skipped (existing): {self.stats['skipped']}")
        print(f"❌ Errors: {self.stats['errors']}")
        print(f"📁 Output directory: {self.output_dir.absolute()}")
        print(f"{'='*60}\n")


def main():
    parser = argparse.ArgumentParser(description="Fetch insect images from iNaturalist")
    parser.add_argument(
        "--species",
        type=str,
        required=True,
        help="Comma-separated list of species to fetch (e.g., 'Monarch Butterfly,Ladybug,Honeybee')"
    )
    parser.add_argument(
        "--per-species",
        type=int,
        default=100,
        help="Number of images to download per species (default: 100)"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="dataset",
        help="Output directory for downloaded images (default: dataset)"
    )

    args = parser.parse_args()

    # Parse species list
    species_list = [s.strip() for s in args.species.split(",")]

    print(f"\n🐛 iNaturalist Data Fetcher for BugLord")
    print(f"{'='*60}")
    print(f"Species to fetch: {len(species_list)}")
    print(f"Images per species: {args.per_species}")
    print(f"Output directory: {args.output}")
    print(f"{'='*60}\n")

    # Create fetcher
    fetcher = INaturalistFetcher(output_dir=args.output)

    # Fetch data for each species
    for species in species_list:
        fetcher.fetch_species_data(species, args.per_species)
        time.sleep(1)  # Brief pause between species

    # Print summary
    fetcher.print_summary()

    print("\n✅ Data fetching complete!")
    print(f"📁 Dataset ready for training at: {Path(args.output).absolute()}")
    print("\nNext steps:")
    print("  1. Review downloaded images")
    print("  2. Run: python train_model.py --dataset dataset")


if __name__ == "__main__":
    main()
