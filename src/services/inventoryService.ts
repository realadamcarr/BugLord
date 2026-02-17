import { db } from '@/src/lib/firebase';
import { BugInstance } from '@/src/models/bugs';
import {
    addDoc,
    collection,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
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
      const bugs: BugInstance[] = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
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
