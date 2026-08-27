"""Validate a quarantined BugLord dataset candidate configuration."""

from __future__ import annotations

from pathlib import Path

from validate_dataset_manifest import main as validate_json


DEFAULT_SCHEMA_PATH = Path(__file__).resolve().parent / "schemas" / "dataset_candidate.schema.json"


if __name__ == "__main__":
    raise SystemExit(validate_json([*__import__("sys").argv[1:], "--schema", str(DEFAULT_SCHEMA_PATH)]))
