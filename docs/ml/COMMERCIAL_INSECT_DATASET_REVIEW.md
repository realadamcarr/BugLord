# Commercial insect dataset review

**Roadmap task:** `BL-AUTO-E3AAC9BA`
**Reviewed:** 2026-08-27
**Status:** Research complete; every source remains subject to BugLord's asset-level rights gate.

This review identifies insect image sources whose stated licences permit commercial reuse. It is an engineering provenance review, not legal advice or approval to train. An image enters `commercial-approved` only after it satisfies the manifest and review requirements in [BUGLORD_ML_V2_SPEC.md](./BUGLORD_ML_V2_SPEC.md), including confirmation that it did not originate on iNaturalist.

## Recommended source

| Source | Coverage and suitability | Published rights | Decision and conditions |
| --- | --- | --- | --- |
| [BIOSCAN-5M](https://github.com/bioscan-ml/BIOSCAN-5M) | More than 5 million specimens (98% insects), each with an RGB image, DNA barcode and partial hierarchical taxonomy. It supersets BIOSCAN-1M and offers original/cropped images at full and 256-pixel sizes. This is the only reviewed source broad enough to be a plausible primary classification corpus. It is heavily collection/specimen oriented rather than a field-photo match for BugLord, and its geographic and class distributions must be measured before choosing taxa. | The publisher identifies the image and metadata copyright holder as the CBG Photography Group and applies [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) to both. The exact packages and metadata version must be pinned; do not infer image rights from the repository's software licence. | **CONDITIONAL SHORTLIST.** The licence permits commercial reuse with attribution, but BugLord's existing policy keeps CC BY sources in `commercial-quarantine` until a rights reviewer accepts the attribution, database-right, source-terms and trained-weight treatment. Record the dataset version, package, source ID, CBG attribution and licence on every manifest row. Do not also ingest BIOSCAN-1M: the publisher states it overlaps BIOSCAN-5M, so combining them creates duplicates and incompatible predefined splits. |

Use BIOSCAN-5M as the first acquisition candidate, subject to rights sign-off. Prefer its original images when establishing the baseline; a crop generated upstream is a derivative with less scene context and should not silently substitute for the camera-like input expected by the app. No data was downloaded as part of this review.

## Narrow commercial-compatible supplements

These sources have commercial-capable licences, but they do not supply the taxonomic breadth needed for BugLord's primary classifier.

| Source | Content | Published rights | Decision |
| --- | --- | --- | --- |
| [Haly.ID](https://doi.org/10.5281/zenodo.20431348) | Orchard drone and stationary-camera imagery with bounding boxes for *Halyomorpha halys*. | CC BY 4.0 on the repository record. | **CONDITIONAL SUPPLEMENT.** Potential field-domain detection data for one pest species. Keep quarantined until file-level ownership, attribution, image/annotation scope and absence of iNaturalist-derived material are reviewed. Not a general classifier corpus. |
| [FAIRHiveFrames-1K](https://doi.org/10.5281/zenodo.19241078) | 1,265 annotated hive-frame images. | CC BY 4.0 on the repository record. | **CONDITIONAL SUPPLEMENT.** Potential honeybee/hive-domain data only. Confirm that the actual image archive is covered, capture attribution, and evaluate whether its task and framing match BugLord before intake. |
| [Wikimedia Commons](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia) | Field photographs can fill targeted gaps after the BugDex taxonomy is independently defined. Rights vary by file. | Only individual files marked CC0/public domain, CC BY, or (after counsel review) CC BY-SA are candidates. | **PER-ASSET INTAKE, NOT A DATASET APPROVAL.** Preserve the file revision URL, creator, exact licence/version, attribution and upstream source. Reject files with NC/ND terms, uncertain authorship, or iNaturalist provenance. |

## Considered but not commercially acceptable as-is

| Source/category | Decision | Reason |
| --- | --- | --- |
| iNaturalist exports, competition datasets, API media, and copies surfaced by aggregators | **REJECT** | Current iNaturalist terms prohibit its data from training commercial AI/ML systems. BugLord already treats any iNaturalist-origin asset as forbidden, regardless of the displayed Creative Commons tag. |
| GBIF bulk occurrence datasets | **REQUIRES PER-MEDIA REVIEW; NOT AN APPROVED DATASET** | GBIF explains that an occurrence dataset's licence does not necessarily cover its images. `multimedia.txt` exposes media-level licence, creator, rights-holder and source fields, which must all be checked. Exclude CC BY-NC, missing/unknown licences, and iNaturalist-origin media. A filtered, immutable GBIF download could become an intake mechanism later, not a blanket source approval. See [GBIF's licence guidance](https://docs.gbif.org/course-introduction-to-gbif/en/principles-of-gbif-mediated-data.html) and [download field definitions](https://techdocs.gbif.org/en/data-use/download-formats). |
| BIOSCAN-1M | **DO NOT COMBINE WITH BIOSCAN-5M** | Its images are also CC BY 3.0, but the publisher says its samples occur in BIOSCAN-5M and that the datasets have incompatible splits. It is a fallback only if the larger source cannot be operationally used. |
| IP102, Kaggle mirrors, Roboflow public projects, and Insect-1M/Insect-Foundation | **REJECT PENDING NEW EVIDENCE** | The materials reviewed did not provide a sufficiently clear, authoritative grant covering every source image for commercial ML training. Repository/code licences and public download access do not license the media. Do not use a mirror's licence as evidence of the original owner's rights. |
| Open-Insect | **REJECT AS A WHOLE** | Its published construction includes images under non-commercial Creative Commons licences. A future rebuild from independently verified commercial-capable originals would be a different, per-asset-reviewed dataset. |

## Required intake evidence

Before any candidate becomes an approved dataset version:

1. Pin the publisher record, dataset/package version, retrieval time, archive checksum and licence text/version.
2. Generate one source-image record conforming to `training/schemas/commercial_dataset_manifest.schema.json`; derived crops retain the source record through `parentImageId`.
3. Verify image ownership/licence separately from code, annotations, occurrence metadata and pretrained weights.
4. Confirm `originContainsINaturalistData: false`, including through upstream-source inspection rather than the immediate host name alone.
5. Have the designated rights reviewer decide attribution delivery, database rights, platform terms and downstream model treatment. Until then, set operational state to quarantine; the approved schema must not be populated with invented review values.
6. Measure taxonomic coverage, geographic/domain mismatch, duplicates and class balance before choosing the first dataset version. That is separate roadmap work and must follow an approved taxonomy decision.

## Outcome

BIOSCAN-5M is the recommended primary candidate. Haly.ID, FAIRHiveFrames-1K and selected Wikimedia Commons assets are possible narrow supplements. None is automatically approved by this document: the repository's existing review gate deliberately requires a named reviewer and asset-level evidence before commercial training.
