import { describe, expect, it } from 'vitest';
import { bitrateFor, containerOfMime } from './recorder.ts';

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
