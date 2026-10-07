/**
 * ScreenCaptureService — captura de pantalla con getDisplayMedia().
 * El navegador ofrece pantalla completa / ventana / pestaña.
 * Nunca se accede a una zona del escritorio sin intervención del usuario:
 * el recorte se hace después, sobre la fuente ya autorizada, vía Canvas.
 */

export type ScreenCaptureErrorCode = 'denied' | 'unsupported' | 'unknown';

export class ScreenCaptureError extends Error {
  code: ScreenCaptureErrorCode;
  constructor(code: ScreenCaptureErrorCode, message: string) {
    super(message);
    this.name = 'ScreenCaptureError';
    this.code = code;
  }
}

export interface ScreenCaptureResult {
  stream: MediaStream;
  hasSystemAudio: boolean;
}

export async function captureScreen(opts: {
  systemAudio: boolean;
}): Promise<ScreenCaptureResult> {
  const md = navigator.mediaDevices as
    | (MediaDevices & { getDisplayMedia?: (c?: unknown) => Promise<MediaStream> })
    | undefined;

  if (!md || typeof md.getDisplayMedia !== 'function') {
    throw new ScreenCaptureError(
      'unsupported',
      'Este navegador no permite capturar la pantalla.',
    );
  }

  let stream: MediaStream;
  try {
    stream = await md.getDisplayMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
      },
      // El audio del sistema es opcional y depende del SO/navegador.
      audio: opts.systemAudio ? true : false,
    });
  } catch (e) {
    const err = e as Error;
    console.warn('[AulaRec] getDisplayMedia falló:', err?.name, err?.message);
    if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') {
      throw new ScreenCaptureError(
        'denied',
        'No se ha concedido permiso para capturar la pantalla.',
      );
    }
    throw new ScreenCaptureError('unknown', 'No se pudo iniciar la captura de pantalla.');
  }

  return {
    stream,
    hasSystemAudio: stream.getAudioTracks().length > 0,
  };
}

/** Detiene todas las pistas de un stream (libera el indicador de "compartiendo"). */
export function stopStream(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      /* noop */
    }
  }
}
