import { db } from '@/src/lib/firebase';
import { FriendRequest, FriendRequestStatus } from '@/src/models/friends';
import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    setDoc,
    Unsubscribe,
    where
} from 'firebase/firestore';

// ── Types ────────────────────────────────────────────────────────────

export interface FriendServiceResult {
  success: boolean;
  error?: string;
}

export interface Friendship {
  uids: [string, string];
  createdAt: ReturnType<typeof serverTimestamp>;
}

// ── Helpers ──────────────────────────────────────────────────────────

export function buildFriendshipId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_');
}

// ── Service ──────────────────────────────────────────────────────────

export async function createFriendship(
  fromUid: string,
  toUid: string,
): Promise<FriendServiceResult> {
  try {
    const id = buildFriendshipId(fromUid, toUid);
    const sortedUids = [fromUid, toUid].sort() as [string, string];

    await setDoc(doc(db, 'friendships', id), {
      uids: sortedUids,
      createdAt: serverTimestamp(),
    });

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create friendship';
    return { success: false, error: message };
  }
}

export async function acceptFriendRequest(
  requestId: string,
): Promise<FriendServiceResult> {
  try {
    const requestRef = doc(db, 'friend_requests', requestId);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(requestRef);

      if (!snap.exists()) {
        throw new Error('Friend request not found');
      }

      const data = snap.data() as Omit<FriendRequest, 'id'>;

      if (data.status !== ('pending' satisfies FriendRequestStatus)) {
        throw new Error(
          `Cannot accept a request with status "${data.status}"`,
        );
      }

      // Update request → accepted
      tx.update(requestRef, {
        status: 'accepted' satisfies FriendRequestStatus,
        updatedAt: serverTimestamp(),
      });

      // Create the friendship document atomically
      const friendshipId = buildFriendshipId(data.fromUid, data.toUid);
      const friendshipRef = doc(db, 'friendships', friendshipId);
      const sortedUids = [data.fromUid, data.toUid].sort() as [string, string];

      tx.set(friendshipRef, {
        uids: sortedUids,
        createdAt: serverTimestamp(),
      });
    });

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to accept friend request';
    return { success: false, error: message };
  }
}

// ── Send a friend request ────────────────────────────────────────────

export async function sendFriendRequest(
  fromUid: string,
  toUid: string,
): Promise<FriendServiceResult> {
  if (fromUid === toUid) {
    return { success: false, error: 'You cannot send a request to yourself' };
  }

  try {
    // Check if already friends
    const friendshipId = buildFriendshipId(fromUid, toUid);
    const friendshipDoc = await getDoc(doc(db, 'friendships', friendshipId));
    if (friendshipDoc.exists()) {
      return { success: false, error: 'You are already friends' };
    }

    // Check for existing pending request: from me → them
    const outgoingQ = query(
      collection(db, 'friend_requests'),
      where('fromUid', '==', fromUid),
      where('toUid', '==', toUid),
      where('status', '==', 'pending' satisfies FriendRequestStatus),
    );
    const outgoingSnap = await getDocs(outgoingQ);
    if (!outgoingSnap.empty) {
      return { success: false, error: 'You already sent a request to this player' };
    }

    // Check for existing pending request: them → me
    const incomingQ = query(
      collection(db, 'friend_requests'),
      where('fromUid', '==', toUid),
      where('toUid', '==', fromUid),
      where('status', '==', 'pending' satisfies FriendRequestStatus),
    );
    const incomingSnap = await getDocs(incomingQ);
    if (!incomingSnap.empty) {
      return { success: false, error: 'This player already sent you a request — check your pending requests!' };
    }

    await addDoc(collection(db, 'friend_requests'), {
      fromUid,
      toUid,
      status: 'pending' satisfies FriendRequestStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (err: unknown) {
    console.error('[friendsService] sendFriendRequest error:', err);
    const message = err instanceof Error ? err.message : 'Failed to send friend request';
    return { success: false, error: message };
  }
}

// ── Decline a friend request ─────────────────────────────────────────

export async function declineFriendRequest(
  requestId: string,
): Promise<FriendServiceResult> {
  try {
    const ref = doc(db, 'friend_requests', requestId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Friend request not found');
      const data = snap.data() as Omit<FriendRequest, 'id'>;
      if (data.status !== 'pending') {
        throw new Error(`Cannot decline a request with status "${data.status}"`);
      }
      tx.update(ref, {
        status: 'declined' satisfies FriendRequestStatus,
        updatedAt: serverTimestamp(),
      });
    });
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to decline friend request';
    return { success: false, error: message };
  }
}

// ── Look up a user by friend code ────────────────────────────────────

export interface FriendCodeLookup {
  uid: string;
  username: string;
  displayName: string;
  friendCode: string;
}

export async function lookupByFriendCode(
  code: string,
): Promise<FriendCodeLookup | null> {
  const q = query(
    collection(db, 'users'),
    where('friendCode', '==', code.toUpperCase()),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { uid: d.id, ...d.data() } as FriendCodeLookup;
}

// ── Real-time subscriptions ──────────────────────────────────────────

/**
 * Subscribe to incoming pending friend requests for a user.
 * NOTE: This query requires a Firestore composite index on friend_requests:
 *   (toUid ASC, status ASC, createdAt DESC)
 * See firestore.indexes.json or create it manually in the Firebase Console.
 */
export function subscribeIncomingFriendRequests(
  uid: string,
  onData: (requests: FriendRequest[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'friend_requests'),
    where('toUid', '==', uid),
    where('status', '==', 'pending' satisfies FriendRequestStatus),
    orderBy('createdAt', 'desc'),
  );

  return onSnapshot(
    q,
    (snap) => {
      const requests: FriendRequest[] = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as FriendRequest[];
      onData(requests);
    },
    (error) => {
      console.error('[friendsService] subscribeIncomingFriendRequests error:', error);
      onError?.(error);
    },
  );
}

/**
 * Subscribe to outgoing pending friend requests for a user (requests the user sent).
 * NOTE: This query requires a Firestore composite index on friend_requests:
 *   (fromUid ASC, status ASC, createdAt DESC)
 */
export function subscribeOutgoingFriendRequests(
  uid: string,
  onData: (requests: FriendRequest[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'friend_requests'),
    where('fromUid', '==', uid),
    where('status', '==', 'pending' satisfies FriendRequestStatus),
    orderBy('createdAt', 'desc'),
  );

  return onSnapshot(
    q,
    (snap) => {
      const requests: FriendRequest[] = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as FriendRequest[];
      onData(requests);
    },
    (error) => {
      console.error('[friendsService] subscribeOutgoingFriendRequests error:', error);
      onError?.(error);
    },
  );
}

/**
 * Subscribe to the user's friendships. Returns an array of friend UIDs.
 */
export function subscribeFriends(
  uid: string,
  onData: (friendUids: string[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'friendships'),
    where('uids', 'array-contains', uid),
  );

  return onSnapshot(
    q,
    (snap) => {
      const friendUids: string[] = snap.docs.map((d) => {
        const uids = d.data().uids as string[];
        return uids.find((u) => u !== uid)!;
      });
      onData(friendUids);
    },
    onError,
  );
}
