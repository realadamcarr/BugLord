import AsyncStorage from '@react-native-async-storage/async-storage';

const LEGACY_INAT_TOKEN_KEY = 'inat_jwt_token';

/** Remove the obsolete iNaturalist JWT persisted by older app builds. */
export async function purgeLegacyINatCredentials(): Promise<void> {
  await AsyncStorage.removeItem(LEGACY_INAT_TOKEN_KEY);
}
