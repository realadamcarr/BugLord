"""Tests for the rights-reviewed BIOSCAN dataset candidate configuration."""

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

    def test_candidate_authorizes_internal_acquisition_and_training(self) -> None:
        for control in ("downloadAuthorized", "trainingAuthorized"):
            with self.subTest(control=control):
                self.assertIs(self.candidate["controls"][control], True)

        self.assertIs(self.candidate["controls"]["publicCommercialReleaseAuthorized"], False)

        candidate = copy.deepcopy(self.candidate)
        candidate["controls"]["publicCommercialReleaseAuthorized"] = True
        self.assertTrue(validate_manifest(candidate, self.schema))

    def test_candidate_does_not_approve_taxonomy_or_pretrained_models(self) -> None:
        self.assertEqual(self.candidate["taxonomy"]["status"], "provisional-candidate")
        self.assertIs(self.candidate["rights"]["pretrainedModelsApproved"], False)

        candidate = copy.deepcopy(self.candidate)
        candidate["rights"]["pretrainedModelsApproved"] = True
        self.assertTrue(validate_manifest(candidate, self.schema))

    def test_candidate_locks_attribution_and_provenance_controls(self) -> None:
        rights = self.candidate["rights"]
        self.assertEqual(rights["copyrightHolder"], "CBG Photography Group")
        self.assertIn("Centre for Biodiversity Genomics", rights["attribution"])
        self.assertIs(rights["preserveSourceIdentifiers"], True)
        self.assertIs(rights["preserveModificationRecords"], True)
        self.assertIs(rights["endorsementImplied"], False)
        self.assertIs(rights["sourceDatasetOwnershipClaimed"], False)

    def test_candidate_must_preserve_official_splits_and_source_labels(self) -> None:
        candidate = copy.deepcopy(self.candidate)
        candidate["splits"]["values"] = ["train", "validation", "test"]
        candidate["taxonomy"]["preserveSourceLabels"] = False

        violations = validate_manifest(candidate, self.schema)

        self.assertEqual(len(violations), 2)


if __name__ == "__main__":
    unittest.main()
