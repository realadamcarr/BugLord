import { onCall } from "firebase-functions/v2/https";
export { acceptTrade } from "./trades/acceptTrade";

export const ping = onCall(async () => {
  return { ok: true };
});
