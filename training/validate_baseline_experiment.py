"""Validate and preflight the approved BIOSCAN baseline experiment.

This module deliberately does not download data or train a model. The preflight
also enforces the candidate's authorization controls before a future runner is
allowed to start training.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
DEFAULT_EXPERIMENT = ROOT / "experiments" / "bioscan_efficientnet_b0_baseline.json"

EXPECTED = {
    ("model", "architecture"): "efficientnet_b0",
    ("model", "initialization"): "random",
    ("model", "pretrainedWeights"): None,
    ("model", "inputSize"): [224, 224],
    ("training", "batchSize"): 32,
    ("training", "optimizer"): "AdamW",
    ("training", "learningRate"): 0.0003,
    ("training", "weightDecay"): 0.01,
    ("training", "maximumEpochs"): 30,
    ("training", "automaticMixedPrecision"): True,
    ("training", "seed"): 42,
    ("training", "loss"): "cross_entropy",
    ("data", "splitPolicy"): "preserve_upstream_assignments",
    ("reporting", "reportPerSourceSplit"): True,
}
EXPECTED_METRICS = {"top_1_accuracy", "top_5_accuracy", "macro_f1", "confusion_matrix"}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_experiment(experiment: dict[str, Any], experiment_path: Path) -> list[str]:
    violations: list[str] = []
    for keys, expected in EXPECTED.items():
        section, field = keys
        actual = experiment.get(section, {}).get(field)
        if actual != expected:
            violations.append(f"{section}.{field} must be {expected!r}; got {actual!r}")

    stopping = experiment.get("training", {}).get("earlyStopping", {})
    if stopping != {"monitor": "validation_loss", "patience": 5}:
        violations.append("training.earlyStopping must monitor validation_loss with patience 5")

    metrics = experiment.get("reporting", {}).get("metrics", [])
    if set(metrics) != EXPECTED_METRICS or len(metrics) != len(EXPECTED_METRICS):
        violations.append(f"reporting.metrics must contain exactly {sorted(EXPECTED_METRICS)}")

    candidate_ref = experiment.get("datasetCandidate")
    if not isinstance(candidate_ref, str):
        violations.append("datasetCandidate must be a relative path")
        return violations
    candidate_path = (experiment_path.parent / candidate_ref).resolve()
    try:
        candidate = load_json(candidate_path)
    except (OSError, json.JSONDecodeError) as error:
        violations.append(f"datasetCandidate cannot be loaded: {error}")
        return violations

    source_splits = candidate.get("splits", {}).get("values", [])
    configured_splits = [
        experiment.get("data", {}).get("trainingSplit"),
        experiment.get("data", {}).get("validationSplit"),
        *experiment.get("data", {}).get("evaluationSplits", []),
    ]
    if configured_splits != source_splits:
        violations.append("configured splits must preserve the candidate's values and order exactly")
    if experiment.get("data", {}).get("sourceSplitField") != candidate.get("splits", {}).get("sourceField"):
        violations.append("data.sourceSplitField must match the candidate source split field")
    if experiment.get("data", {}).get("imagePackage") != candidate.get("source", {}).get("imagePackage"):
        violations.append("data.imagePackage must match the candidate image package")
    return violations


def training_authorized(experiment: dict[str, Any], experiment_path: Path) -> bool:
    candidate_path = (experiment_path.parent / experiment["datasetCandidate"]).resolve()
    return load_json(candidate_path).get("controls", {}).get("trainingAuthorized") is True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("experiment", nargs="?", type=Path, default=DEFAULT_EXPERIMENT)
    parser.add_argument("--request-training", action="store_true", help="preflight a future full run")
    args = parser.parse_args()
    path = args.experiment.resolve()
    experiment = load_json(path)
    violations = validate_experiment(experiment, path)
    if violations:
        for violation in violations:
            print(f"ERROR: {violation}")
        return 1
    if args.request_training and not training_authorized(experiment, path):
        print("BLOCKED: dataset candidate controls.trainingAuthorized is false")
        return 2
    print(f"Valid baseline experiment: {experiment['experimentId']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
