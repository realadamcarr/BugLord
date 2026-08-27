# BIOSCAN v0.1 acquisition and preparation

`training/prepare_bioscan_v0_1.py` turns the rights-reviewed BIOSCAN-5M original
full-resolution package into an auditable, training-ready local dataset. It does not download
anything unless an operator supplies both the current upstream URL and its independently recorded
SHA-256 checksum. This avoids treating a mutable Google Drive link as a pinned dataset version.

## Workflow

1. Obtain the metadata and the five `BIOSCAN_5M_original_full` archives from the BIOSCAN-5M
   publisher. Record the upstream version, URLs, retrieval time, and published or independently
   verified checksums in the acquisition record.
2. Acquire each asset atomically:

   ```powershell
   python training/prepare_bioscan_v0_1.py acquire --url <upstream-url> --sha256 <64-hex-digest> --output training/dataset-bioscan-v0.1/raw/<filename>
   ```

3. Extract each verified archive. ZIP traversal paths are rejected:

   ```powershell
   python training/prepare_bioscan_v0_1.py extract training/dataset-bioscan-v0.1/raw/<archive.zip> --output training/dataset-bioscan-v0.1/images
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
