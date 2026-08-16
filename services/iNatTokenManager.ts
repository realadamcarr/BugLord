/**
 * iNaturalist JWT Token Manager
 *
 * Automatically refreshes the iNaturalist API JWT token when it expires (HTTP 401).
 * Uses the OAuth2 Resource Owner Password Credentials grant flow:
 *   1. POST /oauth/token with app credentials + user email/password → OAuth access_token
 *   2. GET  /users/api_token with Bearer access_token → fresh JWT
 *
 * Required .env variables:
 *   EXPO_PUBLIC_INAT_APP_ID        – OAuth application ID from inaturalist.org
 *   EXPO_PUBLIC_INAT_APP_SECRET    – OAuth application secret
 *   EXPO_PUBLIC_INAT_EMAIL         – iNaturalist account email
 *   EXPO_PUBLIC_INAT_PASSWORD      – iNaturalist account password
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'inat_jwt_token';
const OAUTH_TOKEN_URL = 'https://www.inaturalist.org/oauth/token';
const API_TOKEN_URL = 'https://www.inaturalist.org/users/api_token';

class INatTokenManager {
  /** Current in-memory JWT */
  private currentToken: string | null = null;
  /** Dedup concurrent refresh calls */
  private refreshPromise: Promise<string | null> | null = null;

  // ── Public API ────────────────────────────────────────────

  /**
   * Return a usable JWT. Loads from memory → AsyncStorage → .env fallback.
   * Does NOT trigger a refresh – call `refreshToken()` for that.
   */
  async getToken(): Promise<string | null> {
    if (this.currentToken) return this.currentToken;

    // Try persisted token from a previous refresh
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.currentToken = stored;
        return stored;
      }
    } catch { /* AsyncStorage unavailable */ }

    return null;
  }

  /** Manually set a token (e.g. from hardcoded config at startup). */
  setToken(token: string) {
    this.currentToken = token;
    AsyncStorage.setItem(STORAGE_KEY, token).catch(() => {});
  }

  /** Clear the cached token so the next `getToken` call returns null. */
  clearToken() {
    this.currentToken = null;
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }

  /**
   * Fetch a brand-new JWT using OAuth credentials stored in .env.
   * Deduplicates concurrent calls so only one network roundtrip happens.
   * Returns the new JWT or null on failure.
   */
  async refreshToken(): Promise<string | null> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = this._doRefresh();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  /** Whether the .env credentials needed for auto-refresh are present. */
  get canAutoRefresh(): boolean {
    return !!(
      process.env.EXPO_PUBLIC_INAT_APP_ID &&
      process.env.EXPO_PUBLIC_INAT_EMAIL &&
      process.env.EXPO_PUBLIC_INAT_PASSWORD
    );
  }

  // ── Internals ─────────────────────────────────────────────

  private async _doRefresh(): Promise<string | null> {
    const clientId = process.env.EXPO_PUBLIC_INAT_APP_ID;
    const clientSecret = process.env.EXPO_PUBLIC_INAT_APP_SECRET ?? '';
    const email = process.env.EXPO_PUBLIC_INAT_EMAIL;
    const password = process.env.EXPO_PUBLIC_INAT_PASSWORD;

    if (!clientId || !email || !password) {
      console.warn(
        '🌿 Cannot refresh iNaturalist token – missing .env credentials.\n' +
        '   Needed: EXPO_PUBLIC_INAT_APP_ID, EXPO_PUBLIC_INAT_EMAIL, EXPO_PUBLIC_INAT_PASSWORD',
      );
      return null;
    }

    try {
      console.log('🌿 Refreshing iNaturalist JWT via OAuth...');

      // Step 1: OAuth password grant → access_token
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'password',
        username: email,
        password: password,
      });

      const oauthRes = await fetch(OAUTH_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!oauthRes.ok) {
        const errText = await oauthRes.text().catch(() => '');
        console.warn(`🌿 OAuth token request failed: HTTP ${oauthRes.status} — ${errText.slice(0, 200)}`);
        return null;
      }

      const oauthData = await oauthRes.json();
      const accessToken: string | undefined = oauthData?.access_token;

      if (!accessToken) {
        console.warn('🌿 OAuth response missing access_token');
        return null;
      }

      // Step 2: Exchange OAuth token for an API JWT
      const jwtRes = await fetch(API_TOKEN_URL, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (!jwtRes.ok) {
        console.warn(`🌿 JWT fetch failed: HTTP ${jwtRes.status}`);
        return null;
      }

      const jwtData = await jwtRes.json();
      const jwt: string | undefined = jwtData?.api_token;

      if (!jwt) {
        console.warn('🌿 JWT response missing api_token field');
        return null;
      }

      this.setToken(jwt);
      console.log('🌿 ✅ iNaturalist JWT refreshed successfully');
      return jwt;
    } catch (error) {
      console.warn('🌿 Token refresh error:', error);
      return null;
    }
  }
}

/** Singleton token manager for the whole app */
export const iNatTokenManager = new INatTokenManager();
