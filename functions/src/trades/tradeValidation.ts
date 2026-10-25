/**
 * Pure checks for whether a trade may be completed.
 *
 * Kept free of firebase-admin so it can be unit tested without the emulator.
 * The Cloud Function calls this inside its transaction, so the decision is
 * made against the same snapshot that the swap writes against.
 */

export type TradeStatus =
  | "proposed"
  | "accepted"
  | "declined"
  | "cancelled"
  | "completed"
  | "expired";

export type TradeForCompletion = {
  fromUid?: string;
  toUid?: string;
  fromBugId?: string;
  toBugId?: string;
  status?: TradeStatus;
  fromAccepted?: boolean;
  toAccepted?: boolean;
  /** Milliseconds since epoch; null/undefined means no expiry. */
  expiresAtMillis?: number | null;
};

export type TradeRejection = {
  code: "failed-precondition" | "permission-denied";
  message: string;
};

/**
 * Returns null when the trade may complete, otherwise the reason it may not.
 */
export function checkTradeCanComplete(
  trade: TradeForCompletion,
  callerUid: string,
  nowMillis: number,
): TradeRejection | null {
  const { fromUid, toUid, fromBugId, toBugId, status } = trade;

  if (!fromUid || !toUid || !fromBugId || !status) {
    return { code: "failed-precondition", message: "Trade is missing required fields." };
  }

  if (callerUid !== fromUid && callerUid !== toUid) {
    return { code: "permission-denied", message: "Only participants can complete this trade." };
  }

  if (status !== "proposed") {
    return { code: "failed-precondition", message: "Trade is no longer available." };
  }

  if (!toBugId) {
    return { code: "failed-precondition", message: "Recipient has not selected a bug yet." };
  }

  if (trade.expiresAtMillis != null && trade.expiresAtMillis < nowMillis) {
    return { code: "failed-precondition", message: "This trade has expired." };
  }

  // Both players must still be ready at the moment of the swap. Without this
  // check, a player who un-readied or cancelled just before their partner
  // accepted would still have the swap go through.
  if (trade.fromAccepted !== true || trade.toAccepted !== true) {
    return { code: "failed-precondition", message: "Both players must accept before the trade can complete." };
  }

  return null;
}
