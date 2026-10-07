import { useEffect, useRef } from 'react';

function focusablesOf(root: HTMLElement): HTMLElement[] {
  const els = root.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  );
  const all = [...els].filter((el) => !el.hasAttribute('disabled'));
  // En navegadores reales se filtran los ocultos; en jsdom (tests)
  // getClientRects está vacío, así que se usa la lista completa.
  const visible = all.filter((el) => el.getClientRects().length > 0);
  return visible.length > 0 ? visible : all;
}

/**
 * Conducta accesible común para diálogos modales:
 * - Escape cierra el diálogo.
 * - El foco queda encerrado dentro mientras está abierto (Tab circular).
 * - Al cerrar, el foco vuelve al elemento que abrió el diálogo.
 *
 * Devuelve el ref que debe asignarse al contenedor del diálogo
 * (el elemento con role="dialog").
 */
export function useDialogBehavior(onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab' && dialog) {
        const f = focusablesOf(dialog);
        if (f.length === 0) {
          e.preventDefault();
          return;
        }
        const first = f[0];
        const last = f[f.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !dialog.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    // Capture: se ejecuta antes que otros atajos de la página.
    window.addEventListener('keydown', onKey, true);

    // Foco inicial dentro del diálogo.
    const initial = dialog ? focusablesOf(dialog)[0] : undefined;
    if (initial) {
      initial.focus();
    } else if (dialog) {
      dialog.setAttribute('tabindex', '-1');
      dialog.focus();
    }

    return () => {
      window.removeEventListener('keydown', onKey, true);
      // Devolver el foco a quien abrió el diálogo.
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
  }, []);

  return dialogRef;
}
