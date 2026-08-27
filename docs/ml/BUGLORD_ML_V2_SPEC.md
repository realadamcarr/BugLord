# BugLord Commercial ML v2 Specification

Status: planning baseline (2026-08-16). This document is an engineering and provenance specification, not legal advice or an authorization to ingest data, download weights, train, or deploy a model.

## 1. Existing ML inventory

Status meanings: **ACTIVE** is on a production/runtime path; **LEGACY** preserves an older or non-commercial path; **EXPERIMENTAL** is incomplete research tooling; **UNUSED** has no current caller/artifact; **UNKNOWN** lacks enough evidence to establish provenance or use.

| Artifact | Status | Finding and realistic reuse |
| --- | --- | --- |
| `src/domain/classification/ClassificationResult.ts` and application/provider boundary | ACTIVE | Canonical app-facing boundary. Reuse it; extend deliberately for explicit taxonomic rank rather than leaking model labels into callers. |
| `backend/services/model_service.py` and `backend/Dockerfile` | ACTIVE / NON-COMMERCIAL | Loads `eva02_large_patch14_clip_336.merged2b_ft_inat21`, 336 px, through timm. Reuse the service lifecycle, byte decoding, top-k flow, and singleton shape only. Do not reuse the checkpoint, its labels, or its normalization without a separately approved replacement. |
| `backend/services/mapping_service.py`, `backend/data/*.json`, `category_map.py` | ACTIVE | Species/common-name/category mapping is structurally reusable after taxonomy/version review. Static maps are not training labels of record. |
| `backend/services/inat_service.py` | ACTIVE / METADATA ONLY | Taxonomy/public metadata enrichment is separate from inference. Keep it outside all dataset-building and training paths and re-check applicable API terms before release. |
| `assets/ml/model.tflite` (2,871,056 bytes; SHA-256 `0D2D73CFFDE1868DD68BDA7D9B12C76879BF6DC9E183A014557838371C844B98`) | ACTIVE / UNKNOWN PROVENANCE | Existing six-class local classifier used through the local provider. Preserve for current behavior, but do not treat it as approved commercial training lineage until its dataset, weights, license, and build record are recovered and reviewed. |
| `assets/ml/labels.json`, `labels.txt`, `src/ml/labels.ts` | ACTIVE | Six broad labels: bee, butterfly, beetle, fly, spider, ant. Reusable as the current broad-category vocabulary, subject to product taxonomy review. |
| `src/ml/bugClassifier.ts`, `preprocessImage.ts`; `services/ml/*` | ACTIVE / LEGACY MIX | Runtime preprocessing, model loading/update concepts, and stable return mapping are reusable. Consolidation is outside this planning task. |
| `training/train_model.py` | LEGACY / EXPERIMENTAL | MobileNetV2/ImageNet transfer learning, augmentation, two-phase fitting, TFLite conversion, labels, history, and deployment metadata. Reuse the orchestration ideas only; random directory splitting and unreviewed ImageNet weights are not acceptable for v2. |
| `training/evaluate_model.py` | LEGACY / UNUSED | Hard-coded local paths; reports aggregate metrics, per-class results, and confusion matrix. Reuse metric concepts, not its split reconstruction or hard-coded model. |
| `training/fetch_inaturalist_data.py` | NON-COMMERCIAL / LEGACY | Downloads iNaturalist images for classification. Historical FYP use only; prohibited from commercial ML inputs and now marked in-file. |
| `training/fetch_inaturalist_detection.py` | NON-COMMERCIAL / LEGACY | Downloads iNaturalist images and generates heuristic COCO boxes. Historical FYP use only; prohibited from commercial ML inputs and now marked in-file. Heuristic center boxes are also unsuitable as a benchmark. |
| `training/efficientdet_lite0_train.py` | EXPERIMENTAL | COCO validation, training/export, and metadata concepts are reusable for a future detector. Its image-level random split must be replaced by grouped leakage-safe splits. |
| `training/train_detector.py` | EXPERIMENTAL / UNUSED | SSD MobileNet TF Object Detection API scaffold; depends on an absent optional `models/research` checkout and an unreviewed COCO/ImageNet-derived checkpoint. Config/export ideas only. |
| `training/train_simple_detector.py` | EXPERIMENTAL / UNUSED | Simplified regressor with ImageNet MobileNetV2. Not a production detector; preprocessing scaffolding only. |
| `training/convert_to_tflite.py` | EXPERIMENTAL | SavedModel conversion smoke test is reusable. Its random representative data is inadequate for full-integer calibration; approved representative images are required. |
| `training/yolov5_insect_train.py` | LEGACY / NON-COMMERCIAL-UNVERIFIED | Downloads a Kaggle dataset, clones YOLOv5, trains, exports, and overwrites the app model. Dataset and weight rights are not documented; exclude from the commercial pipeline unless independently reviewed. |
| Training guides under `training/` and `docs/ml/` | LEGACY | Useful historical workflow notes, but several recommend iNaturalist, Kaggle, Roboflow, or pretrained weights without per-asset commercial provenance. They are not v2 instructions. |
| `training/requirements.txt` | LEGACY | TensorFlow 2.15-era stack. Pinning concepts are reusable; create a fresh, locked v2 environment only after architecture selection. |
| Datasets, caches, checkpoints, notebooks, logs, generated confusion matrices | ABSENT | None found in the repository checkout. No evidence was available to approve prior data or reproduce the tracked TFLite artifact. |
| Root `models/` | ABSENT / LEGACY METADATA HISTORY | The previously malformed gitlink is no longer tracked and the directory is absent. Machine setup docs describe an optional ignored TensorFlow Models checkout pinned to `9aa98a39b592cdcf2dfbd68ee7f60b8de57423b8`. No repair is part of this phase. |

