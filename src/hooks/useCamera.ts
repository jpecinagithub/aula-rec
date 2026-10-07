import { useCallback, useEffect, useRef, useState } from 'react';
import { listCameras, startCamera, stopStream } from '../services/camera.ts';
import type { CameraError, VideoDevice } from '../services/camera.ts';

/** useCamera — posee el stream de la webcam y su <video> para el compositor. */
export function useCamera() {
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [devices, setDevices] = useState<VideoDevice[]>([]);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<CameraError | null>(null);

  useEffect(() => {
    let alive = true;
    void listCameras().then((d) => {
      if (alive) setDevices(d);
    });
    return () => {
      alive = false;
    };
  }, []);

  const request = useCallback(async (deviceId?: string): Promise<MediaStream> => {
    setError(null);
    const stream = await startCamera(deviceId).catch((e) => {
      setError(e as CameraError);
      throw e;
    });

    if (streamRef.current) stopStream(streamRef.current);
    videoRef.current?.pause();

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      /* noop */
    }
    streamRef.current = stream;
    videoRef.current = video;
    setActive(true);

    // Refrescar etiquetas (tras el permiso suelen venir con nombre real).
    void listCameras().then(setDevices);
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
  }, []);

  return { streamRef, videoRef, devices, active, error, request, stop };
}
