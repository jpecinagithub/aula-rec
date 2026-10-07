/** Tipos centrales de AulaRec. La UI está exclusivamente en español. */

export type AppStatus =
  | 'idle'
  | 'permissions'
  | 'setup'
  | 'countdown'
  | 'recording'
  | 'paused'
  | 'processing'
  | 'preview'
  | 'exporting'
  | 'completed'
  | 'error';

export type CameraPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** Rectángulo de recorte en coordenadas normalizadas (0..1) sobre el vídeo de pantalla. */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CameraSettings {
  visible: boolean;
  position: CameraPosition;
  /** Diámetro del círculo como fracción del ancho del vídeo (0.10 – 0.25). */
  size: number;
}

export type QualityLevel = 'high' | 'medium' | 'low';
export type Container = 'mp4' | 'webm';

export interface OutputPreset {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  fps: number;
  quality: QualityLevel;
  container: Container;
}

export const PRESETS: OutputPreset[] = [
  {
    id: 'youtube-1080',
    name: 'YouTube 1080p',
    description: '1920 × 1080 · 16:9 · 30 fps · calidad alta',
    width: 1920,
    height: 1080,
    fps: 30,
    quality: 'high',
    container: 'mp4',
  },
  {
    id: 'youtube-720',
    name: 'YouTube 720p',
    description: '1280 × 720 · 16:9 · 30 fps · calidad alta',
    width: 1280,
    height: 720,
    fps: 30,
    quality: 'high',
    container: 'mp4',
  },
  {
    id: 'ligero-480',
    name: 'Ligero 480p',
    description: '854 × 480 · 16:9 · 30 fps · archivo pequeño',
    width: 854,
    height: 480,
    fps: 30,
    quality: 'low',
    container: 'mp4',
  },
  {
    id: 'shorts',
    name: 'YouTube Shorts',
    description: '1080 × 1920 · 9:16 · 30 fps · vertical',
    width: 1080,
    height: 1920,
    fps: 30,
    quality: 'high',
    container: 'mp4',
  },
  {
    id: 'cuadrado',
    name: 'Cuadrado 1:1',
    description: '1080 × 1080 · 1:1 · 30 fps',
    width: 1080,
    height: 1080,
    fps: 30,
    quality: 'high',
    container: 'mp4',
  },
];

export interface RecordingMeta {
  durationMs: number;
  width: number;
  height: number;
  mimeType: string;
  sizeBytes: number;
  container: Container;
}

export interface StudioErrorInfo {
  title: string;
  detail: string;
}
