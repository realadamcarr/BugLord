import { db, firebaseApp } from '@/src/lib/firebase';
import { BugInstance } from '@/src/models/bugs';
import { Trade, TRADE_EXPIRY_MINUTES, TradeStatus } from '@/src/models/trades';
import { unlockOfferedBug } from '@/src/services/tradeLocks';
import {
    arrayUnion,
    collection,
    doc,
    DocumentReference,
    getDoc,
    onSnapshot,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    Timestamp,
    Unsubscribe,
    updateDoc,
    where
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

const TRADES = 'trades';

// ── Helpers ──────────────────────────────────────────────────────────

function snapshotToTrades(snap: { docs: any[] }): Trade[] {
  return snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) as Trade[];
}

/**
 * Append an event to the trade's `events` array.
 * Each event records what happened, who did it, and when.
 */
export async function appendTradeEvent(
  tradeRef: DocumentReference,
  event: { type: string; by: string },
): Promise<void> {
  await updateDoc(tradeRef, {
    events: arrayUnion({
      type: event.type,
      by: event.by,
      at: Timestamp.now(),
    }),
  });
}

// ── Create ───────────────────────────────────────────────────────────

export async function createTrade(
  fromUid: string,
  toUid: string,
  fromBugId: string,
  toBugId: string,
): Promise<string> {
  const tradeRef = doc(collection(db, TRADES));
  const fromBugRef = doc(db, 'inventories', fromUid, 'bugs', fromBugId);

  await runTransaction(db, async (tx) => {
    const bugSnap = await tx.get(fromBugRef);

    if (!bugSnap.exists()) {
      throw new Error('Bug not found in your inventory');
    }

    const bugData = bugSnap.data() as Omit<BugInstance, 'id'>;

    if (bugData.isTradeLocked) {
      throw new Error('This bug is trade-locked and cannot be traded');
    }

    if (bugData.lockedByTradeId) {
      throw new Error('This bug is already part of an active trade');
    }

    // Create the trade document
    tx.set(tradeRef, {
      fromUid,
      toUid,
      fromBugId,
      toBugId,
      status: 'proposed' satisfies TradeStatus,
      fromAccepted: false,
      toAccepted: false,
      fromAcceptedAt: null,
      toAcceptedAt: null,
      expiresAt: Timestamp.fromMillis(
        Date.now() + TRADE_EXPIRY_MINUTES * 60 * 1000,
      ),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Lock the offered bug to this trade
    tx.update(fromBugRef, {
      lockedByTradeId: tradeRef.id,
      lockedAt: serverTimestamp(),
    });
  });

  await appendTradeEvent(tradeRef, { type: 'proposed', by: fromUid });

  return tradeRef.id;
}

// ── Real-time subscriptions ──────────────────────────────────────────

export function subscribeIncomingTrades(
  uid: string,
  onData: (trades: Trade[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, TRADES),
    where('toUid', '==', uid),
    where('status', '==', 'proposed' satisfies TradeStatus),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(q, (snap) => onData(snapshotToTrades(snap)), onError);
}

export function subscribeOutgoingTrades(
  uid: string,
  onData: (trades: Trade[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, TRADES),
    where('fromUid', '==', uid),
    where('status', '==', 'proposed' satisfies TradeStatus),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(q, (snap) => onData(snapshotToTrades(snap)), onError);
}

// ── Status transitions (client-side) ─────────────────────────────────

export async function declineTrade(
  tradeId: string,
  uid: string,
): Promise<void> {
  const ref = doc(db, TRADES, tradeId);
  const snap = await getDoc(ref);

  if (!snap.exists()) throw new Error('Trade not found');

  const data = snap.data() as Omit<Trade, 'id'>;

  if (data.toUid !== uid) {
    throw new Error('Only the recipient can decline a trade');
  }
  if (data.status !== 'proposed') {
    throw new Error(`Cannot decline a trade with status "${data.status}"`);
  }

  await updateDoc(ref, {
    status: 'declined' satisfies TradeStatus,
    updatedAt: serverTimestamp(),
    events: arrayUnion({
      type: 'declined',
      by: uid,
      at: Timestamp.now(),
    }),
  });

  // Release the sender's locked bug
  try {
    await unlockOfferedBug(data.fromUid, data.fromBugId, tradeId);
  } catch (err) {
    console.warn('[tradeService] Failed to unlock fromBug after decline:', err);
  }

  // Release the recipient's locked bug (if they had chosen one)
  if (data.toBugId) {
    try {
      await unlockOfferedBug(data.toUid, data.toBugId, tradeId);
    } catch (err) {
      console.warn('[tradeService] Failed to unlock toBug after decline:', err);
    }
  }
}

export async function cancelTrade(
  tradeId: string,
  uid: string,
): Promise<void> {
  const ref = doc(db, TRADES, tradeId);
  const snap = await getDoc(ref);

  if (!snap.exists()) throw new Error('Trade not found');

  const data = snap.data() as Omit<Trade, 'id'>;

  if (data.fromUid !== uid) {
    throw new Error('Only the sender can cancel a trade');
  }
  if (data.status !== 'proposed') {
    throw new Error(`Cannot cancel a trade with status "${data.status}"`);
  }

  await updateDoc(ref, {
    status: 'cancelled' satisfies TradeStatus,
    updatedAt: serverTimestamp(),
    events: arrayUnion({
      type: 'cancelled',
      by: uid,
      at: Timestamp.now(),
    }),
  });

  // Release the sender's locked bug
  try {
    await unlockOfferedBug(data.fromUid, data.fromBugId, tradeId);
  } catch (err) {
    console.warn('[tradeService] Failed to unlock fromBug after cancel:', err);
  }

  // Release the recipient's locked bug (if they had chosen one)
  if (data.toBugId) {
    try {
      await unlockOfferedBug(data.toUid, data.toBugId, tradeId);
    } catch (err) {
      console.warn('[tradeService] Failed to unlock toBug after cancel:', err);
    }
  }
}

// ── Recipient sets their offered bug ─────────────────────────────────

/**
 * Called by the trade recipient (toUid) to select which bug they offer.
 * Validates ownership, lock-free state, then writes toBugId on the
 * trade doc and locks the bug.
 */
export async function setToBugId(
  tradeId: string,
  uid: string,
  bugId: string,
): Promise<void> {
  const tradeRef = doc(db, TRADES, tradeId);
  const bugRef = doc(db, 'inventories', uid, 'bugs', bugId);

  await runTransaction(db, async (tx) => {
    const tradeSnap = await tx.get(tradeRef);
    if (!tradeSnap.exists()) throw new Error('Trade not found');

    const trade = tradeSnap.data() as Omit<Trade, 'id'>;

    if (trade.toUid !== uid) {
      throw new Error('Only the trade recipient can set their offered bug');
    }
    if (trade.status !== 'proposed') {
      throw new Error(`Cannot modify a trade with status "${trade.status}"`);
    }
    if (trade.toBugId) {
      throw new Error('Recipient has already chosen a bug for this trade');
    }

    const bugSnap = await tx.get(bugRef);
    if (!bugSnap.exists()) throw new Error('Bug not found in your inventory');

    const bugData = bugSnap.data() as Omit<BugInstance, 'id'>;
    if (bugData.isTradeLocked) {
      throw new Error('This bug is trade-locked and cannot be traded');
    }
    if (bugData.lockedByTradeId) {
      throw new Error('This bug is already part of an active trade');
    }

    // Update trade with the recipient's offered bug
    tx.update(tradeRef, {
      toBugId: bugId,
      updatedAt: serverTimestamp(),
    });

    // Lock the recipient's bug to this trade
    tx.update(bugRef, {
      lockedByTradeId: tradeId,
      lockedAt: serverTimestamp(),
    });
  });

  await appendTradeEvent(tradeRef, { type: 'to_bug_set', by: uid });
}

// ── Accept (delegates to Cloud Function) ─────────────────────────────

/**
 * Accept a trade by calling the `acceptTrade` Cloud Function.
 * The function handles atomic bug swaps and status transitions server-side.
 */
export async function acceptTrade(tradeId: string): Promise<void> {
  const functions = getFunctions(firebaseApp);
  const callable = httpsCallable(functions, 'acceptTrade');
  await callable({ tradeId });
}

// ── Session-based trading ────────────────────────────────────────────

/**
 * Subscribe to a single trade document in real-time (for trade session screen).
 */
export function subscribeTrade(
  tradeId: string,
  onData: (trade: Trade) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const ref = doc(db, TRADES, tradeId);
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        onData({ id: snap.id, ...snap.data() } as Trade);
      }
    },
    onError,
  );
}

/**
 * Set the accept flag for a participant in a trade session.
 * When both fromAccepted and toAccepted are true, the Cloud Function
 * handles the final swap.
 */
export async function setTradeAcceptFlag(
  tradeId: string,
  uid: string,
): Promise<void> {
  const ref = doc(db, TRADES, tradeId);
  const snap = await getDoc(ref);

  if (!snap.exists()) throw new Error('Trade not found');

  const data = snap.data() as Omit<Trade, 'id'>;

  if (data.status !== 'proposed') {
    throw new Error(`Cannot accept a trade with status "${data.status}"`);
  }

  // Check expiry
  if (data.expiresAt && data.expiresAt.toMillis() < Date.now()) {
    await updateDoc(ref, {
      status: 'expired' satisfies TradeStatus,
      updatedAt: serverTimestamp(),
    });
    throw new Error('This trade has expired');
  }

  // Both bugs must be selected before either side can accept
  if (!data.toBugId) {
    throw new Error('The recipient hasn\'t selected a bug yet');
  }

  const isFrom = data.fromUid === uid;
  const isTo = data.toUid === uid;

  if (!isFrom && !isTo) {
    throw new Error('You are not a participant in this trade');
  }

  const updateData: Record<string, any> = {
    updatedAt: serverTimestamp(),
  };

  if (isFrom) {
    updateData.fromAccepted = true;
    updateData.fromAcceptedAt = serverTimestamp();
  } else {
    updateData.toAccepted = true;
    updateData.toAcceptedAt = serverTimestamp();
  }

  await updateDoc(ref, updateData);
  await appendTradeEvent(ref, { type: 'accepted_flag', by: uid });

  // If both have now accepted, trigger the Cloud Function for final swap
  const updatedSnap = await getDoc(ref);
  const updatedData = updatedSnap.data() as Omit<Trade, 'id'>;

  if (updatedData.fromAccepted && updatedData.toAccepted) {
    await acceptTrade(tradeId);
  }
}

/**
 * Unset the accept flag (revoke acceptance) before trade completes.
 */
export async function unsetTradeAcceptFlag(
  tradeId: string,
  uid: string,
): Promise<void> {
  const ref = doc(db, TRADES, tradeId);
  const snap = await getDoc(ref);

  if (!snap.exists()) throw new Error('Trade not found');

  const data = snap.data() as Omit<Trade, 'id'>;

  if (data.status !== 'proposed') {
    throw new Error(`Cannot modify a trade with status "${data.status}"`);
  }

  const isFrom = data.fromUid === uid;

  const updateData: Record<string, any> = {
    updatedAt: serverTimestamp(),
  };

  if (isFrom) {
    updateData.fromAccepted = false;
    updateData.fromAcceptedAt = null;
  } else {
    updateData.toAccepted = false;
    updateData.toAcceptedAt = null;
  }

  await updateDoc(ref, updateData);
  await appendTradeEvent(ref, { type: 'revoked_flag', by: uid });
}
