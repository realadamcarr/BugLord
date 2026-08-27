"""Tests for the versioned BugDex taxonomy contract."""

from __future__ import annotations

import copy
import json
import sys
import unittest
from pathlib import Path


TRAINING_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TRAINING_ROOT))

from validate_bugdex_taxonomy import validate_taxonomy  # noqa: E402


SCHEMA_PATH = TRAINING_ROOT / "schemas" / "bugdex_taxonomy.schema.json"
TAXONOMY_PATH = TRAINING_ROOT / "taxonomy" / "buglord-taxonomy-v0.1.0.json"


def hierarchy() -> list[dict[str, object]]:
    return [
        {"canonicalId": "buglord:taxon:family-a", "rank": "family", "scientificName": "Familia", "parentCanonicalId": None, "acceptedCanonicalId": None, "sourceIdentifiers": [{"authority": "source", "identifier": "1"}]},
        {"canonicalId": "buglord:taxon:genus-a", "rank": "genus", "scientificName": "Genus", "parentCanonicalId": "buglord:taxon:family-a", "acceptedCanonicalId": None, "sourceIdentifiers": [{"authority": "source", "identifier": "2"}]},
        {"canonicalId": "buglord:taxon:species-a", "rank": "species", "scientificName": "Genus species", "parentCanonicalId": "buglord:taxon:genus-a", "acceptedCanonicalId": None, "sourceIdentifiers": [{"authority": "source", "identifier": "3"}]},
        {"canonicalId": "buglord:taxon:old-name", "rank": "synonym", "scientificName": "Genus oldname", "parentCanonicalId": None, "acceptedCanonicalId": "buglord:taxon:species-a", "sourceIdentifiers": [{"authority": "source", "identifier": "4"}]},
    ]


class ValidateBugDexTaxonomyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
        cls.taxonomy = json.loads(TAXONOMY_PATH.read_text(encoding="utf-8"))

    def test_committed_contract_is_valid_and_contains_no_thresholds(self) -> None:
        self.assertEqual(validate_taxonomy(self.taxonomy, self.schema), [])
        self.assertNotIn("threshold", json.dumps(self.taxonomy).lower().replace("confidencethresholds", ""))

    def test_canonical_hierarchy_and_species_synonym_are_valid(self) -> None:
        taxonomy = copy.deepcopy(self.taxonomy)
        taxonomy["taxa"] = hierarchy()
        self.assertEqual(validate_taxonomy(taxonomy, self.schema), [])

    def test_subspecies_rank_is_rejected(self) -> None:
        taxonomy = copy.deepcopy(self.taxonomy)
        taxonomy["taxa"] = hierarchy()
        taxonomy["taxa"][2]["rank"] = "subspecies"
        self.assertTrue(validate_taxonomy(taxonomy, self.schema))

    def test_synonym_cannot_create_a_second_species_entry(self) -> None:
        taxonomy = copy.deepcopy(self.taxonomy)
        taxonomy["taxa"] = hierarchy()
        taxonomy["taxa"][3]["rank"] = "species"
        taxonomy["taxa"][3]["parentCanonicalId"] = "buglord:taxon:genus-a"
        taxonomy["taxa"][3]["acceptedCanonicalId"] = "buglord:taxon:species-a"
        self.assertTrue(validate_taxonomy(taxonomy, self.schema))

    def test_missing_or_wrong_parent_fails_closed(self) -> None:
        taxonomy = copy.deepcopy(self.taxonomy)
        taxonomy["taxa"] = hierarchy()
        taxonomy["taxa"][2]["parentCanonicalId"] = "buglord:taxon:family-a"
        self.assertTrue(validate_taxonomy(taxonomy, self.schema))

    def test_duplicate_ids_names_and_source_ids_are_rejected(self) -> None:
        taxonomy = copy.deepcopy(self.taxonomy)
        taxonomy["taxa"] = hierarchy()
        duplicate = copy.deepcopy(taxonomy["taxa"][2])
        taxonomy["taxa"].append(duplicate)
        violations = validate_taxonomy(taxonomy, self.schema)
        self.assertGreaterEqual(len(violations), 3)


if __name__ == "__main__":
    unittest.main()
