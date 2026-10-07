/**
 * @vitest-environment jsdom
 *
 * Regresión: el canvas del compositor se monta vía portal cuando aparece un
 * StageSlot DESPUÉS del primer render. El efecto de ComposerCanvas debe
 * re-ejecutarse al aparecer el slot (antes solo dependía de attachCanvas y el
 * compositor nunca se creaba → "El compositor de vídeo no está listo").
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { StudioProvider } from '../studio/StudioContext.tsx';
import { StageSlot } from './StageSlot.tsx';
import { ComposerCanvas } from './ComposerCanvas.tsx';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

function Harness() {
  return (
    <StudioProvider>
      <ComposerCanvas />
      <StageSlot className="stage-slot" />
    </StudioProvider>
  );
}

describe('ComposerCanvas', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    host?.remove();
    host = null;
    vi.restoreAllMocks();
  });

  it('adjunta el compositor al canvas cuando el slot se monta', async () => {
    // jsdom no tiene Canvas 2D: stub con no-ops.
    const ctxStub = new Proxy(
      {},
      {
        get: (_t, p) =>
          p === 'canvas'
            ? document.createElement('canvas')
            : (..._args: unknown[]) => undefined,
      },
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctxStub as unknown as RenderingContext,
    );

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(<Harness />);
    });

    const canvas = host.querySelector('.stage-slot canvas');
    expect(canvas).not.toBeNull();
    // El compositor configura el canvas a la resolución de salida (1920×1080).
    expect((canvas as HTMLCanvasElement | null)?.width).toBe(1920);
    expect((canvas as HTMLCanvasElement | null)?.height).toBe(1080);
  });
});
