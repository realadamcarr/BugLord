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
- Use a `.env` file (git-ignored) for API keys and reference them via `expo-constants` or `process.env`.

### CI / Cloud Builds (EAS)
- Store signing credentials with **EAS Credentials** (`eas credentials`).
- Add environment variables in the Expo dashboard under **Project → Secrets**.
- Reference secrets in `eas.json` via `%VARIABLE_NAME%` or in your app via `expo-constants`.

```bash
# Example: set an EAS secret
eas secret:create --name GOOGLE_VISION_API_KEY --value "your-key-here"
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
