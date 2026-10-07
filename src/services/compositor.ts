/**
 * CanvasCompositor — compositor de vídeo en tiempo real.
 * Cada frame dibuja la región seleccionada de la pantalla y, sobre ella,
 * la webcam circular del profesor. El canvas se convierte en MediaStream
 * con canvas.captureStream(fps): el vídeo ya sale compuesto, sin
 * renderizado posterior para el caso básico.
 */
import type { CameraPosition, CameraSettings, CropRect } from '../studio/types.ts';

export interface CompositorConfig {
  width: number;
  height: number;
  fps: number;
}

const LETTERBOX = '#0b0e14';

function cornerXY(
  position: CameraPosition,
  diameter: number,
  margin: number,
  W: number,
  H: number,
): { cx: number; cy: number } {
  switch (position) {
    case 'top-left':
      return { cx: margin + diameter / 2, cy: margin + diameter / 2 };
    case 'top-right':
      return { cx: W - margin - diameter / 2, cy: margin + diameter / 2 };
    case 'bottom-left':
      return { cx: margin + diameter / 2, cy: H - margin - diameter / 2 };
    case 'bottom-right':
    default:
      return { cx: W - margin - diameter / 2, cy: H - margin - diameter / 2 };
  }
}

export class CanvasCompositor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private running = false;
  private screenVideo: HTMLVideoElement | null = null;
  private cameraVideo: HTMLVideoElement | null = null;
  private crop: CropRect = { x: 0, y: 0, w: 1, h: 1 };
  private camera: CameraSettings = { visible: true, position: 'bottom-right', size: 0.16 };
  private fps: number;

  constructor(canvas: HTMLCanvasElement, config: CompositorConfig) {
    this.canvas = canvas;
    this.canvas.width = config.width;
    this.canvas.height = config.height;
    this.fps = config.fps;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D no disponible');
    this.ctx = ctx;
  }

  attachScreen(video: HTMLVideoElement | null): void {
    this.screenVideo = video;
  }

  attachCamera(video: HTMLVideoElement | null): void {
    this.cameraVideo = video;
  }

  setCrop(crop: CropRect): void {
    this.crop = { ...crop };
  }

  setCameraSettings(settings: CameraSettings): void {
    this.camera = { ...settings };
  }

  setOutputSize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  setFps(fps: number): void {
    this.fps = fps;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Convierte el canvas en un MediaStream de vídeo. */
  capture(): MediaStream {
    const stream = this.canvas.captureStream(this.fps);
    if (stream.getVideoTracks().length === 0) {
      throw new Error('captureStream no produjo pista de vídeo');
    }
    return stream;
  }

  private frame = (): void => {
    if (!this.running) return;
    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };

  private draw(): void {
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;

    ctx.fillStyle = LETTERBOX;
    ctx.fillRect(0, 0, W, H);

    // — Fondo: región seleccionada de la pantalla —
    const sv = this.screenVideo;
    if (sv && sv.readyState >= 2 && sv.videoWidth > 0 && sv.videoHeight > 0) {
      const vw = sv.videoWidth;
      const vh = sv.videoHeight;
      const sx = Math.round(this.crop.x * vw);
      const sy = Math.round(this.crop.y * vh);
      const sw = Math.max(2, Math.round(this.crop.w * vw));
      const sh = Math.max(2, Math.round(this.crop.h * vh));
      const srcAspect = sw / sh;
      const dstAspect = W / H;
      // Nunca deformar: cover si el aspecto coincide, contain + letterbox si no.
      const scale =
        Math.abs(srcAspect - dstAspect) / dstAspect < 0.03
          ? Math.max(W / sw, H / sh)
          : Math.min(W / sw, H / sh);
      const dw = sw * scale;
      const dh = sh * scale;
      const dx = (W - dw) / 2;
      const dy = (H - dh) / 2;
      try {
        ctx.drawImage(sv, sx, sy, sw, sh, dx, dy, dw, dh);
      } catch {
        /* frame aún no listo */
      }
    }

    // — Webcam circular del profesor —
    const cv = this.cameraVideo;
    if (
      this.camera.visible &&
      cv &&
      cv.readyState >= 2 &&
      cv.videoWidth > 0 &&
      cv.videoHeight > 0
    ) {
      const sizeFrac = Math.min(0.28, Math.max(0.08, this.camera.size));
      const diameter = sizeFrac * W;
      const r = diameter / 2;
      const margin = Math.max(14, W * 0.018);
      const { cx, cy } = cornerXY(this.camera.position, diameter, margin, W, H);

      try {
        // Máscara realmente circular.
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();
        // Cover dentro del círculo.
        const vw = cv.videoWidth;
        const vh = cv.videoHeight;
        const s = Math.max(diameter / vw, diameter / vh);
        const dw = vw * s;
        const dh = vh * s;
        ctx.drawImage(cv, cx - dw / 2, cy - dh / 2, dw, dh);
        ctx.restore();

        // Borde fino elegante + sombra suave.
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        ctx.shadowBlur = Math.max(12, diameter * 0.12);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.lineWidth = Math.max(3, diameter * 0.022);
        ctx.stroke();
        ctx.restore();
      } catch {
        /* frame aún no listo */
      }
    }
  }
}
