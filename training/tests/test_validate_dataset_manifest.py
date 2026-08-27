"""Tests for the commercial dataset manifest validation gate."""

from __future__ import annotations

import copy
import contextlib
import io
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
            "missing review timestamp": ("rightsReviewedAt", None),
            "commercial use not verified": ("commercialMlUseVerified", False),
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

    def test_reports_nested_locations_in_deterministic_order(self) -> None:
        record = copy.deepcopy(APPROVED_RECORD)
        record["retrievedAt"] = "not-a-timestamp"
        record["sha256"] = "not-a-sha256"

        self.assertEqual(
            validate_manifest([record], self.schema),
            [
                "$[0].retrievedAt: 'not-a-timestamp' is not a 'date-time'",
                "$[0].sha256: 'not-a-sha256' does not match "
                "'^[a-fA-F0-9]{64}$'",
            ],
        )

    def test_rejects_unknown_manifest_fields(self) -> None:
        record = copy.deepcopy(APPROVED_RECORD)
        record["unreviewedMetadata"] = "must not silently pass"

        violations = validate_manifest([record], self.schema)

        self.assertEqual(len(violations), 1)
        self.assertIn("Additional properties are not allowed", violations[0])

    def test_cli_returns_success_for_valid_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            manifest_path = Path(directory) / "manifest.json"
            manifest_path.write_text(json.dumps([APPROVED_RECORD]), encoding="utf-8")
            stdout = io.StringIO()

            with contextlib.redirect_stdout(stdout):
                exit_code = main([str(manifest_path)])

            self.assertEqual(exit_code, 0)
            self.assertIn("Manifest is valid", stdout.getvalue())

    def test_cli_returns_failure_for_invalid_manifest(self) -> None:
        record = copy.deepcopy(APPROVED_RECORD)
        record["originContainsINaturalistData"] = True
        with tempfile.TemporaryDirectory() as directory:
            manifest_path = Path(directory) / "manifest.json"
            manifest_path.write_text(json.dumps([record]), encoding="utf-8")
            stderr = io.StringIO()

            with contextlib.redirect_stderr(stderr):
                exit_code = main([str(manifest_path)])

            self.assertEqual(exit_code, 1)
            self.assertIn("$[0].originContainsINaturalistData", stderr.getvalue())

    def test_cli_returns_input_error_for_malformed_json(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            manifest_path = Path(directory) / "manifest.json"
            manifest_path.write_text("{not valid JSON", encoding="utf-8")
            stderr = io.StringIO()

            with contextlib.redirect_stderr(stderr):
                exit_code = main([str(manifest_path)])

            self.assertEqual(exit_code, 2)
            self.assertIn("Manifest validation could not run", stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
