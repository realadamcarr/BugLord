"""Tests for quarantined dataset candidate configuration."""

from __future__ import annotations

import copy
import json
import sys
import unittest
from pathlib import Path


TRAINING_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TRAINING_ROOT))

from validate_dataset_manifest import validate_manifest  # noqa: E402


SCHEMA_PATH = TRAINING_ROOT / "schemas" / "dataset_candidate.schema.json"
CANDIDATE_PATH = TRAINING_ROOT / "datasets" / "buglord-bioscan-v0.1.0-candidate.json"


class ValidateDatasetCandidateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
        cls.candidate = json.loads(CANDIDATE_PATH.read_text(encoding="utf-8"))

    def test_candidate_configuration_is_valid(self) -> None:
        self.assertEqual(validate_manifest(self.candidate, self.schema), [])

    def test_candidate_cannot_authorize_download_or_training(self) -> None:
        for control in ("downloadAuthorized", "trainingAuthorized"):
            with self.subTest(control=control):
                candidate = copy.deepcopy(self.candidate)
                candidate["controls"][control] = True
                self.assertTrue(validate_manifest(candidate, self.schema))

    def test_candidate_cannot_claim_rights_or_taxonomy_approval(self) -> None:
        cases = (
            ("rights", "reviewStatus", "approved"),
            ("taxonomy", "status", "approved"),
        )
        for section, field, value in cases:
            with self.subTest(section=section, field=field):
                candidate = copy.deepcopy(self.candidate)
                candidate[section][field] = value
                self.assertTrue(validate_manifest(candidate, self.schema))

    def test_candidate_must_preserve_official_splits_and_source_labels(self) -> None:
        candidate = copy.deepcopy(self.candidate)
        candidate["splits"]["values"] = ["train", "validation", "test"]
        candidate["taxonomy"]["preserveSourceLabels"] = False

        violations = validate_manifest(candidate, self.schema)

        self.assertEqual(len(violations), 2)


if __name__ == "__main__":
    unittest.main()
