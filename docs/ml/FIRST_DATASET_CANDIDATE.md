# First dataset candidate

**Roadmap task:** `BL-AUTO-0C64EBCE`
**Candidate version:** `buglord-bioscan-v0.1.0-candidate`
**Operational state:** `internal-training-approved`

The first dataset version is a configuration candidate only. It identifies BIOSCAN-5M original full-resolution images as the proposed source, uses species labels provisionally, retains all upstream taxonomy fields, and preserves BIOSCAN-5M's official `split` assignments. It does not define or approve a BugLord taxonomy mapping.

The machine-readable configuration is [`training/datasets/buglord-bioscan-v0.1.0-candidate.json`](../../training/datasets/buglord-bioscan-v0.1.0-candidate.json). Following the commercial-rights review recorded in [BIOSCAN-5M commercial rights review](./BIOSCAN_5M_COMMERCIAL_RIGHTS_REVIEW.md), its schema authorizes internal acquisition and model training. Promotion still requires provenance-complete asset records under the approved commercial manifest gate.

BIOSCAN-5M images and metadata are approved for those internal uses under CC BY 3.0. Every acquired and derived record must retain the CBG Photography Group copyright notice, attribution to CBG Photography Group and the Centre for Biodiversity Genomics, the licence reference, source URLs/identifiers, and modification history. BugLord must not claim ownership of the source dataset or imply endorsement.

This approval excludes BIOSCAN-provided pretrained checkpoints and models. Treatment of BugLord-trained weights remains a residual legal/governance review required before public commercial release, but does not block internal training.

No dataset files were downloaded. The upstream package version, retrieval timestamp, and archive checksum therefore remain `null`; they must be pinned during a separately authorized acquisition. Promotion also requires asset records that pass the existing approved commercial manifest gate.
