/**
 * StudioContext — orquesta toda la aplicación.
 * Máquina de estados: idle → permissions → setup → countdown →
 * recording ⇄ paused → processing → preview → exporting → completed (+ error).
 * Toda la lógica de transición vive aquí; los componentes solo consumen.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import type {
  AppStatus,
  CameraSettings,
  CropRect,
  OutputPreset,
  QualityLevel,
  RecordingMeta,
  StudioErrorInfo,
} from './types.ts';
import { useBrowserSupport } from '../hooks/useBrowserSupport.ts';
import { useScreenCapture } from '../hooks/useScreenCapture.ts';
import { useCamera } from '../hooks/useCamera.ts';
import { useMicrophone } from '../hooks/useMicrophone.ts';
import { useCompositor } from '../hooks/useCompositor.ts';
import { useRecorder } from '../hooks/useRecorder.ts';
import { bitrateFor, chooseRecordingMime, containerOfMime } from '../services/recorder.ts';
import type { RecorderChoice } from '../services/recorder.ts';
import { exportVideo } from '../services/exporter.ts';
import { stopStream } from '../services/screenCapture.ts';
import type { ScreenCaptureError } from '../services/screenCapture.ts';
import type { CameraError } from '../services/camera.ts';
import type { MicError } from '../services/audio.ts';
import { filenameFor } from '../lib/format.ts';
import { trackEvent } from '../lib/analytics.ts';
import type { SupportReport } from '../services/browserSupport.ts';

export type ScreenMode = 'full' | 'region';

export interface StudioValue {
  status: AppStatus;
  support: SupportReport;
  wizardStep: number;
  screenMode: ScreenMode;
  crop: CropRect;
  camera: CameraSettings;
  cameraDeviceId: string;
  micDeviceId: string;
  micSkipped: boolean;
  systemAudio: boolean;
  outWidth: number;
  outHeight: number;
  fps: number;
  quality: QualityLevel;
  youtubeMode: boolean;
  showCropEditor: boolean;
  recordedMs: number;
  meta: RecordingMeta | null;
  previewUrl: string | null;
  notice: string | null;
  error: StudioErrorInfo | null;
  trim: { start: number; end: number };
  exportProgress: number | null;
  downloadUrl: string | null;
  downloadName: string;
  portalTarget: HTMLElement | null;

  // Hooks expuestos
  screenActive: boolean;
  screenHasSystemAudio: boolean;
  screenVideoRef: RefObject<HTMLVideoElement | null>;
  screenError: ScreenCaptureError | null;
  cameraActive: boolean;
  cameraVideoRef: RefObject<HTMLVideoElement | null>;
  cameraDevices: { deviceId: string; label: string }[];
  cameraError: CameraError | null;
  micActive: boolean;
  micVolume: number;
  micLabel: string;
  micDevices: { deviceId: string; label: string }[];
  micError: MicError | null;
  getMicLevel: () => number;

  // Acciones
  setPortalTarget: (el: HTMLElement | null) => void;
  startWizard: () => void;
  setWizardStep: (n: number) => void;
  requestScreen: () => Promise<MediaStream>;
  setScreenMode: (m: ScreenMode) => void;
  setCrop: (c: CropRect) => void;
  setShowCropEditor: (v: boolean) => void;
  requestCamera: (deviceId?: string) => Promise<void>;
  setCameraDeviceId: (id: string) => void;
  patchCamera: (p: Partial<CameraSettings>) => void;
  requestMic: () => Promise<void>;
  skipMic: () => void;
  setMicDeviceId: (id: string) => void;
  setMicVolume: (v: number) => void;
  setSystemAudio: (v: boolean) => void;
  setOutSize: (w: number, h: number) => void;
  setFps: (f: number) => void;
  setQuality: (q: QualityLevel) => void;
  setYoutubeMode: (on: boolean) => void;
  goToSetup: () => void;
  backToWizard: () => void;
  /** Canvas maestro del compositor (un único elemento, propiedad del contexto). */
  getMasterCanvas: () => HTMLCanvasElement;
  startCountdown: () => void;
  beginRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  finishRecording: (reason?: 'user' | 'screen-stopped' | 'recorder-error') => void;
  cancelRecording: () => void;
  applyTrim: (start: number, end: number) => void;
  startExport: (preset: OutputPreset) => void;
  downloadExport: () => void;
  resetAll: () => void;
  dismissNotice: () => void;
  dismissError: () => void;
}

