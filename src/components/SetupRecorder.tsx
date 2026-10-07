import { useStudio } from '../studio/StudioContext.tsx';
import { StageSlot } from './StageSlot.tsx';
import { AudioMeter } from './AudioMeter.tsx';
import { CropSelector } from './wizard/CropSelector.tsx';
import { formatDims } from '../lib/format.ts';
import { bitrateFor, estimateSizeMB, formatMB, recommendedMaxMinutes } from '../services/recorder.ts';
import type { CameraPosition, QualityLevel } from '../studio/types.ts';

const RESOLUTIONS = [
  { w: 1920, h: 1080, label: '1920 × 1080 · Full HD · 16:9' },
  { w: 1280, h: 720, label: '1280 × 720 · HD · 16:9' },
  { w: 854, h: 480, label: '854 × 480 · Ligero · 16:9' },
  { w: 1080, h: 1920, label: '1080 × 1920 · Shorts · 9:16' },
  { w: 1080, h: 1080, label: '1080 × 1080 · Cuadrado · 1:1' },
];

const QUALITIES: { id: QualityLevel; label: string }[] = [
  { id: 'high', label: 'Alta' },
  { id: 'medium', label: 'Media' },
  { id: 'low', label: 'Ligera' },
];

const POSITIONS: { id: CameraPosition; label: string }[] = [
  { id: 'top-left', label: 'Sup. izq.' },
  { id: 'top-right', label: 'Sup. der.' },
  { id: 'bottom-left', label: 'Inf. izq.' },
  { id: 'bottom-right', label: 'Inf. der.' },
];

/** Configuración previa: dos columnas, vista previa en vivo a la izquierda. */
export function SetupRecorder() {
  const s = useStudio();
  const resValue = `${s.outWidth}x${s.outHeight}`;
  const bitrate = bitrateFor(s.quality, s.outWidth, s.outHeight);
  const mbPerMin = estimateSizeMB(bitrate, 1);
  const maxMin = recommendedMaxMinutes(bitrate);
  const screenVideo = s.screenVideoRef.current;
  const zoneLabel =
    s.screenMode === 'full'
      ? 'toda la fuente'
      : screenVideo && screenVideo.videoWidth > 0
        ? formatDims(s.crop.w * screenVideo.videoWidth, s.crop.h * screenVideo.videoHeight)
        : 'zona personalizada';

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <span className="brand-dot" />
          </span>
          <span className="brand-name">AulaRec</span>
        </div>
        <button type="button" className="link-btn" onClick={s.backToWizard}>
          ← Volver al asistente
        </button>
      </header>

      <main className="setup-grid">
        <div className="setup-preview">
          <StageSlot className="stage-slot" />
          <p className="muted small">
            Así quedará tu vídeo. Los cambios se ven al instante.
          </p>
        </div>

        <div className="setup-panel">
          <label className="youtube-toggle">
            <input
              type="checkbox"
              checked={s.youtubeMode}
              onChange={(e) => s.setYoutubeMode(e.target.checked)}
            />
            <span>
              <strong>Optimizar para YouTube</strong>
              <small>1920 × 1080 · 30 fps · calidad alta · cámara abajo a la derecha</small>
            </span>
          </label>

          <section className="setup-section" aria-label="Pantalla">
            <h3>Pantalla</h3>
            <p className="muted small">
              Zona: {zoneLabel}
            </p>
            <div className="row">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => s.setShowCropEditor(true)}>
                Editar zona
              </button>
            </div>
          </section>

          <section className="setup-section" aria-label="Cámara">
            <h3>Cámara</h3>
            <label className="check-row">
              <input
                type="checkbox"
                checked={s.camera.visible && s.cameraActive}
                disabled={!s.cameraActive}
                onChange={(e) => s.patchCamera({ visible: e.target.checked })}
              />
              Mostrar cámara circular
            </label>
            {s.cameraActive && s.camera.visible && (
              <>
                <div className="corner-grid corner-grid-mini">
                  {POSITIONS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={'corner-btn' + (s.camera.position === p.id ? ' corner-btn-active' : '')}
                      onClick={() => s.patchCamera({ position: p.id })}
                      aria-pressed={s.camera.position === p.id}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <label className="field">
                  <span>Tamaño ({Math.round(s.camera.size * 100)} %)</span>
                  <input
                    type="range"
                    min={10}
                    max={25}
                    value={Math.round(s.camera.size * 100)}
                    onChange={(e) => s.patchCamera({ size: Number(e.target.value) / 100 })}
                    aria-label="Tamaño de la cámara"
                  />
                </label>
              </>
            )}
          </section>

          <section className="setup-section" aria-label="Micrófono">
            <h3>Micrófono</h3>
            {s.micActive ? (
              <>
                <p className="muted small">{s.micLabel}</p>
                <AudioMeter getLevel={s.getMicLevel} />
                <label className="field">
                  <span>Volumen ({Math.round(s.micVolume * 100)} %)</span>
                  <input
                    type="range"
                    min={0}
                    max={150}
                    value={Math.round(s.micVolume * 100)}
                    onChange={(e) => s.setMicVolume(Number(e.target.value) / 100)}
                    aria-label="Volumen del micrófono"
                  />
                </label>
              </>
            ) : (
              <p className="warn-text small">Sin micrófono: el vídeo no tendrá narración.</p>
            )}
          </section>

          <section className="setup-section" aria-label="Resolución y calidad">
            <h3>Resolución y calidad</h3>
            <label className="field">
              <span>Resolución</span>
              <select
                value={resValue}
                onChange={(e) => {
                  const [w, h] = e.target.value.split('x').map(Number);
                  s.setOutSize(w, h);
                }}
              >
                {RESOLUTIONS.map((r) => (
                  <option key={`${r.w}x${r.h}`} value={`${r.w}x${r.h}`}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="row">
              <label className="field field-inline">
                <span>FPS</span>
                <select value={s.fps} onChange={(e) => s.setFps(Number(e.target.value))} aria-label="Fotogramas por segundo">
                  <option value={24}>24</option>
                  <option value={30}>30</option>
                  <option value={60}>60</option>
                </select>
              </label>
              <fieldset className="field field-inline" aria-label="Calidad">
                <span>Calidad</span>
                <div className="seg">
                  {QUALITIES.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      className={'seg-btn' + (s.quality === q.id ? ' seg-btn-active' : '')}
                      onClick={() => s.setQuality(q.id)}
                      aria-pressed={s.quality === q.id}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          </section>

          <button type="button" className="btn btn-primary btn-xl btn-block" onClick={s.startCountdown}>
            Empezar grabación
          </button>
          <p className="muted small center">
            Verás una cuenta atrás de 3 segundos antes de empezar.
            <br />
            Tamaño estimado: ~{formatMB(mbPerMin)} por minuto. Para grabaciones de más
            de {maxMin} min se recomienda bajar la calidad o la resolución.
          </p>
        </div>
      </main>

      {s.showCropEditor && <CropSelector onClose={() => undefined} />}
    </div>
  );
}
