"""
iNaturalist enrichment service — looks up species from EVA-02 predictions
on the iNaturalist API to retrieve common names, taxonomy, and better
BugLord category mapping.

The iNaturalist v1 taxa API is **free and unauthenticated** (rate-limited
to ~100 req/min).  We cache results in-memory so repeated look-ups for the
same species are instant.

Public API
----------
- :func:`enrich_species`    — single species look-up → ``InatEnrichment``.
- :func:`enrich_predictions` — batch-enrich a list of ``RawPrediction``.
- :func:`taxon_to_buglord_category` — map an iNat iconic taxon / Order to BugLord category.

Taxonomy-based mapping
~~~~~~~~~~~~~~~~~~~~~~
Instead of relying only on keyword matching in ``species_map.json``, we use
the taxonomic hierarchy from iNaturalist:

- Order **Lepidoptera** → butterfly
- Order **Hymenoptera** Family Formicidae / Mutillidae → ant
- Order **Hymenoptera** (bees, wasps, sawflies) → bee
- Order **Coleoptera** → beetle
- Order **Diptera** / **Odonata** / **Ephemeroptera** etc. → fly
- Class **Arachnida** → spider
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
INAT_TAXA_URL = "https://api.inaturalist.org/v1/taxa"
INAT_AUTOCOMPLETE_URL = "https://api.inaturalist.org/v1/taxa/autocomplete"

# Timeout for iNaturalist requests (seconds).  The enrichment is
# non-blocking — we fall back to keyword mapping if iNat is slow.
INAT_TIMEOUT = 5.0

# ---------------------------------------------------------------------------
# Taxonomy → BugLord category mapping
# ---------------------------------------------------------------------------

# Order / Class → BugLord category.
# Checked in order: more specific keys first.
_TAXONOMY_MAP: dict[str, str] = {
    # -- Lepidoptera (butterflies & moths) --
    "Lepidoptera": "butterfly",

    # -- Coleoptera (beetles) --
    "Coleoptera": "beetle",

    # -- Diptera (true flies), Odonata (dragonflies), Ephemeroptera (mayflies) etc. --
    "Diptera": "fly",
    "Odonata": "fly",
    "Ephemeroptera": "fly",
    "Trichoptera": "fly",       # caddisflies
    "Plecoptera": "fly",        # stoneflies
    "Neuroptera": "fly",        # lacewings etc.
    "Mecoptera": "fly",         # scorpionflies

    # -- Hemiptera (true bugs — shield bugs, cicadas, aphids) --
    "Hemiptera": "beetle",      # closest BugLord match

    # -- Orthoptera (grasshoppers, crickets) --
    "Orthoptera": "beetle",     # closest BugLord match

    # -- Mantodea / Phasmatodea / Blattodea --
    "Mantodea": "beetle",
    "Phasmatodea": "beetle",
    "Blattodea": "beetle",       # cockroaches & termites

    # -- Arachnida (spiders, scorpions, ticks) --
    "Arachnida": "spider",
    "Araneae": "spider",
    "Scorpiones": "spider",
    "Opiliones": "spider",       # harvestmen
    "Acari": "spider",           # ticks & mites
}

# Hymenoptera families that are ants (Formicidae) or ant-like.
_ANT_FAMILIES = {
    "Formicidae",
    "Mutillidae",    # velvet ants
}

# Hymenoptera families that are bees (not wasps, but we lump them).
_BEE_FAMILIES = {
    "Apidae", "Megachilidae", "Halictidae", "Andrenidae", "Colletidae",
    "Melittidae", "Stenotritidae",
}

# ---------------------------------------------------------------------------
# Type-suffix helpers — ensure common names include what the creature is
# ---------------------------------------------------------------------------

# BugLord category → words that indicate the type is already present.
_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "butterfly": ["butterfly", "moth", "skipper", "swallowtail", "hawkmoth",
                   "monarch", "admiral", "painted lady", "fritillary",
                   "blue", "copper", "hairstreak", "metalmark", "ringlet",
                   "satyr", "nymph"],
    "bee":       ["bee", "wasp", "hornet", "yellowjacket", "sawfly",
                   "bumblebee", "honeybee"],
    "ant":       ["ant"],
    "beetle":    ["beetle", "weevil", "ladybug", "ladybird", "firefly",
                   "lightning bug", "longhorn", "scarab", "stag beetle",
                   "cockroach", "cricket", "grasshopper", "mantis",
                   "stick insect", "cicada", "aphid", "bug"],
    "fly":       ["fly", "dragonfly", "damselfly", "mayfly", "lacewing",
                   "caddisfly", "midge", "gnat", "mosquito", "crane fly",
                   "hoverfly", "horsefly"],
    "spider":    ["spider", "tarantula", "scorpion", "tick", "mite",
                   "harvestman", "daddy longlegs"],
}

# BugLord category → the type noun to append when missing.
_CATEGORY_SUFFIX: dict[str, str] = {
    "butterfly": "Butterfly",
    "bee":       "Bee",
    "ant":       "Ant",
    "beetle":    "Beetle",
    "fly":       "Fly",
    "spider":    "Spider",
}

# Special overrides: when the order is specifically moths, append "Moth" not "Butterfly".
_MOTH_FAMILIES = {
    "Sphingidae", "Noctuidae", "Geometridae", "Saturniidae", "Erebidae",
    "Arctiidae", "Crambidae", "Pyralidae", "Tortricidae", "Oecophoridae",
    "Zygaenidae", "Sesiidae", "Cossidae", "Hepialidae", "Lasiocampidae",
    "Lymantriidae", "Notodontidae", "Bombycidae",
}


def qualify_common_name(
    common_name: str,
    buglord_category: str | None,
    ancestors: list[dict] | None = None,
) -> str:
    """
    Ensure *common_name* includes a type descriptor so users see
    "Monarch Butterfly" rather than just "Monarch".

    If the name already contains a keyword for the category (e.g. "Painted
    Lady" already implies butterfly via our keyword list), it is returned
    unchanged.  Otherwise the category suffix is appended.

    For Lepidoptera, we check whether the family is a moth family to decide
    between "Butterfly" and "Moth".
    """
    if not common_name or not buglord_category:
        return common_name

    lower = common_name.lower()

    # Check if any keyword for this category already appears in the name.
    keywords = _CATEGORY_KEYWORDS.get(buglord_category, [])
    for kw in keywords:
        if kw in lower:
            return common_name  # already descriptive enough

    # Determine the right suffix.
    suffix = _CATEGORY_SUFFIX.get(buglord_category, "")

    # Lepidoptera: distinguish moths from butterflies using family.
    if buglord_category == "butterfly" and ancestors:
        families = {a.get("name", "") for a in ancestors if a.get("rank") == "family"}
        if families & _MOTH_FAMILIES:
            suffix = "Moth"
        # Also check if "moth" appears in scientific family names' common usage
        # (hawkmoths are Sphingidae, already caught above).

    if suffix:
        return f"{common_name} {suffix}"
    return common_name


def taxon_to_buglord_category(
    ancestors: list[dict],
    rank_name_pairs: list[tuple[str, str]] | None = None,
) -> Optional[str]:
    """
    Walk the taxonomic ancestry returned by iNaturalist and return the
    best BugLord category, or ``None`` if the organism isn't an insect /
    arachnid we recognise.

    Parameters
    ----------
    ancestors:
        List of ancestor taxon dicts from iNat (each has ``rank`` and ``name``).
    rank_name_pairs:
        Pre-extracted ``(rank, name)`` tuples — optional shortcut.
    """
    if rank_name_pairs is None:
        rank_name_pairs = [(a.get("rank", ""), a.get("name", "")) for a in ancestors]

    # Collect all names by rank for quick lookup.
    ranks: dict[str, str] = {}
    all_names: set[str] = set()
    for rank, name in rank_name_pairs:
        ranks[rank] = name
        all_names.add(name)

    order = ranks.get("order", "")
    family = ranks.get("family", "")
    class_ = ranks.get("class", "")

    # Hymenoptera needs family-level disambiguation.
    if order == "Hymenoptera":
        if family in _ANT_FAMILIES:
            return "ant"
        # Everything else in Hymenoptera → bee (bees + wasps + sawflies).
        return "bee"

    # Check order-level map.
    if order in _TAXONOMY_MAP:
        return _TAXONOMY_MAP[order]

    # Check class-level (Arachnida).
    if class_ in _TAXONOMY_MAP:
        return _TAXONOMY_MAP[class_]

    # Last resort: check any ancestor name.
    for name in all_names:
        if name in _TAXONOMY_MAP:
            return _TAXONOMY_MAP[name]

    return None


# ---------------------------------------------------------------------------
# Data class for enrichment results
# ---------------------------------------------------------------------------
@dataclass
class InatEnrichment:
    """Enrichment data fetched from iNaturalist for one species."""

    common_name: str = ""
    """Preferred English common name (e.g. 'Small Tortoiseshell')."""

    scientific_name: str = ""
    """Scientific name as returned by iNat (e.g. 'Aglais urticae')."""

    buglord_category: Optional[str] = None
    """BugLord category derived from taxonomy, or None."""

    taxon_id: int = 0
    """iNaturalist taxon ID."""

    iconic_taxon_name: str = ""
    """iNat iconic taxon (e.g. 'Insecta', 'Arachnida')."""

    photo_url: str = ""
    """URL to a small square photo from iNat (attribution required)."""

    wikipedia_url: str = ""
    """Link to the Wikipedia article for this taxon."""

    ancestors: list[dict] = field(default_factory=list)
    """Raw ancestor chain from iNat."""

    matched: bool = False
    """Whether iNat returned a result for this query."""


# ---------------------------------------------------------------------------
# In-memory cache  (species name → enrichment)
# ---------------------------------------------------------------------------
_cache: dict[str, InatEnrichment] = {}


# ---------------------------------------------------------------------------
# Core look-up
# ---------------------------------------------------------------------------
async def enrich_species(species_name: str) -> InatEnrichment:
    """
    Look up a species name on iNaturalist and return enrichment data.

    Results are cached in-memory.  If iNat is unreachable or times out,
    returns an empty ``InatEnrichment`` (``matched=False``).
    """
    key = species_name.lower().strip()
    if key in _cache:
        return _cache[key]

    enrichment = InatEnrichment()

    try:
        async with httpx.AsyncClient(timeout=INAT_TIMEOUT) as client:
            # Use autocomplete for best fuzzy matching.
            resp = await client.get(
                INAT_AUTOCOMPLETE_URL,
                params={"q": species_name, "per_page": 1, "locale": "en"},
            )
            resp.raise_for_status()
            data = resp.json()

            results = data.get("results", [])
            if not results:
                logger.debug("iNat: no results for %r", species_name)
                _cache[key] = enrichment
                return enrichment

            taxon = results[0]

            enrichment.matched = True
            enrichment.taxon_id = taxon.get("id", 0)
            enrichment.common_name = taxon.get("preferred_common_name", "")
            enrichment.scientific_name = taxon.get("name", "")
            enrichment.iconic_taxon_name = taxon.get("iconic_taxon_name", "")
            enrichment.wikipedia_url = taxon.get("wikipedia_url", "")

            # Extract photo URL (small square).
            default_photo = taxon.get("default_photo")
            if default_photo:
                enrichment.photo_url = default_photo.get("square_url", "")

            # Build ancestor chain for taxonomy mapping.
            ancestors = taxon.get("ancestor_ids", [])
            ancestor_details = taxon.get("ancestors", [])

            # The autocomplete endpoint may not include full ancestor objects.
            # If we have ancestor_ids but no ancestor details, fetch the full taxon.
            if ancestors and not ancestor_details:
                try:
                    taxon_resp = await client.get(
                        f"{INAT_TAXA_URL}/{taxon['id']}",
                        params={"locale": "en"},
                    )
                    taxon_resp.raise_for_status()
                    full_data = taxon_resp.json()
                    full_results = full_data.get("results", [])
                    if full_results:
                        ancestor_details = full_results[0].get("ancestors", [])
                except Exception:
                    logger.debug("iNat: failed to fetch full taxon for %s", species_name)

            enrichment.ancestors = ancestor_details

            # Derive BugLord category from taxonomy.
            # Also include the taxon itself (not just ancestors).
            taxon_chain = list(ancestor_details) + [{
                "rank": taxon.get("rank", ""),
                "name": taxon.get("name", ""),
            }]
            enrichment.buglord_category = taxon_to_buglord_category(taxon_chain)

    except httpx.TimeoutException:
        logger.warning("iNat: timeout looking up %r", species_name)
    except Exception as exc:
        logger.warning("iNat: error looking up %r: %s", species_name, exc)

    _cache[key] = enrichment
    return enrichment


# ---------------------------------------------------------------------------
# Batch enrichment
# ---------------------------------------------------------------------------
async def enrich_predictions(
    species_names: list[str],
) -> dict[str, InatEnrichment]:
    """
    Look up multiple species concurrently and return a ``{name: enrichment}``
    dict.  Cached entries are returned instantly.
    """
    tasks = {name: enrich_species(name) for name in set(species_names)}
    results = await asyncio.gather(*tasks.values(), return_exceptions=True)

    enrichments: dict[str, InatEnrichment] = {}
    for name, result in zip(tasks.keys(), results):
        if isinstance(result, InatEnrichment):
            enrichments[name] = result
        else:
            logger.warning("iNat: enrichment failed for %r: %s", name, result)
            enrichments[name] = InatEnrichment()

    return enrichments
