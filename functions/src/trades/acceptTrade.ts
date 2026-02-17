import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

initializeApp();

type TradeStatus = "proposed" | "declined" | "cancelled" | "completed";

type TradeDoc = {
  fromUid: string;
  toUid: string;
  fromBugId: string;
  toBugId: string;
  status: TradeStatus;
};

function cleanBugForTransfer(bug: Record<string, any>) {
  const copy = { ...bug };
  delete copy.lockedByTradeId;
  delete copy.lockedAt;
  return copy;
}

export const acceptTrade = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "You must be signed in.");

  const tradeId = String(request.data?.tradeId ?? "").trim();
  if (!tradeId) throw new HttpsError("invalid-argument", "tradeId is required.");

  const db = getFirestore();
  const tradeRef = db.collection("trades").doc(tradeId);

  await db.runTransaction(async (tx) => {
    const tradeSnap = await tx.get(tradeRef);
    if (!tradeSnap.exists) throw new HttpsError("not-found", "Trade not found.");

    const trade = tradeSnap.data() as Partial<TradeDoc>;
    const { fromUid, toUid, fromBugId, toBugId, status } = trade;

    if (!fromUid || !toUid || !fromBugId || !toBugId || !status) {
      throw new HttpsError("failed-precondition", "Trade is missing required fields.");
    }

    if (status !== "proposed") {
      throw new HttpsError("failed-precondition", "Trade is no longer available.");
    }

    if (uid !== toUid) {
      throw new HttpsError("permission-denied", "Only the recipient can accept this trade.");
    }

    const fromBugRef = db.doc(`inventories/${fromUid}/bugs/${fromBugId}`);
    const toBugRef = db.doc(`inventories/${toUid}/bugs/${toBugId}`);

    const fromBugSnap = await tx.get(fromBugRef);
    const toBugSnap = await tx.get(toBugRef);

    if (!fromBugSnap.exists) {
      throw new HttpsError("failed-precondition", "Offered bug no longer exists.");
    }
    if (!toBugSnap.exists) {
      throw new HttpsError("failed-precondition", "Requested bug no longer exists.");
    }

    const fromBug = fromBugSnap.data() as any;
    const toBug = toBugSnap.data() as any;

    if (fromBug?.isTradeLocked === true || toBug?.isTradeLocked === true) {
      throw new HttpsError("failed-precondition", "One of the bugs is trade-locked.");
    }

    // offered bug must be reserved for this trade
    if ((fromBug?.lockedByTradeId ?? null) !== tradeId) {
      throw new HttpsError("failed-precondition", "Offered bug is not reserved for this trade.");
    }

    const newFromBugRefForToUser = db.doc(`inventories/${toUid}/bugs/${fromBugId}`);
    const newToBugRefForFromUser = db.doc(`inventories/${fromUid}/bugs/${toBugId}`);

    tx.set(newFromBugRefForToUser, {
      ...cleanBugForTransfer(fromBug),
      tradedAt: FieldValue.serverTimestamp(),
    });

    tx.set(newToBugRefForFromUser, {
      ...cleanBugForTransfer(toBug),
      tradedAt: FieldValue.serverTimestamp(),
    });

    tx.delete(fromBugRef);
    tx.delete(toBugRef);

    tx.update(tradeRef, {
      status: "completed",
      updatedAt: FieldValue.serverTimestamp(),
      completedAt: FieldValue.serverTimestamp(),
    });
  });

  return { ok: true, tradeId };
});
