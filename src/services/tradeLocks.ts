import { db } from '@/src/lib/firebase';
import { BugInstance } from '@/src/models/bugs';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

/**
 * Clear the trade lock on the offered bug, but only if the lock
 * still belongs to the given tradeId.  Safe to call even if the
 * bug has already been deleted or re-locked by another trade.
 */
export async function unlockOfferedBug(
  fromUid: string,
  fromBugId: string,
  tradeId: string,
): Promise<void> {
  const bugRef = doc(db, 'inventories', fromUid, 'bugs', fromBugId);
  const bugSnap = await getDoc(bugRef);

  if (!bugSnap.exists()) return;

  const bugData = bugSnap.data() as Omit<BugInstance, 'id'>;

  if (bugData.lockedByTradeId !== tradeId) return;

  await updateDoc(bugRef, {
    lockedByTradeId: null,
    lockedAt: null,
  });
}
