/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useDialogBehavior } from './useDialogBehavior.ts';

function TestDialog({ onClose }: { onClose: () => void }) {
  const ref = useDialogBehavior(onClose);
  return (
    <div ref={ref} role="dialog" aria-label="Prueba">
      <button type="button">Primero</button>
      <button type="button">Segundo</button>
    </div>
  );
}

describe('useDialogBehavior', () => {
  let opener: HTMLButtonElement;
  let container: HTMLDivElement;
  let root: Root;

  async function mount(onClose: () => void) {
    opener = document.createElement('button');
    opener.textContent = 'Abrir';
    document.body.appendChild(opener);
    opener.focus();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<TestDialog onClose={onClose} />);
    });
  }

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
    opener.remove();
    container.remove();
  });

  function key(keyName: string, shift = false) {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: keyName,
        shiftKey: shift,
        bubbles: true,
        cancelable: true,
      }),
    );
  }

  it('pone el foco inicial dentro del diálogo', async () => {
    await mount(vi.fn());
    expect(document.activeElement?.textContent).toBe('Primero');
  });

  it('Escape llama a onClose', async () => {
    const onClose = vi.fn();
    await mount(onClose);
    await act(async () => {
      key('Escape');
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Tab en el último elemento vuelve al primero (foco encerrado)', async () => {
    await mount(vi.fn());
    const buttons = container.querySelectorAll('button');
    (buttons[1] as HTMLElement).focus();
    expect(document.activeElement).toBe(buttons[1]);
    await act(async () => {
      key('Tab');
    });
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('Mayús+Tab en el primero va al último', async () => {
    await mount(vi.fn());
    const buttons = container.querySelectorAll('button');
    (buttons[0] as HTMLElement).focus();
    await act(async () => {
      key('Tab', true);
    });
    expect(document.activeElement).toBe(buttons[1]);
  });

  it('al desmontar, el foco vuelve a quien abrió el diálogo', async () => {
    await mount(vi.fn());
    expect(document.activeElement?.textContent).toBe('Primero');
    await act(async () => {
      root.unmount();
    });
    expect(document.activeElement).toBe(opener);
    // Evitar doble unmount en afterEach.
    root = null as unknown as Root;
  });
});
