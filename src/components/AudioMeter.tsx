import { useEffect, useRef, useState } from 'react';

/** Barra de volumen en tiempo real + aviso si no se detecta señal. */
export function AudioMeter({ getLevel }: { getLevel: () => number }) {
  const barRef = useRef<HTMLDivElement>(null);
  const [lowSignal, setLowSignal] = useState(false);
  const lowRef = useRef(false);

  useEffect(() => {
    let raf = 0;
    let quietSince = 0;
    const tick = () => {
      const level = getLevel();
      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${Math.min(1, Math.max(0, level)).toFixed(3)})`;
      }
      const now = performance.now();
      if (level < 0.02) {
        if (!quietSince) quietSince = now;
      } else {
        quietSince = 0;
      }
      const low = quietSince > 0 && now - quietSince > 4000;
      if (low !== lowRef.current) {
        lowRef.current = low;
        setLowSignal(low);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getLevel]);

  return (
    <div>
      <div
        className="meter"
        role="meter"
        aria-label="Nivel del micrófono"
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div ref={barRef} className="meter-fill" />
      </div>
      {lowSignal && (
        <p className="warn-text" role="alert">
          Parece que no se detecta señal. Habla un poco más alto o acerca el micrófono.
        </p>
      )}
    </div>
  );
}
