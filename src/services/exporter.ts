/**
 * ExportService — exportación al preset elegido.
 * Camino rápido: si la grabación ya coincide con el preset (formato,
 * resolución y sin recorte), se descarga tal cual, sin procesar.
 * Fallback: ffmpeg.wasm cargado de forma LAZY (import dinámico + núcleo
 * desde CDN) solo cuando hace falta convertir, recortar o reescalar.
 * Todo ocurre en el navegador; nada se sube a ningún servidor.
 */
import type { Container, OutputPreset, QualityLevel } from '../studio/types.ts';
import { clamp } from '../lib/format.ts';

export type ExportErrorCode = 'load-failed' | 'convert-failed';

export class ExportError extends Error {
  code: ExportErrorCode;
  constructor(code: ExportErrorCode, message: string) {
    super(message);
    this.name = 'ExportError';
    this.code = code;
  }
}

export interface ExportRequest {
  blob: Blob;
  sourceMimeType: string;
  sourceWidth: number;
  sourceHeight: number;
  durationSec: number;
  trimStartSec: number;
  trimEndSec: number;
  preset: OutputPreset;
  onProgress: (ratio: number) => void;
}

export interface ExportResult {
  blob: Blob;
  ext: Container;
  usedFfmpeg: boolean;
}

function sourceContainer(mime: string): Container {
  return mime.includes('mp4') ? 'mp4' : 'webm';
}

/** ¿Hace falta procesar, o vale descarga directa? */
export function needsProcessing(req: ExportRequest): boolean {
  const p = req.preset;
  if (sourceContainer(req.sourceMimeType) !== p.container) return true;
  if (req.sourceWidth !== p.width || req.sourceHeight !== p.height) return true;
  if (req.trimStartSec > 0.05) return true;
  if (req.trimEndSec < req.durationSec - 0.05) return true;
  return false;
}

const CRF_MP4: Record<QualityLevel, number> = { high: 18, medium: 23, low: 28 };
const CRF_WEBM: Record<QualityLevel, number> = { high: 28, medium: 33, low: 40 };

// Instancia reutilizable (el núcleo pesa ~30 MB; se carga una sola vez).
let ffmpegInstance: unknown | null = null;
let ffmpegLoading: Promise<unknown> | null = null;
let fetchFileFn: ((b: Blob) => Promise<unknown>) | null = null;

async function getFfmpeg(onProgress: (r: number) => void): Promise<{
  writeFile: (name: string, data: unknown) => Promise<void>;
  exec: (args: string[]) => Promise<void>;
  readFile: (name: string) => Promise<unknown>;
}> {
  if (ffmpegInstance) return ffmpegInstance as never;
  if (!ffmpegLoading) {
    ffmpegLoading = (async () => {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { fetchFile, toBlobURL } = await import('@ffmpeg/util');
      const ffmpeg = new FFmpeg();
      ffmpeg.on('progress', ({ progress }: { progress: number }) => {
        onProgress(clamp(progress || 0, 0, 1));
      });
      // Núcleo single-thread desde CDN: no requiere cabeceras COOP/COEP.
      const base = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
      try {
        await ffmpeg.load({
          coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
        });
      } catch (e) {
        console.warn('[AulaRec] ffmpeg.wasm no se pudo cargar:', e);
        throw new ExportError(
          'load-failed',
          'No se pudo cargar el conversor de vídeo (se necesita conexión a internet).',
        );
      }
      // Envolvemos fetchFile para no exponerlo fuera.
      const api = {
        writeFile: async (name: string, data: unknown): Promise<void> => {
          await ffmpeg.writeFile(name, data as never);
        },
        exec: (args: string[]) => ffmpeg.exec(args),
        readFile: (name: string) => ffmpeg.readFile(name) as Promise<unknown>,
      };
      ffmpegInstance = api;
      fetchFileFn = fetchFile as (b: Blob) => Promise<unknown>;
      return api;
    })().catch((e) => {
      ffmpegLoading = null;
      throw e;
    });
  }
  return (await ffmpegLoading) as never;
}

export async function exportVideo(req: ExportRequest): Promise<ExportResult> {
  const preset = req.preset;

  if (!needsProcessing(req)) {
    req.onProgress(1);
    return { blob: req.blob, ext: sourceContainer(req.sourceMimeType), usedFfmpeg: false };
  }

  const ff = await getFfmpeg(req.onProgress);
  const inExt = sourceContainer(req.sourceMimeType);
  const outExt: Container = preset.container;
  const inputName = `input.${inExt}`;
  const outputName = `output.${outExt}`;

  const fetchFile = fetchFileFn;
  if (!fetchFile) throw new ExportError('load-failed', 'El conversor no se inicializó correctamente.');
  await ff.writeFile(inputName, await fetchFile(req.blob));

  const start = Math.max(0, req.trimStartSec);
  const dur = Math.max(0.1, req.trimEndSec - start);
  // Nunca deformar: reescala encajando y rellena con letterbox.
  const vf =
    `scale=${preset.width}:${preset.height}:force_original_aspect_ratio=decrease,` +
    `pad=${preset.width}:${preset.height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`;

  const args: string[] = [
    '-ss',
    start.toFixed(3),
    '-i',
    inputName,
    '-t',
    dur.toFixed(3),
    '-vf',
    vf,
    '-r',
    String(preset.fps),
  ];

  if (outExt === 'mp4') {
    args.push(
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      String(CRF_MP4[preset.quality]),
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      outputName,
    );
  } else {
    args.push(
      '-c:v',
      'libvpx-vp9',
      '-crf',
      String(CRF_WEBM[preset.quality]),
      '-b:v',
      '0',
      '-c:a',
      'libopus',
      '-b:a',
      '128k',
      outputName,
    );
  }

  try {
    await ff.exec(args);
  } catch (e) {
    console.warn('[AulaRec] ffmpeg exec falló:', e);
    throw new ExportError('convert-failed', 'La conversión del vídeo falló.');
  }

  const data = (await ff.readFile(outputName)) as Uint8Array;
  // Copiamos a un ArrayBuffer propio: el buffer de ffmpeg puede reutilizarse.
  const bytes = new Uint8Array(data.byteLength);
  bytes.set(data);
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: outExt === 'mp4' ? 'video/mp4' : 'video/webm',
  });
  req.onProgress(1);
  return { blob, ext: outExt, usedFfmpeg: true };
}
