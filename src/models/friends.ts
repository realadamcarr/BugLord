import { Timestamp } from 'firebase/firestore';

export type FriendRequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export interface FriendRequest {
  id: string;
  fromUid: string;
  toUid: string;
  status: FriendRequestStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const TERMINAL_STATUSES: ReadonlySet<FriendRequestStatus> = new Set([
  'accepted',
  'declined',
  'cancelled',
]);

export function isTerminalStatus(status: FriendRequestStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function buildFriendPairKey(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_');
}
