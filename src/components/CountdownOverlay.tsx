import { useEffect, useState } from 'react';
import { useStudio } from '../studio/StudioContext.tsx';

/** Cuenta atrás 3-2-1-GRABANDO antes de iniciar la captura. */
export function CountdownOverlay() {
  const { beginRecording } = useStudio();
  const [n, setN] = useState(3);

  useEffect(() => {
    if (n <= 0) {
      const t = window.setTimeout(beginRecording, 650);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setN((v) => v - 1), 900);
    return () => window.clearTimeout(t);
  }, [n, beginRecording]);

  return (
    <div className="countdown-overlay" role="status" aria-live="assertive">
      <div className="countdown-num" key={n}>
        {n <= 0 ? 'GRABANDO' : n}
      </div>
      {n > 0 && <p className="countdown-hint">Prepara tu explicación…</p>}
    </div>
  );
}
