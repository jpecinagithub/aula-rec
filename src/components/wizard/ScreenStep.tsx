import { useState } from 'react';
import { useStudio } from '../../studio/StudioContext.tsx';
import { VideoElementView } from '../VideoElementView.tsx';
import { formatDims } from '../../lib/format.ts';

/** Paso 1 — Pantalla: seleccionar fuente y modo (toda / zona). */
export function ScreenStep() {
  const s = useStudio();
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    setBusy(true);
    try {
      await s.requestScreen();
    } catch {
      /* el error queda en s.screenError */
    } finally {
      setBusy(false);
    }
  };

  const video = s.screenVideoRef.current;
  const dims =
    video && video.videoWidth > 0
      ? formatDims(s.crop.w * video.videoWidth, s.crop.h * video.videoHeight)
      : null;

  return (
    <section className="wizard-card" aria-label="Paso 1: pantalla">
      <h2>Selecciona qué quieres grabar</h2>
      <p className="muted">
        El navegador te dejará elegir entre pantalla completa, una ventana o una pestaña.
      </p>

      {!s.screenActive ? (
        <>
          <button type="button" className="btn btn-primary btn-lg" onClick={pick} disabled={busy}>
            {busy ? 'Esperando tu selección…' : 'Seleccionar pantalla, ventana o pestaña'}
          </button>
          <label className="check-row">
            <input
              type="checkbox"
              checked={s.systemAudio}
              onChange={(e) => s.setSystemAudio(e.target.checked)}
            />
            Incluir audio del ordenador (opcional, si tu sistema lo permite)
          </label>
          {s.screenError && (
            <p className="error-text" role="alert">
              {s.screenError.code === 'denied'
                ? 'Has cancelado la selección o no has dado permiso. Pulsa de nuevo para intentarlo.'
                : 'No se pudo capturar la pantalla con este navegador.'}
            </p>
          )}
        </>
      ) : (
        <>
          <div className="preview-frame">
            <VideoElementView video={video} className="preview-video" label="Vista previa de la pantalla seleccionada" />
          </div>

          <fieldset className="radio-group">
            <legend>Zona de grabación</legend>
            <label className="radio-row">
              <input
                type="radio"
                name="screen-mode"
                checked={s.screenMode === 'full'}
                onChange={() => s.setScreenMode('full')}
              />
              Toda la pantalla
            </label>
            <label className="radio-row">
              <input
                type="radio"
                name="screen-mode"
                checked={s.screenMode === 'region'}
                onChange={() => s.setScreenMode('region')}
              />
              Seleccionar una zona
            </label>
          </fieldset>

          {s.screenMode === 'region' && (
            <div className="crop-summary">
              <p>
                Zona seleccionada: <strong>{dims ?? '—'}</strong>
              </p>
              <button type="button" className="btn btn-secondary" onClick={() => s.setShowCropEditor(true)}>
                Definir zona de grabación
              </button>
            </div>
          )}

          {s.screenHasSystemAudio ? (
            <p className="ok-text">Audio del ordenador incluido.</p>
          ) : (
            s.systemAudio && (
              <p className="warn-text">
                Tu sistema no proporcionó audio del ordenador; se grabará solo el micrófono.
              </p>
            )
          )}

          <div className="mirror-warn" role="note">
            <strong>Evita el espejo infinito:</strong> si seleccionas esta misma pestaña verás la
            aplicación dentro de sí misma. Elige otra pestaña, una ventana o la pantalla completa.
          </div>

          <div className="wizard-actions">
            <button type="button" className="btn btn-ghost" onClick={pick} disabled={busy}>
              Volver a seleccionar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => s.setWizardStep(1)}>
              Continuar a la cámara
            </button>
          </div>
        </>
      )}
    </section>
  );
}
