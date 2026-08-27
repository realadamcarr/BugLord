"""Tests for the commercial dataset manifest validation gate."""

from __future__ import annotations

import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path


TRAINING_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TRAINING_ROOT))

from validate_dataset_manifest import (  # noqa: E402
    DEFAULT_SCHEMA_PATH,
    main,
    validate_manifest,
)


APPROVED_RECORD = {
    "internalImageId": "img_synthetic_001",
    "source": "synthetic-test-fixture",
    "sourceIdentifier": "fixture/image-1",
    "creator": "Test Creator",
    "license": "Synthetic test data",
    "licenseUrl": None,
    "licenseVersion": "1.0",
    "attributionText": None,
    "retrievedAt": "2026-08-27T12:00:00Z",
    "taxonLabel": "Synthetic species",
    "taxonomicId": "test:1",
    "split": "train",
    "sha256": "a" * 64,
    "commercialMlUseVerified": True,
    "rightsReviewStatus": "approved",
    "rightsReviewer": "Test Reviewer",
    "rightsReviewedAt": "2026-08-27T12:30:00Z",
    "originContainsINaturalistData": False,
    "notes": "Synthetic metadata only.",
}


class ValidateManifestTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        with DEFAULT_SCHEMA_PATH.open(encoding="utf-8") as source:
            cls.schema = json.load(source)

    def test_accepts_approved_manifest(self) -> None:
        self.assertEqual(validate_manifest([APPROVED_RECORD], self.schema), [])

    def test_rejects_each_required_intake_gate_violation(self) -> None:
        cases = {
            "missing review evidence": ("rightsReviewer", None),
            "non-approved status": ("rightsReviewStatus", "pending"),
            "invalid hash": ("sha256", "not-a-sha256"),
            "iNaturalist origin": ("originContainsINaturalistData", True),
        }

        for name, (field, value) in cases.items():
            with self.subTest(name=name):
                record = copy.deepcopy(APPROVED_RECORD)
                if value is None:
                    del record[field]
                else:
                    record[field] = value
                self.assertTrue(validate_manifest([record], self.schema))

    def test_cli_returns_failure_for_invalid_manifest(self) -> None:
        record = copy.deepcopy(APPROVED_RECORD)
        record["originContainsINaturalistData"] = True
        with tempfile.TemporaryDirectory() as directory:
            manifest_path = Path(directory) / "manifest.json"
            manifest_path.write_text(json.dumps([record]), encoding="utf-8")
            self.assertEqual(main([str(manifest_path)]), 1)


if __name__ == "__main__":
    unittest.main()
