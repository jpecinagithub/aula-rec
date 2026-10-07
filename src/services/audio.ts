/**
 * AudioService — micrófono del profesor + mezcla opcional de audio del sistema
 * con Web Audio API. El audio principal siempre es el micrófono.
 */
import { stopStream } from './screenCapture.ts';

export type MicErrorCode = 'denied' | 'unsupported' | 'unknown';

export class MicError extends Error {
  code: MicErrorCode;
  constructor(code: MicErrorCode, message: string) {
    super(message);
    this.name = 'MicError';
    this.code = code;
  }
}

export interface AudioDevice {
  deviceId: string;
  label: string;
}

export async function listMicrophones(): Promise<AudioDevice[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'audioinput')
      .map((d, i) => ({
        deviceId: d.deviceId,
        label: d.label || `Micrófono ${i + 1}`,
      }));
  } catch (e) {
    console.warn('[AulaRec] enumerateDevices (audio) falló:', e);
    return [];
  }
}

export interface MixerOptions {
  micDeviceId?: string;
  /** Stream de pantalla: si trae pista de audio se mezcla como audio del sistema. */
  systemAudioStream?: MediaStream | null;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  /** Se llama si la pista del micrófono termina (desconexión). */
  onMicLost?: () => void;
}

export interface VoiceMixer {
  /** Stream mezclado listo para combinar con el vídeo del canvas. */
  readonly output: MediaStream;
  /** Volumen del micrófono (0 – 1.5). */
  setVolume(v: number): void;
  /** Nivel instantáneo 0..1 para el medidor. */
  getLevel(): number;
  dispose(): void;
}

export async function createVoiceMixer(opts: MixerOptions): Promise<VoiceMixer> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new MicError('unsupported', 'Este navegador no permite acceder al micrófono.');
  }

  let micStream: MediaStream;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        ...(opts.micDeviceId ? { deviceId: { exact: opts.micDeviceId } } : {}),
        echoCancellation: opts.echoCancellation,
        noiseSuppression: opts.noiseSuppression,
        autoGainControl: opts.autoGainControl,
      },
      video: false,
    });
  } catch (e) {
    const err = e as Error;
    console.warn('[AulaRec] getUserMedia (micrófono) falló:', err?.name);
    if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') {
      throw new MicError('denied', 'No se ha concedido permiso para usar el micrófono.');
    }
    throw new MicError('unknown', 'No se pudo iniciar el micrófono.');
  }

  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) {
    stopStream(micStream);
    throw new MicError('unsupported', 'Este navegador no permite procesar el audio.');
  }

  const ctx = new AC();
  try {
    await ctx.resume();
  } catch {
    /* algunos navegadores lo reanudan solos tras el gesto */
  }

  if (opts.onMicLost) {
    const notify = opts.onMicLost;
    for (const t of micStream.getAudioTracks()) {
      t.addEventListener('ended', notify);
    }
  }

  const micSource = ctx.createMediaStreamSource(micStream);
  const micGain = ctx.createGain();
  micGain.gain.value = 1;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.6;
  const dest = ctx.createMediaStreamDestination();

  micSource.connect(micGain);
  micGain.connect(analyser);
  analyser.connect(dest);

  // Audio del sistema (opcional, desactivado por defecto en la UI).
  let sysSource: MediaStreamAudioSourceNode | null = null;
  const sysTracks = opts.systemAudioStream?.getAudioTracks() ?? [];
  if (sysTracks.length > 0 && opts.systemAudioStream) {
    try {
      sysSource = ctx.createMediaStreamSource(opts.systemAudioStream);
      const sysGain = ctx.createGain();
      sysGain.gain.value = 0.9;
      sysSource.connect(sysGain);
      sysGain.connect(dest);
    } catch (e) {
      console.warn('[AulaRec] no se pudo mezclar el audio del sistema:', e);
    }
  }

  const timeData = new Uint8Array(analyser.fftSize);

  return {
    output: dest.stream,
    setVolume(v: number) {
      const clamped = Math.min(1.5, Math.max(0, v));
      try {
        micGain.gain.setTargetAtTime(clamped, ctx.currentTime, 0.03);
      } catch {
        micGain.gain.value = clamped;
      }
    },
    getLevel() {
      try {
        analyser.getByteTimeDomainData(timeData);
      } catch {
        return 0;
      }
      let sum = 0;
      for (let i = 0; i < timeData.length; i++) {
        const v = (timeData[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / timeData.length);
      // Escala perceptual aproximada.
      return Math.min(1, rms * 3.2);
    },
    dispose() {
      try {
        micSource.disconnect();
        micGain.disconnect();
        analyser.disconnect();
        sysSource?.disconnect();
      } catch {
        /* noop */
      }
      stopStream(micStream);
      // Las pistas del stream de pantalla NO se detienen aquí (no son nuestras).
      for (const t of dest.stream.getTracks()) {
        try {
          t.stop();
        } catch {
          /* noop */
        }
      }
      void ctx.close().catch(() => undefined);
    },
  };
}

export { stopStream };
