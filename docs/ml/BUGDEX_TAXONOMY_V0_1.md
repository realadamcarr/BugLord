# BugDex taxonomy v0.1

The canonical contract is `buglord-taxonomy-v0.1.0`. Its machine-readable definition is in
`training/taxonomy/buglord-taxonomy-v0.1.0.json` and is validated against
`training/schemas/bugdex_taxonomy.schema.json` plus cross-record hierarchy rules.

## Canonical model

The hierarchy order is **family → genus → species**. Every canonical genus references a family,
and every canonical species references a genus. Source taxonomy identifiers are retained as
authority/identifier pairs when they exist. Missing ancestry or identifiers are never inferred.
The initial contract deliberately contains no populated taxa: a reviewed source list has not yet
been approved, and inventing coverage would violate the fail-safe policy.

Subspecies are collapsed to their accepted species in v0.1 and cannot appear as canonical ranks.
A synonym is a lookup label that points to exactly one accepted canonical species; it is not a
second species and cannot create another BugDex entry. Canonical IDs, same-rank scientific names,
and source authority/identifier pairs must be unique.

## Resolution and unlock contract

Resolution is species-first:

1. A supported species result that passes the separately configured species confidence gates may
   unlock that canonical species entry.
2. Otherwise, a supported genus result that passes its separately configured gates may be shown,
   but it must carry no species identity and cannot unlock a species entry.
3. If neither gate passes, or required taxonomy is absent or inconsistent, return
   unknown/unsupported and unlock nothing.

The taxonomy records policy but contains no numeric confidence thresholds. Thresholds must live in
a separately versioned model/calibration configuration and be validated for the deployed model.
Consumers must never treat a display label, source label, synonym, genus fallback, or missing value
as permission to unlock a species.

## Validation

Run from the repository root:

```powershell
python training/validate_bugdex_taxonomy.py
python -m unittest training.tests.test_validate_bugdex_taxonomy
```

Validation rejects unknown fields/ranks, duplicate canonical or source identities, malformed
family/genus/species ancestry, canonical taxa with synonym targets, and synonyms that do not point
to an accepted canonical species. This work defines the taxonomy boundary only; it does not approve
training data, select confidence values, or start model training.