## 2. Existing training pipeline

Three disconnected historical paths exist:

1. Broad classification: download class folders, use Keras `ImageDataGenerator`, fine-tune ImageNet MobileNetV2, export TFLite and labels.
2. Object detection: create approximate COCO annotations, then use EfficientDet-Lite0, TensorFlow Object Detection SSD MobileNet, or a simple Keras box regressor and export TFLite.
3. YOLOv5 classification: download a third-party Kaggle dataset, clone an external repository, train, export, and copy over `assets/ml/model.tflite`.

None records an immutable input manifest, asset-level rights decision, taxonomy snapshot, group-safe split, environment lock, source revision, full evaluation artifact, or model card. Consequently none is a reproducible commercial v2 pipeline as written. Reusable pieces are image decoding/augmentation patterns, timestamped outputs, callbacks, TFLite conversion, label emission, and basic confusion-matrix reporting.

## 3. Legacy/non-commercial dependencies

The current [iNaturalist Terms of Use](https://www.inaturalist.org/pages/terms) expressly prohibit use of iNaturalist data for training commercial AI/ML systems. Therefore:

- iNaturalist images, Open Data, competition datasets, and any iNaturalist-origin copy obtained through an aggregator are forbidden inputs to commercial v2 training, validation, testing, calibration, or distillation.
- `fetch_inaturalist_data.py` and `fetch_inaturalist_detection.py` are historical **NON-COMMERCIAL / LEGACY** tools and must never write to an approved dataset root.
- The active EVA02 iNat21 weights are reference-only and cannot ship as the commercial species model. Their model card is also [CC BY-NC 4.0](https://huggingface.co/timm/eva02_large_patch14_clip_336.merged2b_ft_inat21).
- iNaturalist taxonomy/metadata lookup may remain a separate runtime integration only where the then-current terms and API policy permit it. It must not become a route for retaining training media.
- Historical Kaggle/Roboflow suggestions are **REQUIRES REVIEW**. Public downloadability is not commercial ML permission.

Required storage separation:

```text
datasets/
  noncommercial-research/   # historical/FYP only; never mounted by commercial jobs
  commercial-quarantine/    # acquired but not yet approved; no training access
  commercial-approved/      # immutable manifests plus only manually approved assets
  benchmark-sealed/         # access-controlled final benchmark, unavailable to training jobs
```

Commercial jobs must accept only a reviewed manifest under `commercial-approved/`, reject records whose origin includes iNaturalist, and fail closed when a rights field is missing. Separate storage credentials and CI/job permissions should enforce the boundary, not directory naming alone.

## 4. Product requirements

Given one user photograph, v2 must determine whether it contains a supported insect/arthropod and return the most specific defensible identification. It must optimize against confidently wrong identifications, not force a species.

Required model/service evidence:

- ranked species candidates with calibrated scores;
- stable taxonomic identifiers and ancestry (species, genus, family);
- a broad BugLord category score/mapping;
- in-distribution/support coverage and image-quality evidence;
- rejection evidence sufficient to distinguish no insect, unsupported taxon, ambiguity, poor image, and provider failure;
- model, taxonomy, dataset-manifest, and calibration versions for observability.

The current `ClassificationResult` already carries ranked predictions, confidence, category, accepted/low-confidence state, and failure reasons. A later contract version should add explicit `resolvedRank`, genus/family fields and IDs, coverage/quality rejection reason, and model/taxonomy versions. Until that version is designed and tested, the provider may map a species acceptance into existing species fields and map genus/family/unknown into a truthful display label with `speciesName: null`; callers must never infer a species from that label.

## 5. Taxonomic output strategy

Train or derive consistent probabilities over the supported hierarchy. The resolver walks from most to least specific:

1. Return **species** only when calibrated species acceptance, minimum top-1 margin, image quality, coverage, and ancestor consistency gates pass.
2. Otherwise aggregate descendant probability and return **genus** when its calibrated gate and coverage pass.
3. Otherwise return **family**, then **BugLord category**, under separately calibrated gates.
4. Otherwise return **unknown / insufficient confidence**.

Species candidates must share the selected ancestor or the resolver must back off. Taxonomy must be versioned; synonyms resolve to a canonical taxon ID while retaining the submitted/source label. Thresholds are rank-, class-support-, and model-version-specific configuration learned only on validation data, never constants chosen from the benchmark.

## 6. Unknown/rejection strategy

Rejection is a successful product outcome. The service must reject at least:

- no arthropod or no usable subject;
- unsupported geography/taxon;
- low maximum calibrated probability;
- insufficient top-candidate margin or conflicting ancestors;
- blur, extreme crop, occlusion, poor lighting, or insufficient pixels;
- out-of-distribution evidence;
- provider/model failure (kept distinct from biological uncertainty).

Use a held-out negative set, unsupported-taxa set, hard visually similar groups, and mobile-quality corruptions. Compare simple calibrated maximum-probability/margin gates with an energy or embedding-distance OOD score; adopt complexity only if it improves rejection on isolated validation data. Never convert a network softmax directly into a user-facing certainty claim.

## 7. Evaluation metrics

All metrics below are **MUST MEASURE** on validation and the sealed benchmark, overall and sliced by taxon support, source, geography, device/camera quality, and image-quality bucket:

- top-1 and top-5 species accuracy on supported, species-labelled examples;
- genus, family, and BugLord-category accuracy, including hierarchical distance/cost;
- coverage versus selective risk at every resolved rank;
- unknown/rejection precision, recall, F1, false-accept rate, false-reject rate, AUROC and AUPRC on known-vs-unknown sets;
- calibration via reliability diagrams, expected calibration error, classwise ECE, Brier score, and negative log likelihood;
- per-class precision/recall/F1/support, macro F1, and confusion matrices at each rank;
- top confusions and curated visually similar species-pair/group performance;
- blur, compression, low light, small subject, occlusion, crop, rotation, and representative mobile-camera slices;
- latency distributions (p50/p95/p99), peak memory, model size, throughput, cold start, and server cost per accepted request;
- equivalent metrics before/after ONNX/TFLite conversion and quantization, including prediction drift.

Numerical release targets are **TARGET TO BE ESTABLISHED AFTER BASELINE**. The first approved baseline supplies evidence for product and safety owners to set rank-specific accuracy, selective-risk, calibration, latency, memory, and cost gates. No percentage in this plan is a promised target.

## 8. Dataset provenance requirements

Every original image must have one immutable manifest record before preprocessing. Required fields are internal image ID, source, canonical source URL/ID, creator, exact license and URL/version, required attribution, retrieval timestamp, canonical taxon label and stable taxon ID, assigned split, SHA-256, manual commercial-ML verification, reviewer/time, upstream-origin declaration, and notes. Also capture perceptual hash, observation/group ID, photographer burst ID, and parent image ID for leakage control.

Approval is per asset, not per website. A reviewer must check copyright, license scope/version, attribution/share-alike obligations, source/platform terms, database rights, privacy/people/location concerns, label authority, and whether the asset originated on iNaturalist. Missing or uncertain evidence goes to quarantine as **REQUIRES REVIEW**, never to training.

The machine-readable approved-manifest contract is `training/schemas/commercial_dataset_manifest.schema.json`. It intentionally requires `commercialMlUseVerified: true`, `rightsReviewStatus: "approved"`, named review evidence, and `originContainsINaturalistData: false`.

## 9. Dataset manifest schema

Illustrative record (values are examples, not an approved source):

```json
[
  {
    "internalImageId": "img_01J...",
    "source": "buglord-owned",
    "sourceIdentifier": "asset-contract-123/image-7",
    "creator": "Example Photographer",
    "license": "BugLord commercial training grant",
    "licenseUrl": null,
    "licenseVersion": "2026-01",
    "attributionText": null,
    "retrievedAt": "2026-08-16T12:00:00Z",
    "taxonLabel": "Example species",
    "taxonomicId": "taxonomy:123",
    "split": "train",
    "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "perceptualHash": "example-only",
    "observationGroupId": "capture-123",
    "photographerBurstId": "burst-45",
    "parentImageId": null,
    "commercialMlUseVerified": true,
    "rightsReviewStatus": "approved",
    "rightsReviewer": "reviewer-id",
    "rightsReviewedAt": "2026-08-16T12:30:00Z",
    "originContainsINaturalistData": false,
    "notes": "Example structure only; not an approval record."
  }
]
```

Derived crops and augmentations inherit the original record through `parentImageId` and remain in the parent's split. Dataset releases must pin the manifest checksum, taxonomy version, deduplication version, and rights-review snapshot.

## 10. Candidate legal data-source categories

Preferred order, always subject to per-asset review:

1. BugLord-owned commissioned photography with written commercial ML training, model-output, sublicensing/deployment, retention, and attribution terms.
2. Future BugLord submissions under explicit, informed, optional commercial ML training consent; product use must not imply training consent, and withdrawal/retention handling must be designed before collection.
3. Explicitly commercially licensed biodiversity datasets/contracts with warranties or sufficiently clear provenance and downstream model rights.
4. Government works confirmed public domain for the specific jurisdiction and asset, with the originating agency—not an aggregator—recorded.
5. CC0/public-domain media with verified origin.
6. Carefully selected Wikimedia Commons files whose per-file licenses permit the intended use, with creator/license/attribution captured and source/platform/database questions reviewed.

CC BY and CC BY-SA candidates remain **REQUIRES REVIEW** until counsel decides attribution, adaptation/share-alike, database-right, platform-term, and trained-weight implications. Aggregated collections are not approved merely because each row displays a permissive tag. Any iNaturalist-origin asset remains excluded even if surfaced elsewhere.

## 11. Candidate model architecture families

Architecture evaluation starts from randomly initialized code or a separately approved checkpoint. Approximate resource figures must be benchmarked on BugLord hardware; they are comparison inputs, not promises.

| Family | Typical role | Resolution / scale | Export and suitability | Initial assessment |
| --- | --- | --- | --- | --- |
| MobileNetV3 Large (or a similarly mature mobile CNN) | on-device category/quality baseline | commonly 224 px; roughly 5M parameters depending on head | TensorFlow/TFLite is mature; PyTorch can export to ONNX. Best mobile candidate, likely insufficient alone for fine-grained species. | SHORTLIST for local baseline; approved weights required or train from scratch. |
| EfficientNetV2-S / EfficientNet-B family | efficient server species baseline; possible compressed device model | roughly 224–384 px depending variant; tens of millions of parameters | TensorFlow and PyTorch implementations; TFLite/ONNX feasibility must be verified for chosen graph. Favorable accuracy/compute baseline. | SHORTLIST for server baseline. |
| ConvNeXt Tiny/Small | stronger conventional server baseline | 224–384 px; Tiny has 28.6M parameters and 4.46 GFLOPS at 224 px in TorchVision | Straightforward PyTorch training and ONNX candidate; server-first due to size/compute. | SHORTLIST for server baseline. |
| Swin Tiny/Small or compact ViT | fine-grained comparison | typically 224–384 px; attention cost and export behavior vary | Server-suitable; ONNX operators and dynamic shapes require an export spike. Higher data/regularization demands. | EVALUATE after CNN baselines. |
| EVA02-like large vision transformer | performance ceiling/reference only | current model uses 336 px and a large checkpoint (~1.26 GB safetensors) | High memory, latency, cold-start, and hosting cost; unsuitable for initial device deployment. | REFERENCE ONLY; current weights forbidden for commercial v2. |

The selected model should support hierarchical heads or a species head with deterministic taxonomy aggregation, calibrated rejection, mixed precision, reproducible training, and clean ONNX export. PyTorch's official exporter supports conversion of `nn.Module` graphs to ONNX, but each exact architecture still needs parity tests ([PyTorch ONNX documentation](https://docs.pytorch.org/tutorials/beginner/onnx/intro_onnx.html)).

## 12. Model/checkpoint licensing considerations

Code license, checkpoint license, and training-data rights are independent decisions.

| Candidate implementation/checkpoint | Code license | Weight license | Reported pretraining data | Decision |
| --- | --- | --- | --- | --- |
| timm architecture code with `pretrained=False` | Apache-2.0 for timm code, subject to dependencies/source notices | none loaded | BugLord-approved data only | Candidate after dependency/legal review and reproducible source pin. |
| timm/TorchVision default MobileNet, EfficientNet, ConvNeXt, Swin, or ViT weights | permissive framework code | varies by exact checkpoint | commonly ImageNet-1K/21K; exact card required | **REQUIRES REVIEW**. timm itself warns ImageNet was released for non-commercial research and advises legal review of commercially used weights ([timm licensing notes](https://github.com/huggingface/pytorch-image-models#licenses)). |
| Existing EVA02 iNat21 checkpoint | timm code Apache-2.0 | CC BY-NC 4.0 model card | merged pretraining plus iNaturalist-2021 fine-tuning | **DO NOT USE** for commercial v2; reference behavior only. |
| DINO/CLIP/foundation vision checkpoint | implementation-specific | checkpoint-specific | frequently web-scale, curated, or incompletely disclosed | **REQUIRES REVIEW** unless the exact weight artifact has a documented commercial grant and acceptable data provenance. |
| Training from random initialization | selected implementation license | BugLord owns resulting artifact subject to inputs/contracts | approved manifest only | Cleanest provenance option, but compute/data needs and quality risk must be baselined. |
| Bespoke pretraining by a contracted provider | contract and implementation-specific | must be assigned/licensed expressly | contractually enumerated approved manifest | Preferred transfer option if provenance, audit rights, deletion, and output ownership are adequate. |

For each experiment record architecture source/revision, code and dependency licenses, exact checkpoint URI/hash, checkpoint license text/version, all reported pretraining/fine-tuning datasets, restrictions, reviewer, and decision. A permissive repository license never automatically approves weights.

## 13. Server vs on-device analysis

| Strategy | Benefits | Costs/risks |
| --- | --- | --- |
| A. Full server species classifier | largest feasible model/resolution; rapid updates; centralized calibration, abuse controls, and monitoring | network dependency, upload privacy/security, latency, GPU/CPU cost, cold start, availability, abuse surface |
| B. Full on-device species classifier | offline/private, no inference hosting, predictable availability | model/label size, RAM/thermal constraints, slower rollout, device fragmentation, extraction risk, difficult worldwide taxonomy and calibration updates |
| C. Hybrid local validation/category + server species hierarchy | preserves offline six-class/category experience, rejects obvious failures before upload, and keeps the accurate/updateable model server-side | two models can disagree; local artifact provenance is currently unknown; requires versioned contracts, privacy controls, and explicit fallback UX |

Recommendation: **C, hybrid**, initially. Keep current runtime behavior until replacements are approved. Develop a provenance-clean local broad-category/quality gate and a server-side hierarchical species classifier. When offline, return only a clearly labelled broad category or unknown—never simulate a species. Server endpoints need authentication/rate limits, size/type limits, timeouts, observability without retaining user media by default, and a documented deletion policy. Re-evaluate full on-device species inference only after the MVP taxonomy, quantized size, latency, and parity benchmarks exist.

## 14. Recommended initial geographic/taxonomic scope

Use a staged **Ireland/UK-first** supported species list, expanded only where approved data and expert-labelled benchmarks are adequate. This aligns initial acquisition and field validation with likely accessible ecology while containing class count, similar-species review, and rights work. It is not a claim that all Ireland/UK arthropods are immediately supportable.

Build coverage family by family based on approved-image count, seasonal/life-stage representation, protected/sensitive-species considerations, and expert validation. Out-of-scope worldwide taxa and under-supported local taxa belong in unknown/genus/family/category evaluation. A geography hint may adjust coverage priors but must not override visual evidence or assert that a photographed captive/imported insect is impossible.

## 15. Proposed training pipeline

1. Define a versioned canonical taxonomy and minimum supported-taxon evidence policy.
2. Ingest originals only into quarantine; virus/type/decode checks run before human access.
3. Create manifest records and conduct per-asset provenance, origin, license, privacy, and label review.
4. Promote immutable approved originals and signed manifest snapshot to separate storage; training jobs have read-only access to approved storage only.
5. Normalize labels against the taxonomy; retain original labels and reviewer evidence.
6. Compute cryptographic hashes, perceptual hashes, embeddings, source IDs, observation IDs, and burst groups; quarantine conflicts and duplicates.
7. Assign entire groups to train/validation/test before cropping or augmentation, stratified as feasible by taxonomy/source/geography/quality.
8. Generate derived crops/augmentations at training time or record parent lineage; never split derivatives independently.
9. Train reproducibly from an approved initialization with locked environment, seed, code revision, manifest checksum, taxonomy version, configuration, and experiment log.
10. Fit rank-specific calibration and rejection thresholds on validation only.
11. Export candidate ONNX/TFLite artifacts; verify numeric and decision parity against the native model.
12. Produce signed model card, metrics, confusion analysis, rights bill of materials, hashes, and release decision. Deployment is a separate reviewed step.

## 16. Proposed evaluation pipeline

Freeze a development test set early and a smaller access-controlled benchmark before model selection. Group assignment precedes all transformations:

- same original/source observation, photographer burst, video sequence, crop, resized copy, watermark variant, and augmentation must share one split;
- exact SHA-256 catches identical bytes; normalized-pixel hash catches metadata/re-encoding variants; pHash/dHash and embedding-neighbor search flag near duplicates for review;
- detect cross-source duplicates so an aggregator copy cannot cross a split or hide prohibited origin;
- similarity thresholds are versioned and manually audited around the boundary;
- benchmark labels receive independent expert review and adjudication; training code/service accounts cannot read benchmark media;
- threshold selection, calibration, architecture choice, and error-driven data acquisition use validation only; benchmark access is release-gated and logged.

Evaluation emits machine-readable metrics, confusion matrices, reliability plots, failure galleries using authorized internal access, slice tables, latency/memory/cost reports, and native/export parity. It must also test the canonical `ClassificationResult` mapping and hierarchical resolver independently of infrastructure.

## 17. Compute requirements to investigate

Run cheap profiling before any full training:

- approved dataset size and class/quality imbalance after deduplication;
- batch-size/activation-memory curves at 224, 288, 336, and 384 px for shortlisted families;
- one-epoch throughput and peak GPU memory with mixed precision and gradient accumulation;
- convergence gap between random initialization and any legally approved initialization;
- CPU and candidate GPU p50/p95 inference, cold load, concurrent throughput, RAM/VRAM, and autoscaling floor;
- ONNX Runtime performance and export parity; TFLite quantization size, representative calibration needs, device latency, RAM, and thermal impact;
- storage/egress, preprocessing, annotation/review, and inference cost per accepted classification.

GPU type/count, training hours, dataset scale, hosting topology, and monthly budget are **TBD after baseline**. Do not reserve expensive compute based on architecture names alone.

## 18. Open questions

- Who owns final rights approval and what legal standard must a checkpoint/dataset meet?
- What exact Ireland/UK taxon list, taxonomy authority/version, and life stages are commercially useful and labelable?
- Can the tracked six-class TFLite model's original data, weights, licenses, and build be recovered? If not, when must it be replaced?
- Which user geographies, privacy/retention rules, consent wording, deletion workflow, and age restrictions apply to future opt-in submissions?
- Which rank-specific mistakes are highest harm, and how should selective risk weight them?
- What expert annotation/adjudication capacity exists for similar species and unknowns?
- Are CC BY/CC BY-SA assets and trained artifacts acceptable under counsel's interpretation and BugLord's attribution/product design?
- What latency, offline, model-size, server-cost, and availability budgets should baseline experiments measure against?
- Should object localization remain heuristic/camera crop, use a separate approved detector, or be learned jointly later?
- How will taxonomy/model updates preserve result reproducibility and previously collected Bugdex records?

## 19. Recommended first implementation task

Implement a **commercial dataset intake gate**, without downloading media or training:

1. add a small validator for `training/schemas/commercial_dataset_manifest.schema.json`;
2. create empty/placeholder directory documentation for quarantine, approved, non-commercial research, and sealed benchmark storage;
3. make the validator fail on missing review evidence, non-approved status, invalid hashes, or any iNaturalist origin;
4. add unit fixtures containing synthetic metadata only (one approved, each rejection reason); and
5. add the validator tests to CI.

This is the smallest next step that turns the licensing boundary into an enforceable control and provides a safe foundation for later acquisition and architecture baselines. It must not fetch images, load pretrained weights, train, or alter production inference.
