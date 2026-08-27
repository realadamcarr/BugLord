"""Validate a commercial dataset manifest against BugLord's approved schema."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Sequence

from jsonschema import Draft202012Validator, FormatChecker
from jsonschema.exceptions import SchemaError


DEFAULT_SCHEMA_PATH = (
    Path(__file__).resolve().parent
    / "schemas"
    / "commercial_dataset_manifest.schema.json"
)


def load_json(path: Path) -> Any:
    """Load JSON from *path*, preserving parser errors for the CLI to report."""
    with path.open(encoding="utf-8") as source:
        return json.load(source)


def validate_manifest(manifest: Any, schema: Any) -> list[str]:
    """Return deterministic, human-readable schema violations for a manifest."""
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = sorted(
        validator.iter_errors(manifest),
        key=lambda error: (list(error.absolute_path), error.message),
    )

    violations = []
    for error in errors:
        location = "$" + "".join(
            f"[{part}]" if isinstance(part, int) else f".{part}"
            for part in error.absolute_path
        )
        violations.append(f"{location}: {error.message}")
    return violations


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Validate a BugLord commercial dataset manifest."
    )
    parser.add_argument("manifest", type=Path, help="path to the manifest JSON file")
    parser.add_argument(
        "--schema",
        type=Path,
        default=DEFAULT_SCHEMA_PATH,
        help=f"schema path (default: {DEFAULT_SCHEMA_PATH})",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    try:
        schema = load_json(args.schema)
        manifest = load_json(args.manifest)
        violations = validate_manifest(manifest, schema)
    except (OSError, json.JSONDecodeError, SchemaError) as error:
        print(f"Manifest validation could not run: {error}", file=sys.stderr)
        return 2

    if violations:
        print(f"Manifest validation failed with {len(violations)} violation(s):", file=sys.stderr)
        for violation in violations:
            print(f"- {violation}", file=sys.stderr)
        return 1

    print(f"Manifest is valid: {args.manifest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
