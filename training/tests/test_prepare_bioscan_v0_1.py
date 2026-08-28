"""Tests for the BIOSCAN v0.1 acquisition and preparation pipeline."""

from __future__ import annotations

import csv
import hashlib
import io
import json
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile
import struct
import zlib
from pathlib import Path

TRAINING_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TRAINING_ROOT))

from prepare_bioscan_v0_1 import (  # noqa: E402
    PipelineError, eligible_process_ids, generate_eligibility_report, hub_download,
    prepare, safe_extract, selective_extract,
)


class BioscanPipelineTests(unittest.TestCase):
    def make_image(self, path: Path, colour: tuple[int, int, int]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        def chunk(kind: bytes, payload: bytes) -> bytes:
            return (struct.pack(">I", len(payload)) + kind + payload
                    + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF))
        raw = b"\x00" + bytes(colour)
        png = (b"\x89PNG\r\n\x1a\n"
               + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
               + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))
        path.write_bytes(png)

    def write_metadata(self, path: Path, rows: list[dict[str, str]]) -> None:
        fields = ["processid", "split", "phylum", "class", "order", "family",
                  "subfamily", "genus", "species", "taxon"]
        with path.open("w", encoding="utf-8", newline="") as target:
            writer = csv.DictWriter(target, fieldnames=fields)
            writer.writeheader()
            writer.writerows(rows)

    def test_prepares_split_layout_and_provenance_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.make_image(root / "source" / "ABC.png", (1, 2, 3))
            metadata = root / "metadata.csv"
            self.write_metadata(metadata, [{"processid": "ABC", "split": "val",
                "phylum": "Arthropoda", "class": "Insecta", "order": "Diptera",
                "family": "Testidae", "subfamily": "", "genus": "Testus",
                "species": "Testus example", "taxon": "Testus example"}])

            result = prepare(metadata, root / "source", root / "prepared",
                             TRAINING_ROOT / "datasets" / "buglord-bioscan-v0.1.0-candidate.json",
                             {"val"}, "2026-08-27T12:00:00Z")

            self.assertEqual(result.report["accepted"], 1)
            record = result.records[0]
            self.assertEqual(record["split"], "validation")
            self.assertEqual(record["sourceIdentifier"], "ABC")
            self.assertEqual(json.loads(record["notes"])["sourceSplit"], "val")
            images = list((root / "prepared" / "images" / "val").rglob("*.png"))
            self.assertEqual(len(images), 1)
            self.assertTrue((root / "prepared" / "manifest.json").is_file())

    def test_rejects_corrupt_missing_and_cross_split_duplicate_images(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.make_image(root / "images" / "A.png", (10, 20, 30))
            (root / "images" / "B.png").write_bytes((root / "images" / "A.png").read_bytes())
            (root / "images" / "C.png").write_bytes(b"not an image")
            metadata = root / "metadata.csv"
            base = {"phylum": "Arthropoda", "class": "Insecta", "order": "Diptera",
                    "family": "Testidae", "subfamily": "", "genus": "Testus",
                    "species": "Testus example", "taxon": "Testus example"}
            self.write_metadata(metadata, [base | {"processid": "A", "split": "train"},
                base | {"processid": "B", "split": "test"},
                base | {"processid": "C", "split": "train"},
                base | {"processid": "MISSING", "split": "train"}])

            result = prepare(metadata, root / "images", root / "out",
                             TRAINING_ROOT / "datasets" / "buglord-bioscan-v0.1.0-candidate.json",
                             {"train", "test"}, "2026-08-27T12:00:00Z", False)

            self.assertEqual(result.report["accepted"], 1)
            reasons = [item["reason"] for item in result.report["issues"]]
            self.assertTrue(any("cross-split duplicate" in reason for reason in reasons))
            self.assertTrue(any("invalid image" in reason for reason in reasons))
            self.assertTrue(any("missing or ambiguous" in reason for reason in reasons))

    def test_safe_extract_rejects_path_traversal(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / "bad.zip"
            with zipfile.ZipFile(archive, "w") as target:
                target.writestr("../escape.txt", "bad")
            with self.assertRaises(PipelineError):
                safe_extract(archive, root / "out")

    def test_hub_download_is_revision_pinned_verified_and_benchmarked(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            payload = b"xet transfer"

            def fake_download(**kwargs: object) -> str:
                self.assertEqual(kwargs["repo_type"], "dataset")
                self.assertEqual(kwargs["revision"], "abc123")
                target = Path(str(kwargs["local_dir"])) / str(kwargs["filename"])
                target.write_bytes(payload)
                return str(target)

            with patch("huggingface_hub.hf_hub_download", side_effect=fake_download):
                receipt = hub_download(
                    "bioscan-ml/BIOSCAN-5M", "asset.zip", "abc123",
                    root / "asset.zip", hashlib.sha256(payload).hexdigest(), len(payload), True)

            self.assertEqual(receipt["revision"], "abc123")
            self.assertEqual(receipt["transfer"]["backend"], "huggingface_hub/hf_xet")
            self.assertTrue(receipt["transfer"]["forced"])
            self.assertIn("huggingfaceHubVersion", receipt["transfer"])
            self.assertIn("hfXetVersion", receipt["transfer"])

    def test_hub_download_rejects_unpinned_revision(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(PipelineError):
                hub_download("bioscan-ml/BIOSCAN-5M", "asset.zip", "",
                             Path(directory) / "asset.zip", "0" * 64)

    def test_selective_extract_keeps_only_eligible_images(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            metadata = root / "metadata.csv"
            base = {"phylum": "Arthropoda", "class": "Insecta", "order": "Diptera",
                    "family": "Testidae", "subfamily": "", "genus": "Testus", "taxon": ""}
            self.write_metadata(metadata, [
                base | {"processid": "KEEP", "split": "train", "species": "Testus example"},
                base | {"processid": "NO_LABEL", "split": "train", "species": ""},
                base | {"processid": "HELDOUT", "split": "key_unseen", "species": "Testus other"},
            ])
            archive = root / "images.zip"
            with zipfile.ZipFile(archive, "w") as target:
                target.writestr("train/chunk/KEEP.jpg", b"keep")
                target.writestr("train/chunk/NO_LABEL.jpg", b"skip")
                target.writestr("key_unseen/chunk/HELDOUT.jpg", b"skip")

            ids = eligible_process_ids(metadata, {"train", "val", "test"})
            result = selective_extract(archive, root / "out", ids)

            self.assertEqual(result["extracted"], 1)
            self.assertTrue((root / "out" / "train" / "chunk" / "KEEP.jpg").is_file())
            self.assertFalse((root / "out" / "key_unseen" / "chunk" / "HELDOUT.jpg").exists())

    def test_generates_metadata_only_eligibility_report(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            metadata = root / "metadata.csv"
            base = {"phylum": "Arthropoda", "class": "Insecta", "order": "Diptera",
                    "family": "Testidae", "subfamily": "", "genus": "Testus",
                    "taxon": "Testus example"}
            self.write_metadata(metadata, [
                base | {"processid": "A", "split": "train", "species": "Testus example"},
                base | {"processid": "B", "split": "val", "species": ""},
                base | {"processid": "C", "split": "unknown", "species": "Testus other"},
            ])

            report = generate_eligibility_report(
                metadata,
                TRAINING_ROOT / "datasets" / "buglord-bioscan-v0.1.0-candidate.json",
                "https://example.test/metadata.zip",
            )

            self.assertEqual(report["metadata"]["rows"], 3)
            self.assertEqual(report["eligibleBaselineRows"], 1)
            self.assertEqual(report["ineligibleByReason"], {
                "missing-or-unsupported-split": 1, "missing-species": 1})
            self.assertFalse(report["policy"]["imageValidationPerformed"])
            self.assertFalse(report["policy"]["trainingStarted"])
            self.assertEqual(report["decision"], "eligible-for-image-acquisition-review")


if __name__ == "__main__":
    unittest.main()
