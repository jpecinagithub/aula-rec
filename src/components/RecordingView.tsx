import { useStudio } from '../studio/StudioContext.tsx';
import { StageSlot } from './StageSlot.tsx';
import { formatClock } from '../lib/format.ts';
import {
  bitrateFor,
  estimateSizeMB,
  formatMB,
  RECORDING_WARN_BYTES,
} from '../services/recorder.ts';

/** Barra flotante de controles durante la grabación. */
function RecordingBar() {
  const s = useStudio();
  const paused = s.status === 'paused';

  return (
    <div className="rec-bar" role="toolbar" aria-label="Controles de grabación">
      <span className="rec-indicator" aria-hidden="true">
        <span className={'rec-dot' + (paused ? ' rec-dot-paused' : '')} />
      </span>
      <span className="rec-state">{paused ? 'EN PAUSA' : 'GRABANDO'}</span>
      <span className="rec-time" aria-label="Tiempo grabado">
        {formatClock(s.recordedMs)}
      </span>
      {paused ? (
        <button type="button" className="btn btn-primary btn-sm" onClick={s.resumeRecording}>
          Reanudar
        </button>
      ) : (
        <button type="button" className="btn btn-secondary btn-sm" onClick={s.pauseRecording}>
          Pausar
        </button>
      )}
      <button type="button" className="btn btn-danger btn-sm" onClick={() => s.finishRecording('user')}>
        Finalizar
      </button>
    </div>
  );
}

/** Vista durante la grabación: mini previsualización + barra flotante. */
export function RecordingView() {
  const s = useStudio();
  const bitrate = bitrateFor(s.quality, s.outWidth, s.outHeight);
  const estMB = estimateSizeMB(bitrate, s.recordedMs / 60000);
  // Aviso consciente de la calidad: a 1080p el peligro llega mucho antes que a 480p.
  const longWarning = estMB * 1e6 >= RECORDING_WARN_BYTES;

  return (
    <div className="page recording-page">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <span className="brand-dot" />
          </span>
          <span className="brand-name">AulaRec</span>
        </div>
      </header>

      <main className="recording-main">
        <div className="recording-preview">
          <StageSlot className="stage-slot stage-slot-small" />
        </div>
        <div className="recording-tips">
          <h2>{s.status === 'paused' ? 'Grabación en pausa' : 'Grabando tu explicación'}</h2>
          <p className="muted">
            Ya puedes cambiar a la ventana o pestaña que quieres explicar. Esta barra no
            aparecerá en el vídeo si estás capturando otra pestaña o ventana.
          </p>
          {longWarning && (
            <p className="warn-text" role="alert">
              Llevas ~{formatMB(estMB)} estimados de vídeo. Las grabaciones muy largas
              consumen mucha memoria: considera finalizar pronto para no perder el vídeo.
            </p>
          )}
          <button type="button" className="link-btn link-danger" onClick={s.cancelRecording}>
            Cancelar y descartar la grabación
          </button>
        </div>
      </main>

      <RecordingBar />
    </div>
  );
}
