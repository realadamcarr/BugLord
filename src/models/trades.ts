import { Timestamp } from 'firebase/firestore';

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
  fromBugId: string;
  toBugId: string;
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
