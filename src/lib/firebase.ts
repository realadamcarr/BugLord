import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const firebaseApp: FirebaseApp = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

// On native platforms, use AsyncStorage to persist the auth session so users
// stay logged in after closing the app.  On web, getAuth() already defaults
// to indexedDB persistence.
function createAuth(app: FirebaseApp): Auth {
  if (Platform.OS === 'web') {
    return getAuth(app);
  }
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // initializeAuth throws if called more than once; fall back to getAuth
    return getAuth(app);
  }
}

const auth: Auth = createAuth(firebaseApp);

const db: Firestore = getFirestore(firebaseApp);

export { auth, db, firebaseApp };

