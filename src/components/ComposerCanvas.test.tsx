/**
 * @vitest-environment jsdom
 *
 * El canvas maestro es propiedad del contexto (un único elemento): al hacer
 * goToSetup el compositor se crea sobre él y ComposerCanvas lo muestra en el
 * slot, sin que React lo recree al cambiar de vista.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { StudioProvider, useStudio } from '../studio/StudioContext.tsx';
import type { StudioValue } from '../studio/StudioContext.tsx';
import { StageSlot } from './StageSlot.tsx';
import { ComposerCanvas } from './ComposerCanvas.tsx';

vi.mock('../lib/analytics.ts', () => ({ trackEvent: vi.fn() }));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let studio: StudioValue | null = null;
function Driver() {
  studio = useStudio();
  return null;
}
function Harness() {
  return (
    <StudioProvider>
      <Driver />
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
    studio = null;
    vi.restoreAllMocks();
  });

  it('muestra el canvas maestro configurado tras goToSetup', async () => {
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
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(<Harness />);
    });
    act(() => {
      (studio as StudioValue).goToSetup();
    });

    const canvas = host.querySelector('.stage-slot canvas.composer-canvas');
    expect(canvas).not.toBeNull();
    // El compositor configura el canvas a la resolución de salida.
    expect((canvas as HTMLCanvasElement | null)?.width).toBe(1920);
    expect((canvas as HTMLCanvasElement | null)?.height).toBe(1080);
    vi.unstubAllGlobals();
  });
});
