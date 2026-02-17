import { db } from '@/src/lib/firebase';
import { FriendRequest, FriendRequestStatus } from '@/src/models/friends';
import {
  addDoc,
  collection,
  doc,
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
    // Check for existing pending request in either direction
    const q = query(
      collection(db, 'friend_requests'),
      where('status', '==', 'pending' satisfies FriendRequestStatus),
    );
    const snap = await getDocs(q);
    const duplicate = snap.docs.some((d) => {
      const data = d.data();
      return (
        (data.fromUid === fromUid && data.toUid === toUid) ||
        (data.fromUid === toUid && data.toUid === fromUid)
      );
    });

    if (duplicate) {
      return { success: false, error: 'A pending friend request already exists' };
    }

    // Check if already friends
    const friendshipId = buildFriendshipId(fromUid, toUid);
    const friendshipSnap = await getDocs(
      query(collection(db, 'friendships'), where('__name__', '==', friendshipId)),
    );
    if (!friendshipSnap.empty) {
      return { success: false, error: 'You are already friends' };
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
    onError,
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
