import { useRef, useState } from 'react';
import { useStudio } from '../studio/StudioContext.tsx';
import { PRESETS } from '../studio/types.ts';
import type { Container, OutputPreset, QualityLevel } from '../studio/types.ts';
import { formatBytes, formatClock, formatDims, formatDurationShort } from '../lib/format.ts';

/** Recorte simple: solo inicio y final. */
function SimpleTrimmer() {
  const { meta, trim, applyTrim, previewUrl } = useStudio();
  const videoRef = useRef<HTMLVideoElement>(null);
  const duration = meta ? meta.durationMs / 1000 : 0;
  const finalSecs = Math.max(0, trim.end - trim.start);

  const seek = (t: number) => {
    const v = videoRef.current;
    if (v) {
      v.currentTime = Math.min(duration - 0.05, Math.max(0, t));
      void v.play().catch(() => undefined);
    }
  };

  return (
    <section className="trimmer" aria-label="Recorte básico">
      <h3>Recortar</h3>
      <video ref={videoRef} src={previewUrl ?? undefined} className="trim-video" muted playsInline preload="metadata" />
      <div className="trim-rail" aria-hidden="true">
        <div
          className="trim-selected"
          style={{
            left: `${(trim.start / duration) * 100}%`,
            width: `${(finalSecs / duration) * 100}%`,
          }}
        />
      </div>
      <label className="field">
        <span>Inicio: {formatDurationShort(trim.start)}</span>
        <input
          type="range"
          min={0}
          max={duration}
          step={0.1}
          value={trim.start}
          onChange={(e) => applyTrim(Math.min(Number(e.target.value), trim.end - 0.5), trim.end)}
          aria-label="Recortar inicio"
        />
      </label>
      <label className="field">
        <span>Final: {formatDurationShort(trim.end)}</span>
        <input
          type="range"
          min={0}
          max={duration}
          step={0.1}
          value={trim.end}
          onChange={(e) => applyTrim(trim.start, Math.max(Number(e.target.value), trim.start + 0.5))}
          aria-label="Recortar final"
        />
      </label>
      <div className="row">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => seek(trim.start)}>
          Ver inicio
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => seek(trim.end - 2)}>
          Ver final
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => applyTrim(0, duration)}>
          Restablecer
        </button>
      </div>
      <p className="muted small">
        Duración original: <strong>{formatDurationShort(duration)}</strong> · Duración final:{' '}
        <strong>{formatDurationShort(finalSecs)}</strong>
      </p>
    </section>
  );
}

