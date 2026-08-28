# BIOSCAN v0.1 acquisition and preparation

`training/prepare_bioscan_v0_1.py` turns the rights-reviewed BIOSCAN-5M `cropped_256`
package into an auditable, training-ready local dataset. Acquisition uses the Hugging Face Hub
client and its Xet transfer backend. It requires an immutable Hub revision plus an independently
recorded SHA-256 checksum, avoiding mutable branches or Google Drive links as dataset versions.

## Workflow

Before image acquisition is approved, generate the eligibility report from the publisher's
checksum-verified metadata CSV alone:

```powershell
python training/prepare_bioscan_v0_1.py eligibility-report --metadata <metadata.csv> --metadata-url <pinned-source-url> --output docs/ml/BIOSCAN_V0_1_ELIGIBILITY_REPORT.json
```

This streaming report checks the required `processid`, `species`, and official `split` values,
counts eligible rows and distinct species by split, and records the CSV SHA-256. It never opens or
downloads an image archive and cannot start training. Image presence, integrity, pixel duplicates,
and leakage remain explicit limitations for the subsequent acquisition review.

1. Use only the approved `BIOSCAN_5M_cropped_256.zip` archive from the BIOSCAN-5M
   publisher's Hugging Face dataset repository. It is pinned by the acquisition approval to commit
   `eeefb301c2594124090842049cc38a0b0c7b2ecb`, 39,119,785,806 bytes, and SHA-256
   `609883a5a840d99f7ea3bd56f4c4f7739ee9fbe27e1e07b218c6ddbfee91eb2f`.
2. Acquire each asset through `huggingface_hub`. Current clients install and use `hf_xet`
   automatically:

   ```powershell
   python training/prepare_bioscan_v0_1.py acquire --repo-id bioscan-ml/BIOSCAN-5M --filename <Hub-path> --revision <commit> --sha256 <64-hex-digest> --bytes <published-size> --output training/dataset-bioscan-v0.1/raw/<filename>
   ```

   The command enforces the [image acquisition approval](./BIOSCAN_V0_1_ACQUISITION_APPROVAL.md),
   rejects unrelated assets and high-performance Xet mode, and preserves at least 20 GiB of free
   space. Xet's default adaptive concurrency and valid local Hub/Xet caches remain available.

   To benchmark an actual transfer, add `--force-download` and
   `--benchmark-output <report.json>`. The receipt records elapsed seconds and MiB/s. Run this on
   the intended acquisition machine; forced benchmarks consume the full asset bandwidth and Xet
   can still reuse its local chunk cache. `HF_XET_HIGH_PERFORMANCE=1` may be set for a second run
   to measure the high-performance mode on suitable hardware.

   The checked-in [benchmark receipt](./BIOSCAN_HF_XET_BENCHMARK.json) is a real forced transfer
   of the checksum-pinned 2.07 GB metadata archive on the development machine with Xet
   high-performance mode enabled. It measured 1.326 MiB/s over 1,485.59 seconds. Treat this as a
   machine/network baseline, not a universal Hub performance claim; image acquisition remains
   subject to its separate review gate.

3. Selectively extract only metadata-eligible train/validation/test images from each verified
   archive. ZIP traversal paths are rejected:

   ```powershell
   python training/prepare_bioscan_v0_1.py extract training/dataset-bioscan-v0.1/raw/<archive.zip> --metadata training/dataset-bioscan-v0.1/raw/bioscan5m/metadata/csv/BIOSCAN_5M_Insect_Dataset_metadata.csv --splits train,val,test --output training/dataset-bioscan-v0.1/images
   ```

4. Prepare the supervised baseline splits:

   ```powershell
   python training/prepare_bioscan_v0_1.py prepare --metadata training/dataset-bioscan-v0.1/raw/metadata.csv --images training/dataset-bioscan-v0.1/images --output training/dataset-bioscan-v0.1/prepared --retrieved-at <ISO-8601-UTC-time>
   python training/validate_dataset_manifest.py training/dataset-bioscan-v0.1/prepared/manifest.json
   ```

The default split selection is `train,val,test`. Other official split names may be explicitly
selected with `--splits`. Original assignments remain in the report and every manifest record;
`val` maps to the canonical manifest value `validation`, unseen splits to `benchmark`, and
unlabelled/held-out splits to `quarantine`. No BugDex taxonomy mapping is performed.

The preparation step verifies each image, computes its SHA-256, rejects missing or ambiguous
files, rejects exact duplicates (including split leakage), copies accepted images without pixel
modification into source-split directories, writes `manifest.json`, and writes a complete
`preparation-report.json`. Class directory names are stable hashes of source species labels so
untrusted labels cannot become paths; the original labels remain in the manifest. Large downloaded
and prepared assets stay excluded by `.gitignore`.

Run the pipeline tests with:

```powershell
python -m unittest training.tests.test_prepare_bioscan_v0_1
```
