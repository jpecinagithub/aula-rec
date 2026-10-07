import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStudio } from '../studio/StudioContext.tsx';

/**
 * Muestra el canvas maestro del compositor dentro del slot activo.
 * El elemento <canvas> es propiedad del contexto y nunca lo recrea React:
 * al cambiar de slot solo se mueve en el DOM, así canvas.captureStream()
 * y el bucle de dibujado no se interrumpen al pasar de configuración a
 * grabación.
 */
export function ComposerCanvas() {
  const { portalTarget, getMasterCanvas } = useStudio();
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvas = getMasterCanvas();
    host.appendChild(canvas);
    return () => {
      canvas.remove();
    };
  }, [portalTarget, getMasterCanvas]);

  if (!portalTarget) return null;
  return createPortal(<div ref={hostRef} className="composer-host" />, portalTarget);
}
