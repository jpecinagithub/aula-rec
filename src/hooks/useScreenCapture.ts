import { useCallback, useEffect, useRef, useState } from 'react';
import { captureScreen, stopStream } from '../services/screenCapture.ts';
import type { ScreenCaptureError } from '../services/screenCapture.ts';

/**
 * useScreenCapture — posee el stream de pantalla y un <video> listo para
 * dibujar en el compositor. onEnded se llama si el usuario detiene la
 * compartición desde el propio navegador.
 */
export function useScreenCapture(onEnded: () => void) {
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onEndedRef = useRef(onEnded);
  const [active, setActive] = useState(false);
  const [hasSystemAudio, setHasSystemAudio] = useState(false);
  const [error, setError] = useState<ScreenCaptureError | null>(null);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  const request = useCallback(async (systemAudio: boolean): Promise<MediaStream> => {
    setError(null);
    const { stream, hasSystemAudio } = await captureScreen({ systemAudio }).catch((e) => {
      setError(e as ScreenCaptureError);
      throw e;
    });

    // Sustituir captura anterior si la había.
    if (streamRef.current) stopStream(streamRef.current);
    videoRef.current?.pause();

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      /* algunos navegadores necesitan un frame más */
    }
    streamRef.current = stream;
    videoRef.current = video;

    const track = stream.getVideoTracks()[0];
    track?.addEventListener('ended', () => onEndedRef.current());

    setHasSystemAudio(hasSystemAudio);
    setActive(true);
    return stream;
  }, []);

  const stop = useCallback(() => {
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.srcObject = null;
    }
    videoRef.current = null;
    stopStream(streamRef.current);
    streamRef.current = null;
    setActive(false);
    setHasSystemAudio(false);
  }, []);

  return { streamRef, videoRef, active, hasSystemAudio, error, request, stop };
}
