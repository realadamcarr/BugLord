"""
Static data: BugLord categories and the keyword → category mapping table.

This module is the single source of truth for which ImageNet / timm labels
map to which BugLord in-game category.  Extend ``KEYWORD_MAP`` when new
species are added to the model's coverage.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Canonical BugLord categories recognised by the React Native client
# ---------------------------------------------------------------------------
BUGLORD_CATEGORIES: list[str] = [
    "bee",
    "butterfly",
    "beetle",
    "fly",
    "spider",
    "ant",
]

# ---------------------------------------------------------------------------
# Keyword → BugLord category mapping
#
# Keys are lowercase sub-strings that can appear anywhere in a timm /
# ImageNet class label.  Values are the canonical BugLord category.
# Order matters: first match wins, so put more-specific strings first.
# ---------------------------------------------------------------------------
KEYWORD_MAP: dict[str, str] = {
    # ── Bees & wasps ─────────────────────────────────────────────────
    "honeybee": "bee",
    "honey bee": "bee",
    "bumblebee": "bee",
    "bumble bee": "bee",
    "bee": "bee",
    "wasp": "bee",
    "yellowjacket": "bee",
    "hornet": "bee",

    # ── Butterflies & moths ──────────────────────────────────────────
    "butterfly": "butterfly",
    "monarch": "butterfly",
    "swallowtail": "butterfly",
    "cabbage butterfly": "butterfly",
    "ringlet": "butterfly",
    "lycaenid": "butterfly",
    "sulphur butterfly": "butterfly",
    "admiral": "butterfly",
    "moth": "butterfly",
    "silkworm": "butterfly",

    # ── Beetles ──────────────────────────────────────────────────────
    "beetle": "beetle",
    "ladybug": "beetle",
    "ladybird": "beetle",
    "weevil": "beetle",
    "long-horned beetle": "beetle",
    "leaf beetle": "beetle",
    "ground beetle": "beetle",
    "dung beetle": "beetle",
    "rhinoceros beetle": "beetle",
    "tiger beetle": "beetle",
    "cockroach": "beetle",

    # ── Flies ────────────────────────────────────────────────────────
    "fly": "fly",
    "housefly": "fly",
    "damselfly": "fly",
    "dragonfly": "fly",
    "crane fly": "fly",
    "robber fly": "fly",
    "mosquito": "fly",
    "midge": "fly",
    "gnat": "fly",

    # ── Spiders & arachnids ─────────────────────────────────────────
    "spider": "spider",
    "tarantula": "spider",
    "black widow": "spider",
    "garden spider": "spider",
    "wolf spider": "spider",
    "barn spider": "spider",
    "tick": "spider",
    "scorpion": "spider",
    "harvestman": "spider",

    # ── Ants ─────────────────────────────────────────────────────────
    "ant": "ant",
    "carpenter ant": "ant",
    "fire ant": "ant",
    "termite": "ant",
}
