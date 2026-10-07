/**
 * RecordingService — envoltura de MediaRecorder con detección de codecs.
 * Usa start(timeslice) para recibir chunks periódicos: las grabaciones
 * largas (5–60 min) no dependen de un único Blob gigantesco en memoria.
 */
import type { Container, QualityLevel } from '../studio/types.ts';

export interface RecorderChoice {
  mimeType: string;
  container: Container;
  bitsPerSecond: number;
}

const MP4_CANDIDATES = [
  'video/mp4;codecs="avc1.640028,mp4a.40.2"',
  'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
  'video/mp4',
];

const WEBM_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=h264,opus',
  'video/webm',
];

/** Primer mime soportado; MP4 primero cuando es posible (listo para YouTube). */
export function chooseRecordingMime(preferMp4 = true): RecorderChoice | null {
  if (typeof window.MediaRecorder === 'undefined' || !window.MediaRecorder.isTypeSupported) {
    return null;
  }
  const ordered = preferMp4
    ? [...MP4_CANDIDATES, ...WEBM_CANDIDATES]
    : [...WEBM_CANDIDATES, ...MP4_CANDIDATES];
  for (const mimeType of ordered) {
    try {
      if (window.MediaRecorder.isTypeSupported(mimeType)) {
        return {
          mimeType,
          container: mimeType.startsWith('video/mp4') ? 'mp4' : 'webm',
          bitsPerSecond: 0, // lo fija bitrateFor()
        };
      }
    } catch {
      /* probar el siguiente */
    }
  }
  return null;
}

/** Bitrate orientativo según calidad y píxeles (1080p alta ≈ 12 Mbps). */
export function bitrateFor(quality: QualityLevel, width: number, height: number): number {
  const pixels = Math.max(1, width * height);
  const base = quality === 'high' ? 12_000_000 : quality === 'medium' ? 6_000_000 : 2_500_000;
  const scaled = Math.round((base * pixels) / (1920 * 1080));
  return Math.min(20_000_000, Math.max(800_000, scaled));
}

/**
 * Umbral honesto de memoria: por encima de ~1,5 GB estimados (fragmentos en
 * RAM + Blob final + posible copia de ffmpeg) la grabación puede volverse
 * inestable en muchos equipos.
 */
export const RECORDING_WARN_BYTES = 1.5e9;

/** MB estimados para una duración dada al bitrate indicado. */
export function estimateSizeMB(bitrateBps: number, minutes: number): number {
  return ((bitrateBps / 8) * (minutes * 60)) / 1e6;
}

/** Minutos recomendados como máximo antes de avisar (para no superar el umbral). */
export function recommendedMaxMinutes(bitrateBps: number): number {
  return Math.max(1, Math.floor(RECORDING_WARN_BYTES / (bitrateBps / 8) / 60));
}

export function formatMB(mb: number): string {
  if (mb >= 1000) return `${(mb / 1000).toFixed(1).replace('.', ',')} GB`;
  return `${Math.round(mb)} MB`;
}

export function containerOfMime(mimeType: string): Container {
  return mimeType.includes('mp4') ? 'mp4' : 'webm';
}

export class ClipRecorder {
  private rec: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private stream: MediaStream;
  private choice: RecorderChoice;
  onError: (e: Error) => void = () => undefined;

  constructor(stream: MediaStream, choice: RecorderChoice) {
    this.stream = stream;
    this.choice = choice;
  }

  get state(): 'inactive' | 'recording' | 'paused' {
    if (!this.rec) return 'inactive';
    return this.rec.state as 'inactive' | 'recording' | 'paused';
  }

  get chunkCount(): number {
    return this.chunks.length;
  }

  start(timesliceMs = 5000): void {
    if (this.rec) throw new Error('El grabador ya está en marcha');
    const rec = new MediaRecorder(this.stream, {
      mimeType: this.choice.mimeType,
      videoBitsPerSecond: this.choice.bitsPerSecond,
    });
    rec.ondataavailable = (ev: BlobEvent) => {
      if (ev.data && ev.data.size > 0) this.chunks.push(ev.data);
    };
    rec.onerror = () => {
      this.onError(new Error('MediaRecorder emitió un error durante la grabación'));
    };
    this.rec = rec;
    rec.start(timesliceMs);
  }

  pause(): void {
    if (this.rec && this.rec.state === 'recording') this.rec.pause();
  }

  resume(): void {
    if (this.rec && this.rec.state === 'paused') this.rec.resume();
  }

  /** Detiene y resuelve con el Blob final (aunque esté parcial). */
  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      const rec = this.rec;
      const finish = () => {
        resolve(new Blob(this.chunks, { type: this.choice.mimeType }));
      };
      if (!rec || rec.state === 'inactive') {
        finish();
        return;
      }
      // Seguridad: si 'stop' no llega, resolvemos con lo que haya.
      const watchdog = window.setTimeout(finish, 4000);
      rec.onstop = () => {
        window.clearTimeout(watchdog);
        finish();
      };
      try {
        rec.stop();
      } catch {
        window.clearTimeout(watchdog);
        finish();
      }
    });
  }
}
