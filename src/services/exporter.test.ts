import { describe, expect, it } from 'vitest';
import { needsProcessing } from './exporter.ts';
import type { ExportRequest } from './exporter.ts';
import { PRESETS } from '../studio/types.ts';

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

describe('needsProcessing', () => {
  it('descarga directa si todo coincide', () => {
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
