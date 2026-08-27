"""Tests for the BIOSCAN baseline experiment contract."""

from __future__ import annotations

import copy
import json
import sys
import unittest
from pathlib import Path


TRAINING_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TRAINING_ROOT))

from validate_baseline_experiment import DEFAULT_EXPERIMENT, training_authorized, validate_experiment  # noqa: E402


class ValidateBaselineExperimentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.experiment = json.loads(DEFAULT_EXPERIMENT.read_text(encoding="utf-8"))

    def test_approved_experiment_is_valid(self) -> None:
        self.assertEqual(validate_experiment(self.experiment, DEFAULT_EXPERIMENT), [])

    def test_hyperparameter_drift_is_rejected(self) -> None:
        experiment = copy.deepcopy(self.experiment)
        experiment["training"]["learningRate"] = 0.001
        self.assertTrue(validate_experiment(experiment, DEFAULT_EXPERIMENT))

    def test_source_split_changes_are_rejected(self) -> None:
        experiment = copy.deepcopy(self.experiment)
        experiment["data"]["evaluationSplits"].remove("key_unseen")
        self.assertTrue(validate_experiment(experiment, DEFAULT_EXPERIMENT))

    def test_internal_training_is_authorized_after_rights_review(self) -> None:
        self.assertTrue(training_authorized(self.experiment, DEFAULT_EXPERIMENT))


if __name__ == "__main__":
    unittest.main()
