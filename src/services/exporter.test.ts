import { beforeEach, describe, expect, it, vi } from 'vitest';
import { needsProcessing } from './exporter.ts';
import { exportVideo } from './exporter.ts';
import type { ExportRequest } from './exporter.ts';
import { PRESETS } from '../studio/types.ts';

const execMock = vi.fn();
const deleteFileMock = vi.fn();
const writeFileMock = vi.fn();
const readFileMock = vi.fn();

vi.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: class {
    on() {}
    async load() {}
    writeFile = writeFileMock;
    exec = execMock;
    readFile = readFileMock;
    deleteFile = deleteFileMock;
  },
}));

vi.mock('@ffmpeg/util', () => ({
  fetchFile: async () => new Uint8Array([1, 2, 3]),
  toBlobURL: async (url: string) => url,
}));

function base(over: Partial<ExportRequest> = {}): ExportRequest {
  const p = PRESETS[0]; // youtube-1080 mp4
  return {
    blob: new Blob([]),
    sourceMimeType: 'video/mp4;codecs="avc1.640028,mp4a.40.2"',
    sourceWidth: 1920,
    sourceHeight: 1080,
    durationSec: 120,
    trimStartSec: 0,
    trimEndSec: 120,
    preset: p,
    onProgress: () => undefined,
    ...over,
  };
}

describe('needsProcessing', () => {  it('descarga directa si todo coincide', () => {
    expect(needsProcessing(base())).toBe(false);
  });
  it('requiere procesar si cambia el contenedor', () => {
    expect(needsProcessing(base({ sourceMimeType: 'video/webm;codecs=vp9,opus' }))).toBe(true);
  });
  it('requiere procesar si cambia la resolución', () => {
    expect(needsProcessing(base({ preset: PRESETS[1] }))).toBe(true);
  });
  it('requiere procesar si hay recorte', () => {
    expect(needsProcessing(base({ trimStartSec: 5 }))).toBe(true);
    expect(needsProcessing(base({ trimEndSec: 100 }))).toBe(true);
  });
  it('tolera diferencias mínimas de recorte', () => {
    expect(needsProcessing(base({ trimStartSec: 0.01, trimEndSec: 119.99 }))).toBe(false);
  });
});

describe('exportVideo con ffmpeg (mock)', () => {
  // PRESETS[1] = youtube-720: cambia la resolución -> requiere procesar.
  const needsFfmpeg = () => base({ preset: PRESETS[1] });

  beforeEach(() => {
    execMock.mockReset().mockResolvedValue(0);
    deleteFileMock.mockReset().mockResolvedValue(undefined);
    writeFileMock.mockReset().mockResolvedValue(undefined);
    readFileMock.mockReset().mockResolvedValue(new Uint8Array([9, 9, 9]));
  });

  it('falla si ffmpeg devuelve un código distinto de cero', async () => {
    execMock.mockResolvedValue(1);
    await expect(exportVideo(needsFfmpeg())).rejects.toMatchObject({ code: 'convert-failed' });
  });

  it('verifica el código de salida y limpia los ficheros virtuales', async () => {
    const res = await exportVideo(needsFfmpeg());
    expect(res.usedFfmpeg).toBe(true);
    expect(res.blob).toBeInstanceOf(Blob);
    // La memoria virtual de ffmpeg se libera tras cada exportación.
    expect(deleteFileMock).toHaveBeenCalledWith('input.mp4');
    expect(deleteFileMock).toHaveBeenCalledWith('output.mp4');
  });

  it('limpia los ficheros virtuales aunque falle la conversión', async () => {
    execMock.mockResolvedValue(2);
    await expect(exportVideo(needsFfmpeg())).rejects.toMatchObject({ code: 'convert-failed' });
    expect(deleteFileMock).toHaveBeenCalledWith('input.mp4');
    expect(deleteFileMock).toHaveBeenCalledWith('output.mp4');
  });
});
