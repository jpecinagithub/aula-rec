import { useCallback, useRef } from 'react';
import { CanvasCompositor } from '../services/compositor.ts';
import type { CompositorConfig } from '../services/compositor.ts';

/** useCompositor — ciclo de vida del CanvasCompositor sobre un <canvas>. */
export function useCompositor() {
  const compositorRef = useRef<CanvasCompositor | null>(null);

  const detach = useCallback(() => {
    compositorRef.current?.stop();
    compositorRef.current = null;
  }, []);

  const attach = useCallback(
    (canvas: HTMLCanvasElement, config: CompositorConfig): CanvasCompositor => {
      detach();
      const comp = new CanvasCompositor(canvas, config);
      compositorRef.current = comp;
      return comp;
    },
    [detach],
  );

  return { compositorRef, attach, detach };
}