/** Panel de exportación con presets y configuración personalizada. */
function ExportPanel() {
  const { startExport } = useStudio();
  const [selected, setSelected] = useState('youtube-1080');
  const [customOpen, setCustomOpen] = useState(false);
  const [cWidth, setCWidth] = useState(1920);
  const [cHeight, setCHeight] = useState(1080);
  const [cFps, setCFps] = useState(30);
  const [cQuality, setCQuality] = useState<QualityLevel>('high');
  const [cContainer, setCContainer] = useState<Container>('mp4');

  const doExport = () => {
    if (customOpen) {
      const preset: OutputPreset = {
        id: 'custom',
        name: 'Personalizada',
        description: `${cWidth} × ${cHeight} · ${cFps} fps`,
        width: cWidth,
        height: cHeight,
        fps: cFps,
        quality: cQuality,
        container: cContainer,
      };
      startExport(preset);
    } else {
      const preset = PRESETS.find((p) => p.id === selected) ?? PRESETS[0];
      startExport(preset);
    }
  };

  return (
    <section className="export-panel" aria-label="Exportar vídeo">
      <h3>Exportar vídeo</h3>
      <div className="preset-list" role="radiogroup" aria-label="Preset de exportación">
        {PRESETS.map((p) => (
          <label key={p.id} className={'preset' + (selected === p.id && !customOpen ? ' preset-active' : '')}>
            <input
              type="radio"
              name="preset"
              checked={selected === p.id && !customOpen}
              onChange={() => {
                setSelected(p.id);
                setCustomOpen(false);
              }}
            />
            <span className="preset-name">{p.name}</span>
            <span className="preset-desc">{p.description}</span>
          </label>
        ))}
        <label className={'preset' + (customOpen ? ' preset-active' : '')}>
          <input
            type="radio"
            name="preset"
            checked={customOpen}
            onChange={() => setCustomOpen(true)}
          />
          <span className="preset-name">Configuración personalizada</span>
          <span className="preset-desc">Elige resolución, fps, calidad y formato</span>
        </label>
      </div>

      {customOpen && (
        <div className="custom-grid">
          <label className="field">
            <span>Ancho</span>
            <select value={cWidth} onChange={(e) => setCWidth(Number(e.target.value))}>
              {[1920, 1280, 1080, 854, 720].map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Alto</span>
            <select value={cHeight} onChange={(e) => setCHeight(Number(e.target.value))}>
              {[1920, 1080, 720, 480].map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>FPS</span>
            <select value={cFps} onChange={(e) => setCFps(Number(e.target.value))}>
              {[24, 30, 60].map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Calidad</span>
            <select value={cQuality} onChange={(e) => setCQuality(e.target.value as QualityLevel)}>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Ligera</option>
            </select>
          </label>
          <label className="field">
            <span>Formato</span>
            <select value={cContainer} onChange={(e) => setCContainer(e.target.value as Container)}>
              <option value="mp4">MP4</option>
              <option value="webm">WebM</option>
            </select>
          </label>
        </div>
      )}

      <button type="button" className="btn btn-primary btn-lg btn-block" onClick={doExport}>
        Exportar vídeo
      </button>
      <p className="muted small center">
        Si tu grabación ya coincide con el preset, la descarga es inmediata. En otro caso se
        convierte localmente en tu navegador (la primera vez puede tardar un poco).
      </p>
    </section>
  );
}

/** Pantalla de resultado: "Tu vídeo está listo" + revisión + exportación. */
export function ResultScreen() {
  const s = useStudio();
  const meta = s.meta;

  if (!meta || !s.previewUrl) return null;

  const pct = s.exportProgress == null ? 0 : Math.round(s.exportProgress * 100);

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <span className="brand-dot" />
          </span>
          <span className="brand-name">AulaRec</span>
        </div>
        <button type="button" className="btn btn-secondary" onClick={s.resetAll}>
          Nueva grabación
        </button>
      </header>

      <main className="result">
        <h1>Tu vídeo está listo</h1>

        {s.notice && (
          <div className="notice" role="status">
            {s.notice}
            <button type="button" className="link-btn" onClick={s.dismissNotice}>
              Cerrar
            </button>
          </div>
        )}

        <video src={s.previewUrl} controls playsInline preload="metadata" className="result-video" aria-label="Vista previa del vídeo grabado" />

        <dl className="meta-grid">
          <div>
            <dt>Duración</dt>
            <dd>{formatClock(meta.durationMs)}</dd>
          </div>
          <div>
            <dt>Resolución</dt>
            <dd>{formatDims(meta.width, meta.height)}</dd>
          </div>
          <div>
            <dt>Formato</dt>
            <dd>{meta.container === 'mp4' ? 'MP4' : 'WebM'}</dd>
          </div>
          <div>
            <dt>Tamaño</dt>
            <dd>{formatBytes(meta.sizeBytes)}</dd>
          </div>
        </dl>

        {s.status === 'preview' && (
          <>
            <SimpleTrimmer />
            <ExportPanel />
          </>
        )}

        {s.status === 'exporting' && (
          <div className="export-progress" role="status" aria-live="polite">
            <p>
              <strong>Preparando vídeo…</strong>
            </p>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <p className="progress-pct">{pct} %</p>
          </div>
        )}

        {s.status === 'completed' && s.downloadUrl && (
          <div className="download-box">
            <p className="muted">Tu archivo está listo para subir a YouTube.</p>
            <button type="button" className="btn btn-primary btn-xl btn-block" onClick={s.downloadExport}>
              Descargar vídeo
            </button>
            <p className="muted small center">{s.downloadName}</p>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>
          AulaRec · Una herramienta de Jon Peciña ·{' '}
          <a href="mailto:jpecina@gmail.com">jpecina@gmail.com</a>
        </p>
      </footer>
    </div>
  );
}
