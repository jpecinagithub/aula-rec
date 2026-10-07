import { useEffect, useRef, useState } from 'react';
import { useStudio } from '../../studio/StudioContext.tsx';
import { VideoElementView } from '../VideoElementView.tsx';
import { clamp, formatDims } from '../../lib/format.ts';
import type { CropRect } from '../../studio/types.ts';

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;

function clampRect(r: CropRect): CropRect {
  const w = clamp(r.w, 0.03, 1);
  const h = clamp(r.h, 0.03, 1);
  return { x: clamp(r.x, 0, 1 - w), y: clamp(r.y, 0, 1 - h), w, h };
}

function resizeRect(orig: CropRect, handle: string, dx: number, dy: number): CropRect {
  let { x, y, w, h } = orig;
  if (handle.includes('e')) w += dx;
  if (handle.includes('s')) h += dy;
  if (handle.includes('w')) {
    x += dx;
    w -= dx;
  }
  if (handle.includes('n')) {
    y += dy;
    h -= dy;
  }
  if (w < 0) {
    x += w;
    w = -w;
  }
  if (h < 0) {
    y += h;
    h = -h;
  }
  return clampRect({ x, y, w, h });
}

interface Drag {
  mode: 'create' | 'move' | 'resize';
  handle?: string;
  startX: number;
  startY: number;
  orig: CropRect;
}

/**
 * Editor de zona: drag & drop para crear, mover y redimensionar la selección
 * sobre la pantalla capturada. Oscurece el exterior y muestra dimensiones.
 */
export function CropSelector({ onClose }: { onClose: () => void }) {
  const s = useStudio();
  const stageRef = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<CropRect>(() =>
    s.screenMode === 'region' && (s.crop.w < 1 || s.crop.h < 1) ? s.crop : { x: 0.15, y: 0.15, w: 0.7, h: 0.7 },
  );
  const dragRef = useRef<Drag | null>(null);
  const selRef = useRef(sel);
  useEffect(() => {
    selRef.current = sel;
  }, [sel]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toNorm = (clientX: number, clientY: number) => {
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: (clientX - r.left) / r.width, y: (clientY - r.top) / r.height };
  };

  const inside = (r: CropRect, p: { x: number; y: number }) =>
    p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

  const onPointerDown = (e: React.PointerEvent) => {
    const p = toNorm(e.clientX, e.clientY);
    const handle = (e.target as HTMLElement).dataset.handle;
    if (handle) {
      dragRef.current = { mode: 'resize', handle, startX: p.x, startY: p.y, orig: selRef.current };
    } else if (inside(selRef.current, p)) {
      dragRef.current = { mode: 'move', startX: p.x, startY: p.y, orig: selRef.current };
    } else {
      dragRef.current = {
        mode: 'create',
        startX: p.x,
        startY: p.y,
        orig: { x: p.x, y: p.y, w: 0, h: 0 },
      };
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const p = toNorm(e.clientX, e.clientY);
    const dx = p.x - d.startX;
    const dy = p.y - d.startY;
    if (d.mode === 'create') {
      const x = Math.min(d.startX, p.x);
      const y = Math.min(d.startY, p.y);
      setSel(clampRect({ x, y, w: Math.abs(dx), h: Math.abs(dy) }));
    } else if (d.mode === 'move') {
      setSel(clampRect({ ...d.orig, x: d.orig.x + dx, y: d.orig.y + dy }));
    } else {
      setSel(resizeRect(d.orig, d.handle ?? 'se', dx, dy));
    }
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const video = s.screenVideoRef.current;
  const dims =
    video && video.videoWidth > 0
      ? formatDims(sel.w * video.videoWidth, sel.h * video.videoHeight)
      : null;

  const confirm = () => {
    s.setCrop(sel);
    s.setScreenMode('region');
    s.setShowCropEditor(false);
    onClose();
  };

  const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

  return (
    <div className="crop-overlay" role="dialog" aria-modal="true" aria-label="Seleccionar zona de grabación">
      <div className="crop-topbar">
        <h2>Selecciona la zona a grabar</h2>
        <p className="muted">
          Arrastra para crear la zona · muévela · cambia su tamaño con los tiradores
          {dims && (
            <>
              {' '}· <strong>{dims}</strong>
            </>
          )}
        </p>
      </div>

      <div
        ref={stageRef}
        className="crop-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <VideoElementView video={video} className="crop-video" label="Pantalla capturada" />
        {/* Oscurecer el exterior */}
        <div className="crop-dim" style={{ left: 0, top: 0, width: pct(sel.x), height: '100%' }} />
        <div className="crop-dim" style={{ left: pct(sel.x + sel.w), top: 0, right: 0, height: '100%' }} />
        <div className="crop-dim" style={{ left: pct(sel.x), top: 0, width: pct(sel.w), height: pct(sel.y) }} />
        <div className="crop-dim" style={{ left: pct(sel.x), top: pct(sel.y + sel.h), width: pct(sel.w), bottom: 0 }} />
        {/* Selección */}
        <div
          className="crop-rect"
          style={{ left: pct(sel.x), top: pct(sel.y), width: pct(sel.w), height: pct(sel.h) }}
        >
          {HANDLES.map((h) => (
            <span key={h} data-handle={h} className={`crop-handle crop-handle-${h}`} aria-hidden="true" />
          ))}
        </div>
      </div>

      <div className="crop-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            s.setCrop({ x: 0, y: 0, w: 1, h: 1 });
            s.setScreenMode('full');
            s.setShowCropEditor(false);
            onClose();
          }}
        >
          Toda la pantalla
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setSel({ x: 0.15, y: 0.15, w: 0.7, h: 0.7 })}
        >
          Restablecer
        </button>
        <span className="crop-spacer" />
        <button type="button" className="btn btn-ghost" onClick={() => { s.setShowCropEditor(false); onClose(); }}>
          Cancelar
        </button>
        <button type="button" className="btn btn-primary" onClick={confirm}>
          Confirmar selección
        </button>
      </div>
    </div>
  );
}
