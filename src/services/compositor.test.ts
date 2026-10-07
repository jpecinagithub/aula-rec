/**
 * @vitest-environment jsdom
 *
 * El compositor debe seguir dibujando aunque la pestaña pase a segundo plano
 * (requestAnimationFrame se detiene ahí). Por eso el ritmo lo marca un
 * temporizador y la captura usa modo manual con requestFrame().
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { CanvasCompositor } from './compositor.ts';

function stubCtx() {
  const stub = new Proxy(
    {},
    {
      get: (_t, p) =>
        p === 'canvas'
          ? document.createElement('canvas')
          : (..._args: unknown[]) => undefined,
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    stub as unknown as RenderingContext,
  );
}

describe('CanvasCompositor (temporizador de frames)', () => {
  beforeEach(() => {
    stubCtx();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('usa requestFrame en cada tick cuando la pista lo soporta', () => {
    const requestFrame = vi.fn();
    const captureStream = vi.fn((fps?: number) => ({
      getVideoTracks: () =>
        fps === 0 ? [{ requestFrame }] : [{ /* sin requestFrame */ }],
    }));
    const canvas = document.createElement('canvas');
    canvas.captureStream = captureStream as unknown as typeof canvas.captureStream;

    const comp = new CanvasCompositor(canvas, { width: 1280, height: 720, fps: 30 });
    const stream = comp.capture();
    // Modo manual: se pidió captureStream(0).
    expect(captureStream).toHaveBeenCalledWith(0);
    expect(stream.getVideoTracks()).toHaveLength(1);

    comp.start();
    vi.advanceTimersByTime(200);
    comp.stop();
    // ~6 ticks a 30fps → un requestFrame por tick dibujado.
    expect(requestFrame.mock.calls.length).toBeGreaterThan(3);
  });

  it('recurre al modo automático si no hay requestFrame', () => {
    const captureStream = vi.fn((fps?: number) => ({
      getVideoTracks: () => [{ kind: 'video' }],
      __fps: fps,
    }));
    const canvas = document.createElement('canvas');
    canvas.captureStream = captureStream as unknown as typeof canvas.captureStream;

    const comp = new CanvasCompositor(canvas, { width: 1280, height: 720, fps: 30 });
    const stream = comp.capture();
    // Sin requestFrame: segundo intento con captureStream(30).
    expect(captureStream).toHaveBeenLastCalledWith(30);
    expect(stream.getVideoTracks()).toHaveLength(1);

    comp.start();
    vi.advanceTimersByTime(200);
    comp.stop();
    // No debe lanzar aunque no haya requestFrame.
  });

  it('setFps reinicia el temporizador sin romper el ritmo', () => {
    const captureStream = vi.fn(() => ({ getVideoTracks: () => [{ kind: 'video' }] }));
    const canvas = document.createElement('canvas');
    canvas.captureStream = captureStream as unknown as typeof canvas.captureStream;

    const comp = new CanvasCompositor(canvas, { width: 1280, height: 720, fps: 30 });
    comp.start();
    expect(() => comp.setFps(60)).not.toThrow();
    vi.advanceTimersByTime(200);
    comp.stop();
  });

  it('reanuda en cada tick los vídeos que quedaron pausados', () => {
    const captureStream = vi.fn(() => ({ getVideoTracks: () => [{ kind: 'video' }] }));
    const canvas = document.createElement('canvas');
    canvas.captureStream = captureStream as unknown as typeof canvas.captureStream;

    const comp = new CanvasCompositor(canvas, { width: 1280, height: 720, fps: 30 });
    const video = document.createElement('video');
    const playSpy = vi.spyOn(video, 'play').mockResolvedValue(undefined);
    // Simula el vídeo pausado (Chrome lo pausa al desmontarlo del DOM).
    Object.defineProperty(video, 'paused', { value: true, configurable: true });
    comp.attachScreen(video);

    comp.start();
    vi.advanceTimersByTime(100);
    comp.stop();
    // El tick debe intentar reanudarlo.
    expect(playSpy).toHaveBeenCalled();
  });
});
