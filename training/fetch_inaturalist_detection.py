"""
iNaturalist Data Fetcher for Object Detection Training

Fetches insect images with bounding box annotations in COCO format
for training BugLord's object detection model.

Usage:
    python fetch_inaturalist_detection.py --taxon-ids 47158,184884 --max-images 500
"""

import argparse
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple

import requests
from PIL import Image

# iNaturalist API Configuration
INATURALIST_API_BASE = "https://api.inaturalist.org/v1"
OBSERVATIONS_ENDPOINT = f"{INATURALIST_API_BASE}/observations"

# Rate limiting
REQUEST_DELAY = 0.5
MAX_WORKERS = 4


class INaturalistDetectionFetcher:
    def __init__(self, output_dir: str = "dataset_detection"):
        self.output_dir = Path(output_dir)
        self.images_dir = self.output_dir / "images"
        self.images_dir.mkdir(parents=True, exist_ok=True)

        self.coco_data = {
            "info": {
                "description": "BugLord Insect Detection Dataset",
                "version": "1.0",
                "year": 2026,
                "contributor": "iNaturalist",
                "date_created": datetime.now().isoformat()
            },
            "licenses": [],
            "images": [],
            "annotations": [],
            "categories": [
                {
                    "id": 1,
                    "name": "insect",
                    "supercategory": "animal"
                }
            ]
        }

        self.image_id = 1
        self.annotation_id = 1
        self.stats = {"downloaded": 0, "skipped": 0, "errors": 0, "bbox_created": 0}

    def fetch_observations(self, taxon_ids: List[int], limit: int = 500) -> List[Dict]:
        """Fetch high-quality observations with photos"""
        print(f"📥 Fetching observations for taxon IDs: {taxon_ids}...")

        observations = []
        page = 1
        per_page = 200

        while len(observations) < limit:
            params = {
                "taxon_id": ",".join(map(str, taxon_ids)),
                "quality_grade": "research",
                "photos": "true",
                "per_page": min(per_page, limit - len(observations)),
                "page": page,
                "order_by": "votes",
                "order": "desc",
                "identifications": "most_agree"  # Most agreed upon IDs
            }

            try:
                response = requests.get(OBSERVATIONS_ENDPOINT, params=params, timeout=10)
                response.raise_for_status()
                data = response.json()

                results = data.get("results", [])
                if not results:
                    break

                observations.extend(results)
                print(f"  Page {page}: {len(observations)}/{limit} observations")

                page += 1
                time.sleep(REQUEST_DELAY)

            except Exception as e:
                print(f"❌ Error fetching: {e}")
                break

        return observations[:limit]

    def estimate_bbox_from_photo(self, image_path: Path) -> Tuple[int, int, int, int]:
        """
        Estimate bounding box for insect.

        Since iNaturalist doesn't provide bounding boxes, we'll use a heuristic:
        - Assume insect is in center 60% of image
        - This gives the model something to learn from, even if imperfect
        - Real annotations would be better, but this gets us started

        Returns: (x, y, width, height) in pixels
        """
        try:
            with Image.open(image_path) as img:
                img_width, img_height = img.size

                # Center bbox covering 60% of image
                bbox_width = int(img_width * 0.6)
                bbox_height = int(img_height * 0.6)
                bbox_x = (img_width - bbox_width) // 2
                bbox_y = (img_height - bbox_height) // 2

                return (bbox_x, bbox_y, bbox_width, bbox_height)

        except Exception as e:
            print(f"❌ Error estimating bbox: {e}")
            # Default bbox if image can't be opened
            return (100, 100, 200, 200)

    def download_and_process(self, obs: Dict) -> bool:
        """Download image and create COCO annotation"""
        obs_id = obs["id"]
        photos = obs.get("photos", [])

        if not photos:
            return False

        photo = photos[0]
        image_url = photo.get("url", "").replace("square", "medium")

        if not image_url:
            return False

        # Filename
        filename = f"insect_{obs_id}.jpg"
        image_path = self.images_dir / filename

        # Skip if exists
        if image_path.exists():
            self.stats["skipped"] += 1
            return False

        try:
            # Download image
            response = requests.get(image_url, timeout=10, stream=True)
            response.raise_for_status()

            with open(image_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

            # Get image dimensions
            with Image.open(image_path) as img:
                img_width, img_height = img.size

            # Estimate bounding box
            bbox = self.estimate_bbox_from_photo(image_path)

            # Add to COCO dataset
            self.coco_data["images"].append({
                "id": self.image_id,
                "file_name": filename,
                "width": img_width,
                "height": img_height,
                "license": 0,
                "flickr_url": image_url,
                "inaturalist_id": obs_id
            })

            self.coco_data["annotations"].append({
                "id": self.annotation_id,
                "image_id": self.image_id,
                "category_id": 1,
                "bbox": list(bbox),
                "area": bbox[2] * bbox[3],
                "iscrowd": 0
            })

            self.image_id += 1
            self.annotation_id += 1
            self.stats["downloaded"] += 1
            self.stats["bbox_created"] += 1

            return True

        except Exception as e:
            self.stats["errors"] += 1
            if image_path.exists():
                image_path.unlink()
            return False

    def process_all(self, observations: List[Dict]):
        """Download all observations in parallel"""
        print(f"\n📸 Downloading {len(observations)} images with bounding boxes...")

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {
                executor.submit(self.download_and_process, obs): obs
                for obs in observations
            }

            for future in as_completed(futures):
                try:
                    future.result()
                    if self.stats["downloaded"] % 10 == 0:
                        print(f"   Downloaded: {self.stats['downloaded']}")
                except Exception as e:
                    self.stats["errors"] += 1

                time.sleep(REQUEST_DELAY / MAX_WORKERS)

    def save_coco_annotations(self):
        """Save COCO format annotations"""
        annotations_path = self.output_dir / "annotations.json"

        with open(annotations_path, 'w') as f:
            json.dump(self.coco_data, f, indent=2)

        print(f"\n✅ COCO annotations saved: {annotations_path}")

    def create_readme(self):
        """Create README with dataset info"""
        readme_path = self.output_dir / "README.md"

        content = f"""# BugLord Object Detection Dataset

## Dataset Information

- **Images**: {len(self.coco_data['images'])}
- **Annotations**: {len(self.coco_data['annotations'])}
- **Categories**: 1 (insect)
- **Source**: iNaturalist
- **Format**: COCO JSON
- **Created**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Structure

```
{self.output_dir.name}/
├── images/           # All training images
│   ├── insect_*.jpg
│   └── ...
├── annotations.json  # COCO format annotations
└── README.md        # This file
```

## Bounding Boxes

**Note**: Bounding boxes are estimated (center 60% of image) since iNaturalist
doesn't provide native bbox annotations. For production use:

1. Manually annotate a subset using LabelImg
2. Fine-tune the model with accurate annotations
3. Use the model to help annotate remaining images

## Usage

### Training

```bash
python train_detector.py --dataset {self.output_dir.name}
```

### Manual Annotation

```bash
labelImg {self.output_dir.name}/images {self.output_dir.name}/annotations.json
```

## Next Steps

1. Review images in `images/` directory
2. Optionally refine bounding boxes with LabelImg
3. Run training script
4. Deploy trained model to BugLord app
"""

        with open(readme_path, 'w') as f:
            f.write(content)

    def print_summary(self):
        """Print statistics"""
        print(f"\n{'='*60}")
        print("📊 Dataset Summary")
        print(f"{'='*60}")
        print(f"✅ Images downloaded: {self.stats['downloaded']}")
        print(f"📦 Bounding boxes: {self.stats['bbox_created']}")
        print(f"⏭️  Skipped (existing): {self.stats['skipped']}")
        print(f"❌ Errors: {self.stats['errors']}")
        print(f"📁 Output: {self.output_dir.absolute()}")
        print(f"{'='*60}\n")


def main():
    parser = argparse.ArgumentParser(
        description="Fetch insect images from iNaturalist for object detection"
    )
    parser.add_argument(
        "--taxon-ids",
        type=str,
        required=True,
        help="Comma-separated taxon IDs (e.g., '47158,184884,47120' for beetles,butterflies,ants)"
    )
    parser.add_argument(
        "--max-images",
        type=int,
        default=500,
        help="Maximum images to download (default: 500)"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="dataset_detection",
        help="Output directory (default: dataset_detection)"
    )

    args = parser.parse_args()

    # Parse taxon IDs
    taxon_ids = [int(tid.strip()) for tid in args.taxon_ids.split(",")]

    print(f"\n🐛 iNaturalist Object Detection Dataset Fetcher")
    print(f"{'='*60}")
    print(f"Taxon IDs: {taxon_ids}")
    print(f"Max images: {args.max_images}")
    print(f"Output: {args.output}")
    print(f"{'='*60}\n")

    # Create fetcher
    fetcher = INaturalistDetectionFetcher(output_dir=args.output)

    # Fetch observations
    observations = fetcher.fetch_observations(taxon_ids, args.max_images)

    if not observations:
        print("❌ No observations found!")
        return

    # Download and process
    fetcher.process_all(observations)

    # Save COCO annotations
    fetcher.save_coco_annotations()

    # Create README
    fetcher.create_readme()

    # Print summary
    fetcher.print_summary()

    print("✅ Dataset ready for object detection training!")
    print("\n📝 Important Notes:")
    print("  - Bounding boxes are estimated (center 60% of image)")
    print("  - For best results, manually refine with LabelImg")
    print("  - See README.md in output directory for details")
    print("\n🚀 Next Steps:")
    print(f"  1. Review: {Path(args.output).absolute()}")
    print("  2. Refine (optional): labelImg")
    print("  3. Train: python train_detector.py")


if __name__ == "__main__":
    main()
