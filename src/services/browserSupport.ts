/**
 * BrowserSupportService — comprobación inicial de APIs críticas.
 * Los detalles técnicos solo van a consola; la UI muestra mensajes comprensibles.
 */

export interface SupportCheck {
  key: string;
  label: string;
  ok: boolean;
}

export interface SupportReport {
  ok: boolean;
  checks: SupportCheck[];
  missingLabels: string[];
}

export function checkBrowserSupport(): SupportReport {
  const md = navigator.mediaDevices as
    | (MediaDevices & { getDisplayMedia?: unknown })
    | undefined;

  const checks: SupportCheck[] = [
    {
      key: 'getDisplayMedia',
      label: 'captura de pantalla',
      ok: typeof md?.getDisplayMedia === 'function',
    },
    {
      key: 'getUserMedia',
      label: 'cámara y micrófono',
      ok: typeof md?.getUserMedia === 'function',
    },
    {
      key: 'MediaRecorder',
      label: 'grabación de vídeo',
      ok: typeof window.MediaRecorder === 'function',
    },
    {
      key: 'captureStream',
      label: 'composición de vídeo en canvas',
      ok:
        typeof HTMLCanvasElement !== 'undefined' &&
        typeof HTMLCanvasElement.prototype.captureStream === 'function',
    },
  ];

  const missingLabels = checks.filter((c) => !c.ok).map((c) => c.label);

  if (missingLabels.length > 0) {
    // Solo consola: nunca errores técnicos crudos en la UI.
    console.warn('[AulaRec] APIs no soportadas:', missingLabels.join(', '));
  }

  return { ok: missingLabels.length === 0, checks, missingLabels };
}

/** Heurística: pantalla pequeña + puntero táctil → probablemente móvil/tablet. */
export function isProbablyMobile(): boolean {
  try {
    return (
      window.matchMedia('(pointer: coarse)').matches &&
      Math.min(window.innerWidth, window.innerHeight) < 768
    );
  } catch {
    return false;
  }
}
