import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStudio } from '../studio/StudioContext.tsx';

/**
 * El canvas del compositor vive siempre montado (vía portal) para que
 * canvas.captureStream() no se interrumpa al cambiar de vista.
 * Cada vista ofrece un StageSlot donde quiere verlo.
 */
export function ComposerCanvas() {
  const { portalTarget, attachCanvas } = useStudio();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return attachCanvas(canvas);
    // portalTarget: el canvas solo existe cuando hay un slot; al aparecer
    // (o cambiar) el slot hay que (re)adjuntar el compositor.
  }, [attachCanvas, portalTarget]);

  if (!portalTarget) return null;
  return createPortal(
    <canvas
      ref={(el) => {
        canvasRef.current = el;
      }}
      className="composer-canvas"
      aria-label="Previsualización del vídeo final"
    />,
    portalTarget,
  );
}
