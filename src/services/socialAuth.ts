import { auth, db } from '@/src/lib/firebase';
import { generateFriendCode } from '@/src/lib/friendCode';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
    User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

// ── Types ────────────────────────────────────────────────────────────

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  friendCode: string;
  createdAt: ReturnType<typeof serverTimestamp>;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

// ── Auth helpers ─────────────────────────────────────────────────────

export async function register(
  email: string,
  password: string,
  username: string,
): Promise<AuthResult> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: username });
    await ensureUserProfile(cred.user, username);
    return { success: true, user: cred.user };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Registration failed';
    return { success: false, error: msg };
  }
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResult> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await ensureUserProfile(cred.user);
    return { success: true, user: cred.user };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Login failed';
    return { success: false, error: msg };
  }
}

export async function logout(): Promise<void> {
  await signOut(auth);
}

// ── User profile ─────────────────────────────────────────────────────

/**
 * Creates the users/{uid} Firestore document if it doesn't exist yet.
 * Generates a unique friend code on first creation.
 */
export async function ensureUserProfile(
  user: User,
  username?: string,
): Promise<UserProfile> {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const existing = snap.data();
    // Backfill friendCode for users created before this feature
    if (!existing.friendCode) {
      const friendCode = generateFriendCode();
      await setDoc(ref, { friendCode }, { merge: true });
      return { uid: user.uid, ...existing, friendCode } as UserProfile;
    }
    return { uid: user.uid, ...existing } as UserProfile;
  }

  const profile: Omit<UserProfile, 'uid'> = {
    username: username ?? user.displayName ?? 'Trainer',
    displayName: user.displayName ?? username ?? 'Trainer',
    friendCode: generateFriendCode(),
    createdAt: serverTimestamp(),
  };

  await setDoc(ref, profile);

  return { uid: user.uid, ...profile };
}

/**
 * Fetch the current user's profile from Firestore.
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() } as UserProfile;
}
