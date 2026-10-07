import { useCallback, useRef, useState } from 'react';
import { ClipRecorder } from '../services/recorder.ts';
import type { RecorderChoice } from '../services/recorder.ts';

export type RecState = 'inactive' | 'recording' | 'paused';

/** useRecorder — MediaRecorder con chunks periódicos (timeslice). */
export function useRecorder() {
  const recorderRef = useRef<ClipRecorder | null>(null);
  const [recState, setRecState] = useState<RecState>('inactive');

  const start = useCallback(
    (stream: MediaStream, choice: RecorderChoice, onError: (e: Error) => void) => {
      const rec = new ClipRecorder(stream, choice);
      rec.onError = onError;
      rec.start(5000);
      recorderRef.current = rec;
      setRecState('recording');
    },
    [],
  );

  const pause = useCallback(() => {
    recorderRef.current?.pause();
    setRecState('paused');
  }, []);

  const resume = useCallback(() => {
    recorderRef.current?.resume();
    setRecState('recording');
  }, []);

  /** Detiene y devuelve el Blob (parcial si hubo error). Nunca pierde los chunks. */
  const stopAndGetBlob = useCallback(async (): Promise<Blob> => {
    const rec = recorderRef.current;
    recorderRef.current = null;
    setRecState('inactive');
    if (!rec) return new Blob([], { type: 'video/webm' });
    return rec.stop();
  }, []);

  const discard = useCallback(() => {
    const rec = recorderRef.current;
    recorderRef.current = null;
    setRecState('inactive');
    if (rec) void rec.stop().catch(() => undefined);
  }, []);

  return { recorderRef, recState, start, pause, resume, stopAndGetBlob, discard };
}
