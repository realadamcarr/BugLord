# Security Policy

## 🔑 Never Commit Secrets

The following should **never** be tracked in version control:

| Type | Examples |
|---|---|
| Keystores | `*.jks`, `*.keystore`, `*.p12` |
| Private keys | `*.key`, `*.pem` |
| API keys / tokens | `.env`, `.env.local`, `.env.production` |
| Google services | `google-services.json` |
| Keystore passwords | `key.properties`, `keystore.properties` |

These patterns are already listed in `.gitignore`.

## ✅ How to Store Secrets Safely

### Local Development
- Keep keystores and key files **outside** the repo (e.g., `~/.android/keystores/`).
- Use `.env` only for public mobile configuration documented in `.env.example`.
- Treat every `EXPO_PUBLIC_*` value as bundled and readable by app users.
- Keep passwords, OAuth client secrets, reusable tokens, and service-account
  credentials in server-side secret storage, never in the React Native environment.

### CI / Cloud Builds (EAS)
- Store signing credentials with **EAS Credentials** (`eas credentials`).
- EAS environment variables referenced by client code are not private after
  compilation. Use them only for public client configuration.
- Store server-only application secrets in Firebase Functions Secret Manager
  or the backend host environment.

```bash
# Example: configure a server-only Firebase Functions secret
firebase functions:secrets:set SERVER_ONLY_SECRET
```

### Android Keystore
- Generate once, store securely:
  ```bash
  keytool -genkeypair -v -storetype JKS \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -keystore ~/buglord-release.jks \
    -alias buglord
  ```
- Never place the `.jks` file inside the repo folder.
- For EAS builds, let EAS manage the keystore automatically or upload it via `eas credentials`.

## 🐛 Reporting Vulnerabilities

If you discover a security issue, please open a private issue or contact the maintainer directly. Do not post secrets or credentials in public issues.
