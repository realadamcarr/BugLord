import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, Timestamp, arrayUnion, serverTimestamp } from 'firebase/firestore';
import fs from 'node:fs';
const env = await initializeTestEnvironment({ projectId: 'demo-buglord', firestore: { rules: fs.readFileSync(new URL("../../firestore.rules", import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 } });
const future = Timestamp.fromMillis(Date.now() + 600000), past = Timestamp.fromMillis(Date.now() - 1000);
async function seed(trade, bugs = true) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'trades/t1'), { fromUid: 'alice', toUid: 'bob', fromBugId: 'ba', toBugId: 'bb', status: 'proposed', fromAccepted: false, toAccepted: false, fromAcceptedAt: null, toAcceptedAt: null, expiresAt: future, events: [], ...trade });
    if (bugs) {
      await setDoc(doc(db, 'inventories/alice/bugs/ba'), { speciesId: 'bee', lockedByTradeId: 't1', lockedAt: null });
      await setDoc(doc(db, 'inventories/bob/bugs/bb'), { speciesId: 'ant', lockedByTradeId: 't1', lockedAt: null });
    }
  });
}
const as = (u) => env.authenticatedContext(u).firestore();
const T = (db) => doc(db, 'trades/t1');
const ev = (by) => arrayUnion({ type: 'x', by, at: Timestamp.now() });
let n = 0, bad = 0;
async function check(name, ok, p) { n++; try { await (ok ? assertSucceeds(p) : assertFails(p)); console.log('ok  ', name); } catch (e) { bad++; console.log('FAIL', name, e.message); } }

await seed({});
await check('alice sets own flag', true, updateDoc(T(as('alice')), { fromAccepted: true, fromAcceptedAt: serverTimestamp(), updatedAt: serverTimestamp(), events: ev('alice') }));
await check('alice sets bob flag', false, updateDoc(T(as('alice')), { toAccepted: true }));
await check('bob sets own flag', true, updateDoc(T(as('bob')), { toAccepted: true, toAcceptedAt: serverTimestamp(), updatedAt: serverTimestamp(), events: ev('bob') }));
await check('bob sets status completed', false, updateDoc(T(as('bob')), { status: 'completed' }));
await check('bob unsets own flag', true, updateDoc(T(as('bob')), { toAccepted: false, toAcceptedAt: null, updatedAt: serverTimestamp(), events: ev('bob') }));
await check('bob changes fromBugId', false, updateDoc(T(as('bob')), { fromBugId: 'zz' }));
await check('mallory appends event', false, updateDoc(T(as('mallory')), { events: ev('mallory') }));
await check('alice appends event', true, updateDoc(T(as('alice')), { events: ev('alice') }));
await check('bob cancels (sender only)', false, updateDoc(T(as('bob')), { status: 'cancelled' }));
await check('alice clears bob lock while proposed', false, updateDoc(doc(as('alice'), 'inventories/bob/bugs/bb'), { lockedByTradeId: null, lockedAt: null }));
const end = { fromAccepted: false, toAccepted: false, fromAcceptedAt: null, toAcceptedAt: null, updatedAt: serverTimestamp() };
await check('alice cancels', true, updateDoc(T(as('alice')), { status: 'cancelled', ...end, events: ev('alice') }));
await check('bob accepts after cancel', false, updateDoc(T(as('bob')), { toAccepted: true }));
await check('alice clears bob lock after cancel', true, updateDoc(doc(as('alice'), 'inventories/bob/bugs/bb'), { lockedByTradeId: null, lockedAt: null }));
await check('mallory clears alice lock', false, updateDoc(doc(as('mallory'), 'inventories/alice/bugs/ba'), { lockedByTradeId: null, lockedAt: null }));

await seed({});
await check('bob declines', true, updateDoc(T(as('bob')), { status: 'declined', ...end, events: ev('bob') }));
await seed({ toBugId: '', toAccepted: false });
await check('alice accepts before bob picks', false, updateDoc(T(as('alice')), { fromAccepted: true, updatedAt: serverTimestamp() }));
await check('bob picks bug', true, updateDoc(T(as('bob')), { toBugId: 'bb', toBugSnapshot: { speciesId: 'ant' }, updatedAt: serverTimestamp() }));
await seed({ expiresAt: past });
await check('bob expires past trade', true, updateDoc(T(as('bob')), { status: 'expired', updatedAt: serverTimestamp() }));
await seed({});
await check('bob expires live trade', false, updateDoc(T(as('bob')), { status: 'expired', updatedAt: serverTimestamp() }));
await env.cleanup();
console.log(`${n - bad}/${n} passed`); process.exit(bad ? 1 : 0);
