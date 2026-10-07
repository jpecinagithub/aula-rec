import { describe, expect, it } from 'vitest';
import { bitrateFor, containerOfMime, estimateSizeMB, formatMB, recommendedMaxMinutes } from './recorder.ts';

describe('bitrateFor', () => {
  it('1080p alta ≈ 12 Mbps', () => {
    expect(bitrateFor('high', 1920, 1080)).toBe(12_000_000);
  });
  it('escala con los píxeles', () => {
    expect(bitrateFor('high', 1280, 720)).toBeLessThan(12_000_000);
    expect(bitrateFor('high', 1280, 720)).toBeGreaterThan(2_000_000);
  });
  it('respeta mínimo y máximo', () => {
    expect(bitrateFor('low', 320, 240)).toBeGreaterThanOrEqual(800_000);
    expect(bitrateFor('high', 7680, 4320)).toBeLessThanOrEqual(20_000_000);
  });
});

describe('containerOfMime', () => {
  it('detecta mp4 y webm', () => {
    expect(containerOfMime('video/mp4;codecs="avc1.640028,mp4a.40.2"')).toBe('mp4');
    expect(containerOfMime('video/webm;codecs=vp9,opus')).toBe('webm');
    expect(containerOfMime('')).toBe('webm');
  });
});

describe('estimación honesta de tamaño', () => {
  it('10 min a 1080p alta ≈ 900 MB', () => {
    const mb = estimateSizeMB(bitrateFor('high', 1920, 1080), 10);
    expect(mb).toBeGreaterThan(800);
    expect(mb).toBeLessThan(1000);
  });
  it('recomienda ~16 min como máximo a 1080p alta', () => {
    const max = recommendedMaxMinutes(bitrateFor('high', 1920, 1080));
    expect(max).toBeGreaterThanOrEqual(14);
    expect(max).toBeLessThanOrEqual(18);
  });
  it('a menor calidad el máximo recomendado es mayor', () => {
    const hi = recommendedMaxMinutes(bitrateFor('high', 1920, 1080));
    const lo = recommendedMaxMinutes(bitrateFor('low', 854, 480));
    expect(lo).toBeGreaterThan(hi);
  });
  it('formatMB muestra GB a partir de 1000 MB', () => {
    expect(formatMB(90)).toBe('90 MB');
    expect(formatMB(1500)).toBe('1,5 GB');
  });
});
