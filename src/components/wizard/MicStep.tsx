import { useState } from 'react';
import { useStudio } from '../../studio/StudioContext.tsx';
import { AudioMeter } from '../AudioMeter.tsx';

/** Paso 3 — Micrófono: dispositivo, nivel en tiempo real y volumen. */
export function MicStep() {
  const s = useStudio();
  const [busy, setBusy] = useState(false);

  const activate = async (deviceId?: string) => {
    setBusy(true);
    try {
      await s.requestMic();
      if (deviceId !== undefined) s.setMicDeviceId(deviceId);
    } catch {
      /* el error queda en s.micError */
    } finally {
      setBusy(false);
    }
  };

  const changeDevice = async (deviceId: string) => {
    setBusy(true);
    try {
      await s.requestMic(deviceId);
    } catch {
      /* noop */
    } finally {
      setBusy(false);
    }
  };

  const ready = s.micActive || s.micSkipped;

  return (
    <section className="wizard-card" aria-label="Paso 3: micrófono">
      <h2>Tu micrófono</h2>
      <p className="muted">El audio principal de tu vídeo será siempre tu voz.</p>

      {!s.micActive && !s.micSkipped ? (
        <>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => activate()} disabled={busy}>
            {busy ? 'Activando micrófono…' : 'Activar micrófono'}
          </button>
          {s.micError && (
            <p className="error-text" role="alert">
              {s.micError.code === 'denied'
                ? 'Permiso de micrófono denegado. Sin micrófono no hay narración: revísalo o continúa sin él.'
                : 'No se pudo iniciar el micrófono.'}
            </p>
          )}
          <div className="wizard-actions wizard-actions-start">
            <button type="button" className="btn btn-ghost" onClick={() => s.setWizardStep(1)}>
              Atrás
            </button>
            <button type="button" className="link-btn" onClick={s.skipMic}>
              Continuar sin micrófono
            </button>
          </div>
        </>
      ) : (
        <>
          {s.micActive && (
            <>
              <p>
                <strong>{s.micLabel}</strong>
              </p>
              <AudioMeter getLevel={s.getMicLevel} />

              {s.micDevices.length > 1 && (
                <label className="field">
                  <span>Micrófono</span>
                  <select
                    value={s.micDeviceId}
                    onChange={(e) => changeDevice(e.target.value)}
                    aria-label="Seleccionar micrófono"
                    disabled={busy}
                  >
                    <option value="">Predeterminado</option>
                    {s.micDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="field">
                <span>Volumen del micrófono ({Math.round(s.micVolume * 100)} %)</span>
                <input
                  type="range"
                  min={0}
                  max={150}
                  value={Math.round(s.micVolume * 100)}
                  onChange={(e) => s.setMicVolume(Number(e.target.value) / 100)}
                  aria-label="Volumen del micrófono"
                />
              </label>

              <p className="muted small">
                Audio optimizado para voz: reducción de ruido, cancelación de eco y ganancia
                automática activas.
              </p>
            </>
          )}
          {s.micSkipped && (
            <p className="warn-text">Grabarás sin micrófono: el vídeo no tendrá narración.</p>
          )}

          <div className="wizard-actions">
            <button type="button" className="btn btn-ghost" onClick={() => s.setWizardStep(1)}>
              Atrás
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={s.goToSetup}
              disabled={!ready || busy}
            >
              Ir a la configuración
            </button>
          </div>
        </>
      )}
    </section>
  );
}
