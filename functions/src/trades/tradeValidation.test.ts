import assert from "node:assert/strict";
import { test } from "node:test";
import { checkTradeCanComplete, TradeForCompletion } from "./tradeValidation";

const NOW = 1_700_000_000_000;

function readyTrade(overrides: Partial<TradeForCompletion> = {}): TradeForCompletion {
  return {
    fromUid: "alice",
    toUid: "bob",
    fromBugId: "bug-a",
    toBugId: "bug-b",
    status: "proposed",
    fromAccepted: true,
    toAccepted: true,
    expiresAtMillis: NOW + 60_000,
    ...overrides,
  };
}

test("allows completion when both players accepted", () => {
  assert.equal(checkTradeCanComplete(readyTrade(), "alice", NOW), null);
  assert.equal(checkTradeCanComplete(readyTrade(), "bob", NOW), null);
});

test("rejects when the recipient un-readied before the swap", () => {
  const result = checkTradeCanComplete(readyTrade({ toAccepted: false }), "alice", NOW);
  assert.equal(result?.code, "failed-precondition");
});

test("rejects when the sender un-readied before the swap", () => {
  const result = checkTradeCanComplete(readyTrade({ fromAccepted: false }), "bob", NOW);
  assert.equal(result?.code, "failed-precondition");
});

test("rejects when accept flags are missing", () => {
  const result = checkTradeCanComplete(
    readyTrade({ fromAccepted: undefined, toAccepted: undefined }),
    "alice",
    NOW,
  );
  assert.equal(result?.code, "failed-precondition");
});

for (const status of ["cancelled", "declined", "expired", "completed"] as const) {
  test(`rejects a ${status} trade even if both flags are still set`, () => {
    const result = checkTradeCanComplete(readyTrade({ status }), "alice", NOW);
    assert.equal(result?.code, "failed-precondition");
  });
}

test("rejects an expired trade that is still marked proposed", () => {
  const result = checkTradeCanComplete(readyTrade({ expiresAtMillis: NOW - 1 }), "alice", NOW);
  assert.equal(result?.code, "failed-precondition");
});

test("rejects when the recipient has not picked a bug", () => {
  const result = checkTradeCanComplete(readyTrade({ toBugId: "" }), "alice", NOW);
  assert.equal(result?.code, "failed-precondition");
});

test("rejects callers who are not in the trade", () => {
  const result = checkTradeCanComplete(readyTrade(), "mallory", NOW);
  assert.equal(result?.code, "permission-denied");
});
