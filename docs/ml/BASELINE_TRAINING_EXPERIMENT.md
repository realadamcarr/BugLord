# Baseline training experiment

The first BugLord-owned classifier experiment is defined by
`training/experiments/bioscan_efficientnet_b0_baseline.json`. It uses an
EfficientNet-B0 initialized from scratch (no pretrained checkpoint), 224 x 224
inputs, batch size 32, AdamW at a `3e-4` learning rate and `0.01` weight decay,
standard cross-entropy, AMP, and seed 42. Training is capped at 30 epochs with
early stopping after five epochs without validation-loss improvement.

The configuration points to the internally approved BIOSCAN-5M candidate and preserves
the source `split` field and every published split value. `train` and `val` are
the training and early-stopping splits; metrics are reported separately for
each remaining source split. Reports must contain top-1 accuracy, top-5
accuracy, macro-F1, and a confusion matrix. Class labels come from the source
`species` field; this experiment does not create or approve a BugLord taxonomy.

Validate the definition with:

```powershell
python training/validate_baseline_experiment.py
```

A future training runner must perform the authorization preflight:

```powershell
python training/validate_baseline_experiment.py --request-training
```

Following the completed BIOSCAN-5M rights review, the referenced dataset has
`controls.trainingAuthorized: true`, so this preflight succeeds for internal
training. Acquisition must still populate the required provenance manifest.
The experiment starts from random initialization and does not approve or use a
BIOSCAN-provided pretrained checkpoint. Public commercial release of trained
weights remains subject to the residual legal/governance review.
