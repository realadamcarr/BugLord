# BIOSCAN v0.1 image acquisition approval

**Decision:** Approved under review task `BL-AUTO-E5122207` for the 343,333 metadata-eligible
rows in the official BIOSCAN `train`, `val`, and `test` splits.

The approval is limited to `BIOSCAN_5M_cropped_256.zip` in the publisher's
`bioscan-ml/BIOSCAN-5M` Hugging Face dataset. The immutable revision is
`eeefb301c2594124090842049cc38a0b0c7b2ecb`; the archive is 39,119,785,806 bytes with SHA-256
`609883a5a840d99f7ea3bd56f4c4f7739ee9fbe27e1e07b218c6ddbfee91eb2f`.

Acquisition must use Hugging Face Hub/Xet with its default adaptive concurrency. The
`HF_XET_HIGH_PERFORMANCE` mode is prohibited on the 32 GB acquisition machine. Valid Hub/Xet
cache content may be reused. The pipeline must retain checksum and size verification, provenance,
safe selective extraction, structural image validation, exact duplicate and cross-split leakage
detection, deterministic manifests, and dataset statistics. Official split assignments must not
be regenerated or changed.

At least 20 GiB must remain free after each acquisition write. Any material transfer or storage
problem must stop closed for review. This approval does not cover any other BIOSCAN package,
pretrained checkpoint, model training, taxonomy changes, or production deployment.
