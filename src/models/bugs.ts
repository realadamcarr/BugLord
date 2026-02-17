import { Timestamp } from 'firebase/firestore';

export type BugRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface BugInstance {
  id: string;
  speciesId: string;
  nickname?: string;
  level: number;
  rarity: BugRarity;
  isTradeLocked: boolean;
  lockedByTradeId?: string | null;
  lockedAt?: Timestamp | null;
  obtainedAt: Timestamp;
}
