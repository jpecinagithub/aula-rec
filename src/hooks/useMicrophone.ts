import { useCallback, useEffect, useRef, useState } from 'react';
import { createVoiceMixer, listMicrophones } from '../services/audio.ts';
import type { AudioDevice, MicError, VoiceMixer } from '../services/audio.ts';

/**
 * useMicrophone — mezclador de voz (micrófono + opcional audio del sistema).
 * El audio principal siempre es el micrófono del profesor.
 */
export function useMicrophone(onMicLost: () => void) {
  const mixerRef = useRef<VoiceMixer | null>(null);
  const onMicLostRef = useRef(onMicLost);
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [active, setActive] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [micLabel, setMicLabel] = useState('');
  const [error, setError] = useState<MicError | null>(null);

  useEffect(() => {
    onMicLostRef.current = onMicLost;
  }, [onMicLost]);

  useEffect(() => {
    let alive = true;
    void listMicrophones().then((d) => {
      if (alive) setDevices(d);
    });
    return () => {
      alive = false;
    };
  }, []);

  const request = useCallback(
    async (deviceId?: string, systemAudioStream?: MediaStream | null): Promise<VoiceMixer> => {
      setError(null);
      // Recrear para aplicar cambios (dispositivo o audio del sistema).
      mixerRef.current?.dispose();
      mixerRef.current = null;

      const mixer = await createVoiceMixer({
        micDeviceId: deviceId,
        systemAudioStream: systemAudioStream ?? null,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        onMicLost: () => onMicLostRef.current(),
      }).catch((e) => {
        setError(e as MicError);
        throw e;
      });

      mixerRef.current = mixer;
      setVolumeState((v) => {
        mixer.setVolume(v);
        return v;
      });
      setActive(true);

      const devs = await listMicrophones();
      setDevices(devs);
      const found = devs.find((d) => d.deviceId === deviceId);
      setMicLabel(found?.label ?? devs[0]?.label ?? 'Micrófono');
      return mixer;
    },
    [],
  );

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1.5, Math.max(0, v));
    setVolumeState(clamped);
    mixerRef.current?.setVolume(clamped);
  }, []);

  const getLevel = useCallback((): number => mixerRef.current?.getLevel() ?? 0, []);

  const stop = useCallback(() => {
    mixerRef.current?.dispose();
    mixerRef.current = null;
    setActive(false);
  }, []);

  return { mixerRef, devices, active, volume, micLabel, error, request, setVolume, getLevel, stop };
}
