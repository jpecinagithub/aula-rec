/**
 * CameraService — webcam del profesor con getUserMedia().
 */
import { stopStream } from './screenCapture.ts';

export type CameraErrorCode = 'denied' | 'unsupported' | 'not-found' | 'unknown';

export class CameraError extends Error {
  code: CameraErrorCode;
  constructor(code: CameraErrorCode, message: string) {
    super(message);
    this.name = 'CameraError';
    this.code = code;
  }
}

export interface VideoDevice {
  deviceId: string;
  label: string;
}

export async function listCameras(): Promise<VideoDevice[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'videoinput')
      .map((d, i) => ({
        deviceId: d.deviceId,
        label: d.label || `Cámara ${i + 1}`,
      }));
  } catch (e) {
    console.warn('[AulaRec] enumerateDevices (vídeo) falló:', e);
    return [];
  }
}

export async function startCamera(deviceId?: string): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError('unsupported', 'Este navegador no permite acceder a la cámara.');
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }),
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
    if (stream.getVideoTracks().length === 0) {
      stopStream(stream);
      throw new CameraError('not-found', 'No se encontró ninguna cámara disponible.');
    }
    return stream;
  } catch (e) {
    if (e instanceof CameraError) throw e;
    const err = e as Error;
    console.warn('[AulaRec] getUserMedia (cámara) falló:', err?.name);
    if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') {
      throw new CameraError('denied', 'No se ha concedido permiso para usar la cámara.');
    }
    if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
      throw new CameraError('not-found', 'No se encontró ninguna cámara disponible.');
    }
    throw new CameraError('unknown', 'No se pudo iniciar la cámara.');
  }
}

export { stopStream };
