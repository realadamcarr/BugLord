import { Timestamp } from 'firebase/firestore';

/** Minimal display info snapshotted onto the trade doc so both sides can see bug details without cross-user inventory reads. */
export interface BugSnapshot {
  speciesId: string;
  nickname?: string | null;
  level: number;
  rarity: string;
}

export type TradeStatus =
  | 'proposed'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'completed'
  | 'expired';

export interface Trade {
  id: string;
  fromUid: string;
  toUid: string;
  /** Bug offered by the trade initiator */
  fromBugId: string;
  fromBugSnapshot?: BugSnapshot | null;
  /** Bug offered by the recipient — empty string until they choose */
  toBugId: string;
  toBugSnapshot?: BugSnapshot | null;
  status: TradeStatus;
  /** Both parties must accept for the trade to complete */
  fromAccepted: boolean;
  toAccepted: boolean;
  fromAcceptedAt?: Timestamp | null;
  toAcceptedAt?: Timestamp | null;
  /** Trade automatically expires after this time */
  expiresAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Default trade session duration in minutes */
export const TRADE_EXPIRY_MINUTES = 30;
