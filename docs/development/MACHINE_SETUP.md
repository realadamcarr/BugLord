# Developing BugLord on Another Computer

This guide describes the files shared through Git and the local or secret
files that must be recreated on each development computer.

## 1. Clone and select Node

```powershell
git clone https://github.com/realadamcarr/BugLord.git
cd BugLord
nvm install 22.13.0
nvm use 22.13.0
```

Other Node version managers can read `.nvmrc`.

## 2. Install JavaScript dependencies

Use the lockfiles so both computers install the same dependency graph:

```powershell
npm ci
npm --prefix functions ci
```

Do not copy or commit `node_modules`, `functions/node_modules`, `.expo`,
`dist`, or native build directories.

## 3. Create local environment configuration

```powershell
Copy-Item .env.example .env
```

Fill in the Firebase client values in `.env`. Obtain them from Firebase
Console or transfer them using a trusted password manager. Never commit
`.env`, account passwords, OAuth client secrets, service-account JSON files,
or signing credentials.

Values whose names start with `EXPO_PUBLIC_` are compiled into the mobile
application. They must never contain an account password or a private OAuth
client secret.

BugLord's iNaturalist integration uses public, read-only API endpoints for
taxa, observations, and species-count metadata. It does not require an
iNaturalist application secret, account email, account password, OAuth token,
or JWT in the mobile environment. Do not add `EXPO_PUBLIC_INAT_*` credentials.

If a future feature needs authenticated iNaturalist write access, keep its
client secret on Firebase Functions or the backend host and implement explicit
user OAuth. Store any user token in platform secure storage, not AsyncStorage.

## 4. Install the Python backend

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
```

The virtual environment is local and must not be committed.

## 5. Runtime and training models

The runtime app model and labels are versioned at:

- `assets/ml/model.tflite`
- `assets/ml/labels.json`
- `assets/ml/labels.txt`

Experimental checkpoints, datasets, converted model variants, and training
outputs are intentionally excluded from Git. Store reproducible release
models in Git LFS, a GitHub Release, or versioned object storage and record
their source, license, checksum, preprocessing contract, and label order.

Training scripts and documentation under `training/` are versioned. Training
datasets, Python environments, checkpoints, downloaded base models, and logs
are ignored.

## 6. Optional TensorFlow Models checkout

BugLord previously recorded `models/` as a gitlink without a `.gitmodules`
definition. It is not required to install or run the application and is now
treated as an optional external dependency.

Clone the pinned upstream revision only for TensorFlow training or conversion:

```powershell
git clone https://github.com/tensorflow/models.git models
git -C models checkout 9aa98a39b592cdcf2dfbd68ee7f60b8de57423b8
```

The entire `models/` directory remains ignored by BugLord. Manage local
changes inside that nested repository separately, or convert the needed work
into small BugLord-owned scripts under `training/`.

## 7. Local-only signing and platform files

Transfer release signing keys through encrypted storage or a password manager.
Never commit:

- `*.jks`, `*.keystore`, `*.p12`, `*.pem`, or `*.key`
- signing passwords
- `google-services.json` or `GoogleService-Info.plist`
- `android/local.properties`
- Firebase service-account files

Debug keystores and native build outputs are regenerated locally.

## 8. Normal machine-switching workflow

Before leaving one computer:

```powershell
git status
git add <specific source files>
git commit -m "Describe the change"
git push
```

On the other computer:

```powershell
git switch main
git pull --ff-only
npm ci
```

Run `npm ci` whenever a JavaScript lockfile changes. Prefer adding specific
paths rather than `git add .`, especially around model or training work.
