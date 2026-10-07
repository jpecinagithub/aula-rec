/**
 * CanvasCompositor — compositor de vídeo en tiempo real.
 * Cada frame dibuja la región seleccionada de la pantalla y, sobre ella,
 * la webcam circular del profesor. El canvas se convierte en MediaStream
 * con canvas.captureStream(): el vídeo ya sale compuesto, sin
 * renderizado posterior para el caso básico.
 *
 * El ritmo de dibujado lo marca un Web Worker (no requestAnimationFrame),
 * porque rAF se detiene en pestañas ocultas y congelaría el vídeo justo
 * cuando el profesor cambia a la pestaña que quiere explicar. La captura
 * usa modo manual: cada tick dibuja y pide el frame con requestFrame().
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
  private running = false;
  private timerWorker: Worker | null = null;
  private timerWorkerUrl: string | null = null;
  private intervalId = 0;
  private videoTrack: CanvasCaptureMediaStreamTrack | null = null;
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
    if (fps === this.fps) return;
    this.fps = fps;
    if (this.running) {
      this.stopTimer();
      this.startTimer();
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.startTimer();
  }

  stop(): void {
    this.running = false;
    this.stopTimer();
    this.videoTrack = null;
  }

  /**
   * Arranca el temporizador de frames. Un Web Worker dedicado mantiene el
   * ritmo aunque la pestaña pase a segundo plano (rAF se detendría y el
   * vídeo grabado quedaría congelado en el último frame).
   */
  private startTimer(): void {
    const intervalMs = Math.max(16, Math.round(1000 / this.fps));
    if (typeof Worker !== 'undefined') {
      try {
        const src = `setInterval(function(){postMessage(0)},${intervalMs});`;
        this.timerWorkerUrl = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
        const worker = new Worker(this.timerWorkerUrl);
        worker.onmessage = () => this.tick();
        this.timerWorker = worker;
        return;
      } catch {
        // Sin Worker disponible: fallback a setInterval en el hilo principal.
      }
    }
    this.intervalId = window.setInterval(() => this.tick(), intervalMs);
  }

  private stopTimer(): void {
    if (this.timerWorker) {
      this.timerWorker.terminate();
      this.timerWorker = null;
    }
    if (this.timerWorkerUrl) {
      URL.revokeObjectURL(this.timerWorkerUrl);
      this.timerWorkerUrl = null;
    }
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = 0;
    }
  }

  /** Convierte el canvas en un MediaStream de vídeo. */
  capture(): MediaStream {
    // Modo manual (frameRate 0): el navegador solo captura un frame cuando se
    // llama a requestFrame(), y lo hacemos en cada tick del worker. Así cada
    // frame dibujado llega al MediaRecorder aunque la pestaña esté oculta.
    let stream: MediaStream | null = null;
    try {
      const candidate = this.canvas.captureStream(0);
      const track = candidate.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack | undefined;
      if (track && typeof track.requestFrame === 'function') {
        stream = candidate;
        this.videoTrack = track;
      }
    } catch {
      stream = null;
    }
    if (!stream) {
      // Fallback: modo automático (el navegador captura al ritmo indicado).
      stream = this.canvas.captureStream(this.fps);
      this.videoTrack = null;
    }
    if (stream.getVideoTracks().length === 0) {
      throw new Error('captureStream no produjo pista de vídeo');
    }
    return stream;
  }

  private tick = (): void => {
    if (!this.running) return;
    this.draw();
    const track = this.videoTrack;
    if (track) {
      try {
        track.requestFrame();
      } catch {
        // Si requestFrame falla puntualmente, se sigue dibujando.
      }
    }
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