const StudioContext = createContext<StudioValue | null>(null);

export function useStudio(): StudioValue {
  const v = useContext(StudioContext);
  if (!v) throw new Error('useStudio fuera del proveedor');
  return v;
}

const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };

export function StudioProvider({ children }: { children: ReactNode }) {
  const support = useBrowserSupport();

  // — Máquina de estados —
  const [status, setStatus] = useState<AppStatus>('idle');
  const statusRef = useRef<AppStatus>('idle');
  statusRef.current = status;

  // — Asistente de preparación —
  const [wizardStep, setWizardStep] = useState(0);
  const [screenMode, setScreenModeState] = useState<ScreenMode>('full');
  const [crop, setCropState] = useState<CropRect>(FULL_CROP);
  const [camera, setCamera] = useState<CameraSettings>({
    visible: true,
    position: 'bottom-right',
    size: 0.16,
  });
  const [cameraDeviceId, setCameraDeviceId] = useState('');
  const [micDeviceId, setMicDeviceId] = useState('');
  const [micSkipped, setMicSkipped] = useState(false);
  const [systemAudio, setSystemAudioState] = useState(false);
  const [showCropEditor, setShowCropEditor] = useState(false);

  // — Configuración de salida —
  const [outWidth, setOutWidth] = useState(1920);
  const [outHeight, setOutHeight] = useState(1080);
  const [fps, setFpsState] = useState(30);
  const [quality, setQuality] = useState<QualityLevel>('high');
  const [youtubeMode, setYoutubeModeState] = useState(true);

  // — Grabación / resultado —
  const [recordedMs, setRecordedMs] = useState(0);
  const recordedMsRef = useRef(0);
  const [meta, setMeta] = useState<RecordingMeta | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<StudioErrorInfo | null>(null);
  const [trim, setTrim] = useState({ start: 0, end: 0 });
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState('');
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  const cropRef = useRef(crop);
  cropRef.current = crop;
  const cameraSettingsRef = useRef(camera);
  cameraSettingsRef.current = camera;
  const previewBlobRef = useRef<Blob | null>(null);
  const composedStreamRef = useRef<MediaStream | null>(null);
  const masterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const choiceRef = useRef<RecorderChoice | null>(null);
  const outSizeRef = useRef({ w: 1920, h: 1080, fps: 30 });

  // — Hooks de captura —
  const screenEndedRef = useRef<() => void>(() => undefined);
  const screen = useScreenCapture(() => screenEndedRef.current());
  const cameraLostRef = useRef<() => void>(() => undefined);
  const cameraH = useCamera();
  const micLostRef = useRef<() => void>(() => undefined);
  const mic = useMicrophone(() => micLostRef.current());
  const { compositorRef, attach, detach } = useCompositor();
  const recorder = useRecorder();

  // Refs espejo para callbacks estables
  const systemAudioRef = useRef(false);
  systemAudioRef.current = systemAudio;
  const cameraDeviceRef = useRef('');
  cameraDeviceRef.current = cameraDeviceId;
  const micDeviceRef = useRef('');
  micDeviceRef.current = micDeviceId;

  /** Reapunta el compositor a los <video> actuales (tras recapturar). */
  const syncCompositorSources = useCallback(() => {
    const comp = compositorRef.current;
    if (!comp) return;
    comp.attachScreen(screen.videoRef.current);
    comp.attachCamera(cameraH.videoRef.current);
  }, [compositorRef, screen, cameraH]);

  // — Finalización (definida pronto: la usan los handlers de 'ended') —
  const finishRecording = useCallback(
    async (reason: 'user' | 'screen-stopped' | 'recorder-error' = 'user') => {
      const st = statusRef.current;
      if (st !== 'recording' && st !== 'paused') return;
      setStatus('processing');
      setNotice(null);

      let blob: Blob;
      try {
        blob = await recorder.stopAndGetBlob();
      } catch (e) {
        console.warn('[AulaRec] stop del grabador falló:', e);
        blob = new Blob([], { type: 'video/webm' });
      }

      // Liberar TODO: capturas, mezclador, compositor y stream compuesto.
      screen.stop();
      cameraH.stop();
      mic.stop();
      detach();
      stopStream(composedStreamRef.current);
      composedStreamRef.current = null;

      if (blob.size === 0) {
        setError({
          title: 'No se pudo guardar la grabación',
          detail: 'No se recibió ningún dato de vídeo. Prueba de nuevo con otra fuente de pantalla.',
        });
        setStatus('error');
        return;
      }

      const { w, h } = outSizeRef.current;
      const mimeType = blob.type || choiceRef.current?.mimeType || 'video/webm';
      const m: RecordingMeta = {
        durationMs: recordedMsRef.current,
        width: w,
        height: h,
        mimeType,
        sizeBytes: blob.size,
        container: containerOfMime(mimeType),
      };
      previewBlobRef.current = blob;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      setMeta(m);
      setTrim({ start: 0, end: m.durationMs / 1000 });

      if (reason === 'screen-stopped') {
        setNotice(
          'Dejaste de compartir la pantalla desde el navegador. Hemos conservado todo lo grabado hasta ese momento.',
        );
      } else if (reason === 'recorder-error') {
        setNotice(
          'Ocurrió un problema durante la grabación. Hemos conservado una versión parcial con todo lo capturado.',
        );
      }
      trackEvent('recording_completed');
      setStatus('preview');
    },
    [screen, cameraH, mic, detach, recorder, previewUrl],
  );
  const finishRef = useRef(finishRecording);
  finishRef.current = finishRecording;

  // — Handlers de desconexión —
  useEffect(() => {
    screenEndedRef.current = () => {
      const st = statusRef.current;
      if (st === 'recording' || st === 'paused') {
        void finishRef.current('screen-stopped');
      } else if (st === 'permissions' || st === 'setup' || st === 'countdown') {
        screen.stop();
        setNotice('Se detuvo la compartición de pantalla. Vuelve a seleccionarla para continuar.');
        if (st !== 'permissions') {
          setStatus('permissions');
          setWizardStep(0);
        }
      }
    };
    cameraLostRef.current = () => {
      setCamera((c) => ({ ...c, visible: false }));
      compositorRef.current?.setCameraSettings({ ...camera, visible: false });
      setNotice('La cámara se ha desconectado. La grabación continúa sin webcam.');
    };
    micLostRef.current = () => {
      setNotice('El micrófono se ha desconectado. La grabación continúa, pero sin audio nuevo.');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  // — Cronómetro: solo cuenta tiempo realmente grabado —
  useEffect(() => {
    if (status !== 'recording') return;
    const id = window.setInterval(() => {
      recordedMsRef.current += 250;
      setRecordedMs(recordedMsRef.current);
    }, 250);
    return () => window.clearInterval(id);
  }, [status]);

  // — Aviso al cerrar la pestaña en plena grabación —
  useEffect(() => {
    if (status !== 'recording' && status !== 'paused') return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [status]);

  // — Acciones —
  const startWizard = useCallback(() => {
    if (!support.ok) return;
    setError(null);
    setNotice(null);
    setWizardStep(0);
    setStatus('permissions');
  }, [support.ok]);

  const requestScreen = useCallback(async () => {
    const stream = await screen.request(systemAudioRef.current);
    syncCompositorSources();
    return stream;
  }, [screen, syncCompositorSources]);

  const setScreenMode = useCallback(
    (m: ScreenMode) => {
      setScreenModeState(m);
      if (m === 'full') {
        setCropState(FULL_CROP);
        compositorRef.current?.setCrop(FULL_CROP);
      }
    },
    [compositorRef],
  );

  const setCrop = useCallback(
    (c: CropRect) => {
      setCropState(c);
      compositorRef.current?.setCrop(c);
    },
    [compositorRef],
  );

  const requestCamera = useCallback(
    async (deviceId?: string) => {
      const id = deviceId ?? (cameraDeviceRef.current || undefined);
      const stream = await cameraH.request(id);
      const track = stream.getVideoTracks()[0];
      track?.addEventListener('ended', () => cameraLostRef.current());
      if (deviceId !== undefined) setCameraDeviceId(deviceId);
      syncCompositorSources();
    },
    [cameraH, syncCompositorSources],
  );

  const patchCamera = useCallback(
    (p: Partial<CameraSettings>) => {
      setCamera((c) => {
        const next = { ...c, ...p };
        compositorRef.current?.setCameraSettings(next);
        return next;
      });
    },
    [compositorRef],
  );

  const requestMic = useCallback(async () => {
    await mic.request(micDeviceRef.current || undefined, screen.streamRef.current);
    setMicSkipped(false);
  }, [mic, screen]);

  const skipMic = useCallback(() => setMicSkipped(true), []);

  const setSystemAudio = useCallback((v: boolean) => setSystemAudioState(v), []);

  const applyOutSize = useCallback(
    (w: number, h: number, f: number) => {
      outSizeRef.current = { w, h, fps: f };
      setOutWidth(w);
      setOutHeight(h);
      const comp = compositorRef.current;
      if (comp) {
        comp.setOutputSize(w, h);
        comp.setFps(f);
      }
    },
    [compositorRef],
  );

  const setOutSize = useCallback(
    (w: number, h: number) => applyOutSize(w, h, outSizeRef.current.fps),
    [applyOutSize],
  );

  const setFps = useCallback(
    (f: number) => {
      setFpsState(f);
      applyOutSize(outSizeRef.current.w, outSizeRef.current.h, f);
    },
    [applyOutSize],
  );

  const setYoutubeMode = useCallback(
    (on: boolean) => {
      setYoutubeModeState(on);
      if (on) {
        setFpsState(30);
        setQuality('high');
        applyOutSize(1920, 1080, 30);
        patchCamera({ position: 'bottom-right' });
      }
    },
    [applyOutSize, patchCamera],
  );

  /**
   * Canvas maestro: UN único elemento <canvas> propiedad del contexto.
   * React nunca lo recrea; el portal solo lo mueve entre slots para mostrarlo.
   * Así canvas.captureStream() y el rAF nunca se interrumpen al cambiar de vista.
   */
  const getMasterCanvas = useCallback((): HTMLCanvasElement => {
    if (!masterCanvasRef.current) {
      const c = document.createElement('canvas');
      c.className = 'composer-canvas';
      c.setAttribute('aria-label', 'Previsualización del vídeo final');
      masterCanvasRef.current = c;
    }
    return masterCanvasRef.current;
  }, []);

  /** (Re)crea el compositor sobre el canvas maestro y lo pone en marcha. */
  const ensureCompositor = useCallback(() => {
    const canvas = getMasterCanvas();
    const { w, h, fps: f } = outSizeRef.current;
    const comp = attach(canvas, { width: w, height: h, fps: f });
    comp.attachScreen(screen.videoRef.current);
    comp.attachCamera(cameraH.videoRef.current);
    comp.setCrop(cropRef.current);
    comp.setCameraSettings(cameraSettingsRef.current);
    comp.start();
  }, [attach, getMasterCanvas, screen, cameraH]);

  const goToSetup = useCallback(() => {
    setError(null);
    setNotice(null);
    ensureCompositor();
    setStatus('setup');
  }, [ensureCompositor]);

  const backToWizard = useCallback(() => {
    setStatus('permissions');
    setWizardStep(2);
  }, []);

  const startCountdown = useCallback(() => {
    setError(null);
    setStatus('countdown');
  }, []);

  const beginRecording = useCallback(() => {
    const comp = compositorRef.current;
    if (!comp) {
      setError({
        title: 'No se pudo iniciar la grabación',
        detail: 'El compositor de vídeo no está listo. Vuelve a la configuración e inténtalo de nuevo.',
      });
      setStatus('error');
      return;
    }
    const choice = chooseRecordingMime(true);
    if (!choice) {
      setError({
        title: 'Formato no soportado',
        detail: 'Tu navegador no puede grabar vídeo con ningún formato conocido.',
      });
      setStatus('error');
      return;
    }
    const { w, h } = outSizeRef.current;
    choice.bitsPerSecond = bitrateFor(quality, w, h);
    choiceRef.current = choice;

    let videoStream: MediaStream;
    try {
      videoStream = comp.capture();
    } catch (e) {
      console.warn('[AulaRec] captureStream falló:', e);
      setError({
        title: 'No se pudo iniciar la grabación',
        detail: 'El navegador no permitió convertir el canvas en stream de vídeo.',
      });
      setStatus('error');
      return;
    }

    const audioTracks = mic.mixerRef.current?.output.getAudioTracks() ?? [];
    const combined = new MediaStream([...videoStream.getVideoTracks(), ...audioTracks]);
    composedStreamRef.current = combined;

    recorder.start(combined, choice, () => {
      // Error de MediaRecorder: conservar lo grabado hasta ahora.
      void finishRef.current('recorder-error');
    });
    recordedMsRef.current = 0;
    setRecordedMs(0);
    trackEvent('recording_started');
    setStatus('recording');
  }, [compositorRef, mic, recorder, quality]);

  const pauseRecording = useCallback(() => {
    recorder.pause();
    setStatus('paused');
  }, [recorder]);

  const resumeRecording = useCallback(() => {
    recorder.resume();
    setStatus('recording');
  }, [recorder]);

  const cancelRecording = useCallback(() => {
    recorder.discard();
    screen.stop();
    cameraH.stop();
    mic.stop();
    detach();
    stopStream(composedStreamRef.current);
    composedStreamRef.current = null;
    recordedMsRef.current = 0;
    setRecordedMs(0);
    trackEvent('recording_cancelled');
    setStatus('idle');
  }, [recorder, screen, cameraH, mic, detach]);

  const applyTrim = useCallback((start: number, end: number) => {
    setTrim({ start: Math.max(0, start), end: Math.max(0.1, end) });
  }, []);

  const startExport = useCallback(
    async (preset: OutputPreset) => {
      const blob = previewBlobRef.current;
      const m = meta;
      if (!blob || !m) return;
      setStatus('exporting');
      setExportProgress(0);
      setError(null);
      trackEvent('export_started');
      if (preset.id === 'youtube-1080') trackEvent('preset_youtube_1080');
      if (preset.id === 'youtube-720') trackEvent('preset_youtube_720');
      try {
        const result = await exportVideo({
          blob,
          sourceMimeType: m.mimeType,
          sourceWidth: m.width,
          sourceHeight: m.height,
          durationSec: m.durationMs / 1000,
          trimStartSec: trim.start,
          trimEndSec: trim.end,
          preset,
          onProgress: (r) => setExportProgress(r),
        });
        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        setDownloadUrl(URL.createObjectURL(result.blob));
        setDownloadName(filenameFor(new Date(), result.ext));
        trackEvent('export_completed');
        trackEvent(result.ext === 'mp4' ? 'export_format_mp4' : 'export_format_webm');
        setStatus('completed');
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : 'La exportación falló por un error desconocido.';
        // La grabación sigue a salvo: volvemos a la vista previa.
        setNotice(`No se pudo exportar: ${msg} Tu grabación sigue disponible abajo.`);
        setStatus('preview');
      }
    },
    [meta, trim, downloadUrl],
  );

  const downloadExport = useCallback(() => {
    if (!downloadUrl) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = downloadName || 'grabacion.mp4';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [downloadUrl, downloadName]);

  const resetAll = useCallback(() => {
    recorder.discard();
    screen.stop();
    cameraH.stop();
    mic.stop();
    detach();
    stopStream(composedStreamRef.current);
    composedStreamRef.current = null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    previewBlobRef.current = null;
    setPreviewUrl(null);
    setDownloadUrl(null);
    setMeta(null);
    setRecordedMs(0);
    recordedMsRef.current = 0;
    setNotice(null);
    setError(null);
    setExportProgress(null);
    setTrim({ start: 0, end: 0 });
    setCropState(FULL_CROP);
    setScreenModeState('full');
    setMicSkipped(false);
    setWizardStep(0);
    setShowCropEditor(false);
    setStatus('idle');
  }, [recorder, screen, cameraH, mic, detach, previewUrl, downloadUrl]);

  const dismissNotice = useCallback(() => setNotice(null), []);
  const dismissError = useCallback(() => {
    setError(null);
    setStatus('idle');
  }, []);

  const value = useMemo<StudioValue>(
    () => ({
      status,
      support,
      wizardStep,
      screenMode,
      crop,
      camera,
      cameraDeviceId,
      micDeviceId,
      micSkipped,
      systemAudio,
      outWidth,
      outHeight,
      fps,
      quality,
      youtubeMode,
      showCropEditor,
      recordedMs,
      meta,
      previewUrl,
      notice,
      error,
      trim,
      exportProgress,
      downloadUrl,
      downloadName,
      portalTarget,
      screenActive: screen.active,
      screenHasSystemAudio: screen.hasSystemAudio,
      screenVideoRef: screen.videoRef,
      screenError: screen.error,
      cameraActive: cameraH.active,
      cameraVideoRef: cameraH.videoRef,
      cameraDevices: cameraH.devices,
      cameraError: cameraH.error,
      micActive: mic.active,
      micVolume: mic.volume,
      micLabel: mic.micLabel,
      micDevices: mic.devices,
      micError: mic.error,
      getMicLevel: mic.getLevel,
      setPortalTarget,
      startWizard,
      setWizardStep,
      requestScreen,
      setScreenMode,
      setCrop,
      setShowCropEditor,
      requestCamera,
      setCameraDeviceId,
      patchCamera,
      requestMic,
      skipMic,
      setMicDeviceId,
      setMicVolume: mic.setVolume,
      setSystemAudio,
      setOutSize,
      setFps,
      setQuality,
      setYoutubeMode,
      goToSetup,
      backToWizard,
      getMasterCanvas,
      startCountdown,
      beginRecording,
      pauseRecording,
      resumeRecording,
      finishRecording,
      cancelRecording,
      applyTrim,
      startExport,
      downloadExport,
      resetAll,
      dismissNotice,
      dismissError,
    }),
    [
      status, support, wizardStep, screenMode, crop, camera, cameraDeviceId, micDeviceId,
      micSkipped, systemAudio, outWidth, outHeight, fps, quality, youtubeMode, showCropEditor,
      recordedMs, meta, previewUrl, notice, error, trim, exportProgress, downloadUrl,
      downloadName, portalTarget, screen, cameraH, mic, startWizard, requestScreen, setScreenMode,
      setCrop, requestCamera, patchCamera, requestMic, skipMic, setSystemAudio, setOutSize,
      setFps, setYoutubeMode, goToSetup, backToWizard, getMasterCanvas, startCountdown, beginRecording,
      pauseRecording, resumeRecording, finishRecording, cancelRecording, applyTrim, startExport,
      downloadExport, resetAll, dismissNotice, dismissError,
    ],
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}
