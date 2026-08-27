# First dataset candidate

**Roadmap task:** `BL-AUTO-0C64EBCE`
**Candidate version:** `buglord-bioscan-v0.1.0-candidate`
**Operational state:** `commercial-quarantine`

The first dataset version is a configuration candidate only. It identifies BIOSCAN-5M original full-resolution images as the proposed source, uses species labels provisionally, retains all upstream taxonomy fields, and preserves BIOSCAN-5M's official `split` assignments. It does not define or approve a BugLord taxonomy mapping.

The machine-readable configuration is [`training/datasets/buglord-bioscan-v0.1.0-candidate.json`](../../training/datasets/buglord-bioscan-v0.1.0-candidate.json). Its schema fixes acquisition and training authorization to `false`, so this candidate cannot be treated as an approved manifest or training input.

BIOSCAN-5M publishes its images and metadata under CC BY 3.0, with CBG Photography Group identified as copyright holder and attribution required. BugLord has not approved the rights position. Database rights, source terms, attribution implementation, and treatment of trained weights remain pending human rights review.

No dataset files were downloaded. The upstream package version, retrieval timestamp, and archive checksum therefore remain `null`; they must be pinned during a separately authorized acquisition. Promotion also requires asset records that pass the existing approved commercial manifest gate.
