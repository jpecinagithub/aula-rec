/**
 * @vitest-environment jsdom
 *
 * TEST GLOBAL del flujo de AulaRec con las APIs del navegador simuladas:
 * wizard → setup → countdown → grabación → pausa/reanudar → finalizar →
 * preview → exportar, más el caso de pantalla detenida desde el navegador.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { StudioProvider, useStudio } from './StudioContext.tsx';
import type { StudioValue } from './StudioContext.tsx';
import { PRESETS } from './types.ts';

vi.mock('../lib/analytics.ts', () => ({ trackEvent: vi.fn() }));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// ——— Mocks ———

interface FakeTrack {
  kind: string;
  stop: () => void;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}
const createdTracks: FakeTrack[] = [];

function fakeTrack(kind: string): FakeTrack {
  const t: FakeTrack = {
    kind,
    stop: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  createdTracks.push(t);
  return t;
}

function fakeStream(opts: { video?: boolean; audio?: boolean } = {}) {
  const tracks = [
    ...(opts.video === false ? [] : [fakeTrack('video')]),
    ...(opts.audio ? [fakeTrack('audio')] : []),
  ];
  return {
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter((t) => t.kind === 'video'),
    getAudioTracks: () => tracks.filter((t) => t.kind === 'audio'),
  };
}

class MockMediaStream {
  tracks: FakeTrack[];
  constructor(tracks: FakeTrack[] = []) {
    this.tracks = tracks;
  }
  getTracks() {
    return this.tracks;
  }
  getVideoTracks() {
    return this.tracks.filter((t) => t.kind === 'video');
  }
  getAudioTracks() {
    return this.tracks.filter((t) => t.kind === 'audio');
  }
}

class MockMediaRecorder {
  static isTypeSupported = (mime: string) => mime.startsWith('video/mp4');
  static instances: MockMediaRecorder[] = [];
  state = 'inactive';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  stream: MockMediaStream;
  options?: { mimeType?: string };
  constructor(stream: MockMediaStream, options?: { mimeType?: string }) {
    this.stream = stream;
    this.options = options;
    MockMediaRecorder.instances.push(this);
  }
  start() {
    this.state = 'recording';
  }
  pause() {
    if (this.state === 'recording') this.state = 'paused';
  }
  resume() {
    if (this.state === 'paused') this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({
      data: new Blob(['x'.repeat(1024)], { type: this.options?.mimeType ?? 'video/mp4' }),
    });
    this.onstop?.();
  }
}

function fakeAudioNode() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { value: 1, setTargetAtTime: vi.fn() },
  };
}
class MockAudioContext {
  currentTime = 0;
  resume = vi.fn(async () => undefined);
  close = vi.fn(async () => undefined);
  createMediaStreamSource = vi.fn(() => fakeAudioNode());
  createGain = vi.fn(() => fakeAudioNode());
  createAnalyser = vi.fn(() => ({
    ...fakeAudioNode(),
    fftSize: 512,
    smoothingTimeConstant: 0.6,
    getByteTimeDomainData: vi.fn((arr: Uint8Array) => arr.fill(128)),
  }));
  createMediaStreamDestination = vi.fn(() => ({
    ...fakeAudioNode(),
    stream: fakeStream({ video: false, audio: true }),
  }));
}

// ——— Harness ———

let studio: StudioValue | null = null;
function Driver() {
  studio = useStudio();
  return null;
}

describe('flujo global de grabación', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  beforeEach(async () => {
    createdTracks.length = 0;
    MockMediaRecorder.instances.length = 0;

    const mediaDevices = {
      // La pantalla compartida incluye audio del sistema en estos tests.
      getDisplayMedia: vi.fn(async () => fakeStream({ video: true, audio: true })),
      getUserMedia: vi.fn(async (c: { video?: unknown; audio?: unknown }) =>
        c?.video ? fakeStream({ video: true }) : fakeStream({ video: false, audio: true }),
      ),
      enumerateDevices: vi.fn(async () => []),
    };
    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: mediaDevices,
      configurable: true,
    });

    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    vi.stubGlobal('MediaStream', MockMediaStream);
    (window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext;
    vi.spyOn(HTMLVideoElement.prototype, 'play').mockResolvedValue(undefined);
    (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(
      () => 'blob:mock-url',
    );
    (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();

    const ctxStub = new Proxy(
      {},
      {
        get: (_t, p) =>
          p === 'canvas'
            ? document.createElement('canvas')
            : (..._args: unknown[]) => undefined,
      },
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctxStub as unknown as RenderingContext,
    );
    (HTMLCanvasElement.prototype as unknown as { captureStream: unknown }).captureStream =
      vi.fn(() => fakeStream({ video: true }));
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(
        <StudioProvider>
          <Driver />
        </StudioProvider>,
      );
    });
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    host?.remove();
    host = null;
    studio = null;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function goToRecording() {
    const s = () => studio as StudioValue;
    await act(async () => {
      s().startWizard();
    });
    expect(s().status).toBe('permissions');
    await act(async () => {
      await s().requestScreen();
    });
    expect(s().screenActive).toBe(true);
    act(() => {
      s().setWizardStep(1);
    });
    await act(async () => {
      await s().requestCamera();
    });
    expect(s().cameraActive).toBe(true);
    act(() => {
      s().setWizardStep(2);
    });
    await act(async () => {
      await s().requestMic();
    });
    expect(s().micActive).toBe(true);
    act(() => {
      s().goToSetup();
    });
    expect(s().status).toBe('setup');
    act(() => {
      s().startCountdown();
    });
    expect(s().status).toBe('countdown');
    act(() => {
      s().beginRecording();
    });
    expect(s().status).toBe('recording');
    expect(MockMediaRecorder.instances.length).toBe(1);
  }

  it('graba, pausa, reanuda, finaliza y exporta (descarga directa)', async () => {
    const s = () => studio as StudioValue;
    await goToRecording();

    act(() => {
      s().pauseRecording();
    });
    expect(s().status).toBe('paused');
    act(() => {
      s().resumeRecording();
    });
    expect(s().status).toBe('recording');

    await act(async () => {
      await s().finishRecording('user');
    });
    expect(s().status).toBe('preview');
    expect(s().previewUrl).toBe('blob:mock-url');
    expect(s().meta).not.toBeNull();
    expect(s().meta?.container).toBe('mp4');
    expect(s().meta?.width).toBe(1920);

    act(() => {
      s().applyTrim(0, 0);
    });
    await act(async () => {
      await s().startExport(PRESETS[0]); // YouTube 1080p == grabación → directa
    });
    expect(s().status).toBe('completed');
    expect(s().downloadUrl).toBe('blob:mock-url');
    expect(s().downloadName).toMatch(/^grabacion-.*\.mp4$/);

    act(() => {
      s().resetAll();
    });
    expect(s().status).toBe('idle');
  });

  it('si el navegador detiene la pantalla, conserva lo grabado y avisa', async () => {
    const s = () => studio as StudioValue;
    await goToRecording();

    const videoTrack = createdTracks.find((t) => t.kind === 'video');
    const endedCall = videoTrack?.addEventListener.mock.calls.find(([ev]) => ev === 'ended');
    expect(endedCall).toBeTruthy();

    await act(async () => {
      (endedCall?.[1] as () => void)();
    });
    expect(s().status).toBe('preview');
    expect(s().previewUrl).toBe('blob:mock-url');
    expect(s().notice).toMatch(/compartir la pantalla/i);
  });

  it('cancelar descarta la grabación sin rastro', async () => {
    const s = () => studio as StudioValue;
    await goToRecording();
    act(() => {
      s().cancelRecording();
    });
    expect(s().status).toBe('idle');
    expect(s().previewUrl).toBeNull();
  });

  it('la duración usa reloj de pared: no se subestima con la pestaña oculta', async () => {    // Simula el throttling de Chrome en pestañas ocultas: el tiempo avanza
    // 33s pero el intervalo del cronómetro no dispara ni una vez.
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    try {
      const s = () => studio as StudioValue;
      await goToRecording();
      // 33 segundos reales sin ticks del intervalo.
      vi.setSystemTime(1_000_000 + 33_000);
      await act(async () => {
        await s().finishRecording('user');
      });
      expect(s().status).toBe('preview');
      // Con el cronómetro antiguo (acumular ticks) daría ~0ms.
      expect(s().meta?.durationMs ?? 0).toBeGreaterThan(30_000);
    } finally {
      vi.useRealTimers();
    }
  });

  it('graba solo con audio del sistema si se omite el micrófono', async () => {
    const s = () => studio as StudioValue;
    await act(async () => {
      s().startWizard();
    });
    act(() => {
      s().setSystemAudio(true);
    });
    await act(async () => {
      await s().requestScreen();
    });
    act(() => {
      s().setWizardStep(1);
    });
    await act(async () => {
      await s().requestCamera();
    });
    act(() => {
      s().setWizardStep(2);
    });
    // Omitir el micrófono: no se crea mezclador.
    act(() => {
      s().skipMic();
    });
    act(() => {
      s().goToSetup();
    });
    act(() => {
      s().startCountdown();
    });
    act(() => {
      s().beginRecording();
    });
    expect(s().status).toBe('recording');
    const rec = MockMediaRecorder.instances[0];
    // El vídeo lleva la pista de audio del sistema aunque no haya micrófono.
    expect(rec.stream.getVideoTracks()).toHaveLength(1);
    expect(rec.stream.getAudioTracks()).toHaveLength(1);
  });

  it('requestMic usa el deviceId explícito sin leer estado obsoleto', async () => {
    const s = () => studio as StudioValue;
    await goToRecording();
    const gum = (
      window.navigator as unknown as { mediaDevices: { getUserMedia: ReturnType<typeof vi.fn> } }
    ).mediaDevices.getUserMedia;
    gum.mockClear();
    await act(async () => {
      await s().requestMic('nuevo-micro-id');
    });
    const lastArgs = gum.mock.calls[gum.mock.calls.length - 1][0] as {
      audio: { deviceId?: { exact: string } };
    };
    expect(lastArgs.audio.deviceId?.exact).toBe('nuevo-micro-id');
  });

  it('reseleccionar la pantalla reconstruye el mezclador con la nueva captura', async () => {
    const s = () => studio as StudioValue;
    await goToRecording();
    const gum = (
      window.navigator as unknown as { mediaDevices: { getUserMedia: ReturnType<typeof vi.fn> } }
    ).mediaDevices.getUserMedia;
    const before = gum.mock.calls.length;
    await act(async () => {
      await s().requestScreen();
    });
    // El micrófono se vuelve a solicitar para mezclar el audio nuevo.
    expect(gum.mock.calls.length).toBe(before + 1);
  });

  it('el modo YouTube es honesto: se apaga al personalizar y al desactivarlo a mano', async () => {
    const s = () => studio as StudioValue;
    await goToRecording();
    // Los valores por defecto coinciden con el preset.
    expect(s().youtubeMode).toBe(true);
    // Cambiar la calidad lo desactiva solo.
    act(() => {
      s().setQuality('low');
    });
    expect(s().youtubeMode).toBe(false);
    // Reactivarlo aplica el preset.
    act(() => {
      s().setYoutubeMode(true);
    });
    expect(s().youtubeMode).toBe(true);
    expect(s().quality).toBe('high');
    expect(s().fps).toBe(30);
    // Desactivarlo a mano lo mantiene apagado aunque los valores coincidan.
    act(() => {
      s().setYoutubeMode(false);
    });
    expect(s().youtubeMode).toBe(false);
    // Cambiar fps también lo desactiva (vuelve a automático).
    act(() => {
      s().setFps(60);
    });
    expect(s().youtubeMode).toBe(false);
  });
});
