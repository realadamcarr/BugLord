import { firebaseApp } from '@/src/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface AcceptTradeResult {
  ok: boolean;
  tradeId: string;
}

export async function callAcceptTrade(tradeId: string): Promise<AcceptTradeResult> {
  const functions = getFunctions(firebaseApp);
  const callable = httpsCallable<{ tradeId: string }, AcceptTradeResult>(
    functions,
    'acceptTrade',
  );
  const result = await callable({ tradeId });
  return result.data;
}
