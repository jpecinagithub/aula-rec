/**
 * Métricas de producto con Vercel Web Analytics.
 * SOLO eventos de producto. Nunca se envía audio, vídeo, capturas,
 * nombres de archivo ni contenido de pantalla.
 */
import { track } from '@vercel/analytics';

export type ProductEvent =
  | 'recording_started'
  | 'recording_completed'
  | 'recording_cancelled'
  | 'export_started'
  | 'export_completed'
  | 'export_format_mp4'
  | 'export_format_webm'
  | 'preset_youtube_1080'
  | 'preset_youtube_720';

export function trackEvent(name: ProductEvent): void {
  try {
    track(name);
  } catch {
    // Analytics no disponible (p. ej. bloqueador): no debe romper la app.
  }
}
