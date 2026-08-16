import { db } from '@/src/lib/firebase';
import { BugInstance } from '@/src/models/bugs';
import { Bug } from '@/types/Bug';
import {
    addDoc,
    collection,
    doc,
    getDoc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    Unsubscribe,
} from 'firebase/firestore';

/**
 * Subscribe to a user's bug inventory, ordered newest-first.
 * Returns an unsubscribe function.
 */
export function listMyBugs(
  uid: string,
  onData: (bugs: BugInstance[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const bugsRef = collection(db, 'inventories', uid, 'bugs');
  const q = query(bugsRef, orderBy('obtainedAt', 'desc'));

  return onSnapshot(
    q,
    (snap) => {
      const bugs: BugInstance[] = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as BugInstance[];
      onData(bugs);
    },
    (err) => {
      onError?.(err);
    },
  );
}

/**
 * Add a new bug to a user's inventory.
 * `obtainedAt` is set automatically via serverTimestamp.
 */
export async function addBugToInventory(
  uid: string,
  bug: Omit<BugInstance, 'id' | 'obtainedAt'>,
): Promise<string> {
  const bugsRef = collection(db, 'inventories', uid, 'bugs');
  const docRef = await addDoc(bugsRef, {
    ...bug,
    obtainedAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Fetch a single bug from a user's Firestore inventory.
 * Returns null if the document doesn't exist or can't be read.
 */
export async function getFirestoreBug(uid: string, bugId: string): Promise<BugInstance | null> {
  try {
    const bugDocRef = doc(db, 'inventories', uid, 'bugs', bugId);
    const snap = await getDoc(bugDocRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as BugInstance;
  } catch {
    return null;
  }
}

/**
 * Sync a local Bug (from BugCollectionContext / AsyncStorage) to
 * Firestore so the trade system can reference it.
 *
 * Uses the local bug.id as the Firestore doc ID, so calling this
 * multiple times for the same bug is idempotent.
 *
 * Returns the Firestore doc ID (same as bug.id).
 */
export async function syncLocalBugToFirestore(
  uid: string,
  bug: Bug,
): Promise<string> {
  const bugDocRef = doc(db, 'inventories', uid, 'bugs', bug.id);

  // Check if already synced
  const existing = await getDoc(bugDocRef);
  if (existing.exists()) {
    return bug.id;
  }

  // Convert local Bug → Firestore BugInstance fields
  await setDoc(bugDocRef, {
    speciesId: bug.species ?? bug.name ?? 'unknown',
    nickname: bug.nickname ?? null,
    level: bug.level ?? 1,
    rarity: bug.rarity ?? 'common',
    isTradeLocked: false,
    lockedByTradeId: null,
    lockedAt: null,
    obtainedAt: serverTimestamp(),
  });

  return bug.id;
}
