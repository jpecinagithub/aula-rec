import { useMemo } from 'react';
import { checkBrowserSupport } from '../services/browserSupport.ts';
import type { SupportReport } from '../services/browserSupport.ts';

/** useBrowserSupport — comprobación inicial de APIs críticas (una sola vez). */
export function useBrowserSupport(): SupportReport {
  return useMemo(() => checkBrowserSupport(), []);
}
