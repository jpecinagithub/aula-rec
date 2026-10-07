import { describe, expect, it } from 'vitest';
import { clamp, filenameFor, formatBytes, formatClock, formatDims, formatDurationShort } from './format.ts';

describe('formatClock', () => {
  it('formatea 00:04:27', () => {
    expect(formatClock(4 * 60 * 1000 + 27 * 1000)).toBe('00:04:27');
  });
  it('rellena con ceros', () => {
    expect(formatClock(5_000)).toBe('00:00:05');
  });
  it('soporta horas', () => {
    expect(formatClock(3_661_000)).toBe('01:01:01');
  });
});

describe('formatBytes', () => {
  it('muestra MB con un decimal', () => {
    expect(formatBytes(12_400_000)).toMatch(/MB$/);
  });
  it('bytes pequeños', () => {
    expect(formatBytes(512)).toBe('512 B');
  });
});

describe('formatDurationShort', () => {
  it('segundos y minutos', () => {
    expect(formatDurationShort(27)).toBe('27 s');
    expect(formatDurationShort(267)).toBe('4 min 27 s');
  });
});

describe('filenameFor', () => {
  it('genera grabacion-AAAA-MM-DD-HHMM.ext', () => {
    const d = new Date(2026, 9, 7, 18, 30);
    expect(filenameFor(d, 'mp4')).toBe('grabacion-2026-10-07-1830.mp4');
    expect(filenameFor(d, '.webm')).toBe('grabacion-2026-10-07-1830.webm');
  });
});

describe('clamp y formatDims', () => {
  it('clamp', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
  });
  it('dims', () => {
    expect(formatDims(1920.4, 1080.6)).toBe('1920 × 1081');
  });
});
