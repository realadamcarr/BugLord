"""Validate the BugLord BugDex taxonomy contract and hierarchy."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from validate_dataset_manifest import validate_manifest


ROOT = Path(__file__).resolve().parent
DEFAULT_SCHEMA_PATH = ROOT / "schemas" / "bugdex_taxonomy.schema.json"


def validate_taxonomy(taxonomy: Any, schema: dict[str, Any]) -> list[str]:
    """Return schema and cross-record taxonomy violations."""
    violations = validate_manifest(taxonomy, schema)
    if violations or not isinstance(taxonomy, dict):
        return violations

    taxa = taxonomy.get("taxa", [])
    ids: dict[str, dict[str, Any]] = {}
    names: set[tuple[str, str]] = set()
    source_ids: set[tuple[str, str]] = set()

    for index, taxon in enumerate(taxa):
        canonical_id = taxon["canonicalId"]
        if canonical_id in ids:
            violations.append(f"taxa[{index}].canonicalId: duplicate {canonical_id!r}")
        ids[canonical_id] = taxon

        name_key = (taxon["rank"], taxon["scientificName"].casefold())
        if name_key in names:
            violations.append(f"taxa[{index}].scientificName: duplicate name at the same rank")
        names.add(name_key)

        for source in taxon["sourceIdentifiers"]:
            source_key = (source["authority"].casefold(), source["identifier"])
            if source_key in source_ids:
                violations.append(f"taxa[{index}].sourceIdentifiers: duplicate source identifier")
            source_ids.add(source_key)

    expected_parent = {"family": None, "genus": "family", "species": "genus"}
    for index, taxon in enumerate(taxa):
        rank = taxon["rank"]
        parent_id = taxon["parentCanonicalId"]
        accepted_id = taxon["acceptedCanonicalId"]

        if rank == "synonym":
            accepted = ids.get(accepted_id)
            if accepted is None or accepted.get("rank") != "species":
                violations.append(f"taxa[{index}].acceptedCanonicalId: synonym must resolve to a canonical species")
            if parent_id is not None:
                violations.append(f"taxa[{index}].parentCanonicalId: synonym must not define hierarchy")
            continue

        if accepted_id is not None:
            violations.append(f"taxa[{index}].acceptedCanonicalId: canonical taxon must be null")
        parent_rank = expected_parent[rank]
        if parent_rank is None:
            if parent_id is not None:
                violations.append(f"taxa[{index}].parentCanonicalId: family must not have a parent")
        elif parent_id not in ids or ids[parent_id]["rank"] != parent_rank:
            violations.append(f"taxa[{index}].parentCanonicalId: {rank} must reference a canonical {parent_rank}")

    return violations


def main() -> int:
    taxonomy_path = ROOT / "taxonomy" / "buglord-taxonomy-v0.1.0.json"
    schema = json.loads(DEFAULT_SCHEMA_PATH.read_text(encoding="utf-8"))
    taxonomy = json.loads(taxonomy_path.read_text(encoding="utf-8"))
    violations = validate_taxonomy(taxonomy, schema)
    for violation in violations:
        print(violation)
    return 1 if violations else 0


if __name__ == "__main__":
    raise SystemExit(main())
