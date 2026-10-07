import { useState } from 'react';
import { useStudio } from '../../studio/StudioContext.tsx';
import { VideoElementView } from '../VideoElementView.tsx';
import type { CameraPosition } from '../../studio/types.ts';

const POSITIONS: { id: CameraPosition; label: string }[] = [
  { id: 'top-left', label: 'Superior izquierda' },
  { id: 'top-right', label: 'Superior derecha' },
  { id: 'bottom-left', label: 'Inferior izquierda' },
  { id: 'bottom-right', label: 'Inferior derecha' },
];

/** Paso 2 — Cámara: previsualizar, tamaño, esquina u ocultar. */
export function CameraStep() {
  const s = useStudio();
  const [busy, setBusy] = useState(false);

  const activate = async (deviceId?: string) => {
    setBusy(true);
    try {
      await s.requestCamera(deviceId);
    } catch {
      /* el error queda en s.cameraError */
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="wizard-card" aria-label="Paso 2: cámara">
      <h2>Tu cámara</h2>
      <p className="muted">
        Aparecerá como un círculo superpuesto sobre tu pantalla. Puedes moverla a cualquier
        esquina, cambiar su tamaño u ocultarla.
      </p>

      {!s.cameraActive ? (
        <>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => activate()} disabled={busy}>
            {busy ? 'Activando cámara…' : 'Activar cámara'}
          </button>
          {s.cameraError && (
            <p className="error-text" role="alert">
              {s.cameraError.code === 'denied'
                ? 'Permiso de cámara denegado. Puedes continuar sin cámara si lo prefieres.'
                : 'No se pudo iniciar la cámara.'}
            </p>
          )}
          <div className="wizard-actions wizard-actions-start">
            <button type="button" className="btn btn-ghost" onClick={() => s.setWizardStep(0)}>
              Atrás
            </button>
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                s.patchCamera({ visible: false });
                s.setWizardStep(2);
              }}
            >
              Continuar sin cámara
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="camera-preview-wrap">
            <VideoElementView
              video={s.cameraVideoRef.current}
              className="camera-circle"
              label="Vista previa de tu cámara"
            />
          </div>

          {s.cameraDevices.length > 1 && (
            <label className="field">
              <span>Cámara</span>
              <select
                value={s.cameraDeviceId}
                onChange={(e) => activate(e.target.value)}
                aria-label="Seleccionar cámara"
              >
                <option value="">Predeterminada</option>
                {s.cameraDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="field">
            <span>Tamaño del círculo ({Math.round(s.camera.size * 100)} % del ancho)</span>
            <input
              type="range"
              min={10}
              max={25}
              value={Math.round(s.camera.size * 100)}
              onChange={(e) => s.patchCamera({ size: Number(e.target.value) / 100 })}
              aria-label="Tamaño de la cámara"
            />
          </label>

          <fieldset className="corner-grid" aria-label="Posición de la cámara">
            <legend>Esquina</legend>
            {POSITIONS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={'corner-btn' + (s.camera.position === p.id ? ' corner-btn-active' : '')}
                onClick={() => s.patchCamera({ position: p.id, visible: true })}
                aria-pressed={s.camera.position === p.id}
              >
                {p.label}
              </button>
            ))}
          </fieldset>

          <label className="check-row">
            <input
              type="checkbox"
              checked={s.camera.visible}
              onChange={(e) => s.patchCamera({ visible: e.target.checked })}
            />
            Mostrar cámara en el vídeo
          </label>

          <div className="wizard-actions">
            <button type="button" className="btn btn-ghost" onClick={() => s.setWizardStep(0)}>
              Atrás
            </button>
            <button type="button" className="btn btn-primary" onClick={() => s.setWizardStep(2)}>
              Continuar al micrófono
            </button>
          </div>
        </>
      )}
    </section>
  );
}
