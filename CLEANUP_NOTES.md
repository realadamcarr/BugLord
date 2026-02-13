# Cleanup Notes

Summary of the repo-wide cleanup performed to make BugLord demo/exam ready.

---

## 🗑️ Removed

| Item | Reason |
|---|---|
| `@stackzilla__note-quest.jks` | Keystore file — **never** commit signing keys to version control. |
| `BugLord-backup.git/` | An entire bare git repo was committed inside the repo by mistake. |
| `New folder/` | Empty directory tracked in git. |

## 🔒 .gitignore Updates

Added rules to prevent re-committing dangerous or unnecessary files:

- `*.jks`, `*.keystore`, `*.key`, `*.p12`, `*.pem` — signing keys
- `key.properties`, `keystore.properties` — keystore passwords
- `google-services.json` — Firebase/GCP credentials
- `*.env.local`, `*.env.production` — secret env files
- `**/BugLord-backup.git/**` — backup repo folders
- `android/app/build/`, `android/build/`, `android/.gradle/` — build outputs

## 🏷️ Identity Fixes (note-quest / stackzilla → BugLord)

| File | Change |
|---|---|
| `app.json` | `slug` → `buglord`, `scheme` → `buglord`, `android.package` → `com.realadamcarr.buglord`, removed `owner: stackzilla` |
| `AndroidManifest.xml` | Deep-link schemes changed from `note-quest` / `exp+note-quest` to `buglord` / `exp+buglord` |
| `build-apk.bat` | Echo text → "BugLord" |
| `build-apk.sh` | Comment + echo text → "BugLord" |
| `build-local-apk.bat` | Echo text → "BugLord" |
| `build-test-apk.bat` | Echo text → "BugLord" |
| `start-android.bat` | Echo text → "BugLord" |
| `LICENSE` | Copyright holder → "BugLord" |
| `.github/copilot-instructions.md` | Removed `stackzilla` owner reference, updated slug gotcha |
| `ML_INTEGRATION_SUMMARY.md` | Removed "changed slug from note-quest" migration note |

## 📝 Documentation

| File | Action |
|---|---|
| `README.md` | **Rewritten** — removed all "Note Quest / smart notes" content; now covers BugLord features, tech stack, setup, build, project structure, limitations, roadmap. |
| `SECURITY.md` | **Created** — guidance on safe keystore/secret handling, EAS secrets, and reporting vulnerabilities. |
| `ML_INTEGRATION_SUMMARY.md` | Added "Current Inference Mode" and "Demo Mode (Expo Go)" notes at the top. |
| `ML_OBJECT_DETECTION_IMPLEMENTATION.md` | Added stub-mode / Expo Go note to Overview section. |

## ⚠️ Notes

- The `android.package` was changed from `com.anonymous.buglord` to `com.realadamcarr.buglord`. If a previous EAS build used the old package name, run `npx expo prebuild --clean --platform android` to regenerate native files.
- The EAS `projectId` in `app.json` was left unchanged — update it if you re-link the project to a different Expo account.
- No application code or features were removed. All changes are config/docs/hygiene only.
