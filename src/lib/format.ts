/** Utilidades puras de formato (es-ES). Sin dependencias del DOM. */

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** 00:04:27 — solo cuenta tiempo realmente grabado (lo calcula el cronómetro). */
export function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** "12,4 MB" */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = bytes / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v.toLocaleString('es-ES', { maximumFractionDigits: 1 })} ${units[u]}`;
}

/** "4 min 27 s" para metadatos. */
export function formatDurationShort(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m === 0) return `${rest} s`;
  return `${m} min ${rest} s`;
}

/** grabacion-2026-10-07-1830.mp4 */
export function filenameFor(date: Date, ext: string): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const cleanExt = ext.replace(/^\./, '').toLowerCase() || 'mp4';
  return (
    `grabacion-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}.${cleanExt}`
  );
}

/** "1920 × 1080" */
export function formatDims(w: number, h: number): string {
  return `${Math.round(w)} × ${Math.round(h)}`;
}
