import { useState } from 'react';
import { useStudio } from '../studio/StudioContext.tsx';
import { CompatibilityWarning } from './CompatibilityWarning.tsx';
import { PrivacyModal } from './PrivacyModal.tsx';

/** Ilustración original: pantalla con contenido educativo + profesor circular. */
function HeroMockup() {
  return (
    <svg viewBox="0 0 560 360" className="hero-mockup" role="img" aria-label="Ejemplo de vídeo: pantalla con lección y profesor en círculo">
      <rect x="40" y="20" width="480" height="300" rx="16" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
      <rect x="40" y="20" width="480" height="34" rx="16" fill="#f1f5f9" />
      <circle cx="64" cy="37" r="5" fill="#f87171" />
      <circle cx="82" cy="37" r="5" fill="#fbbf24" />
      <circle cx="100" cy="37" r="5" fill="#34d399" />
      <rect x="70" y="80" width="220" height="18" rx="9" fill="#4f46e5" opacity="0.85" />
      <rect x="70" y="110" width="380" height="10" rx="5" fill="#cbd5e1" />
      <rect x="70" y="128" width="340" height="10" rx="5" fill="#e2e8f0" />
      <rect x="70" y="146" width="360" height="10" rx="5" fill="#e2e8f0" />
      <rect x="70" y="176" width="180" height="80" rx="10" fill="#eef2ff" stroke="#c7d2fe" strokeWidth="2" />
      <polygon points="140,196 140,236 172,216" fill="#4f46e5" />
      <rect x="266" y="176" width="184" height="80" rx="10" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="2" />
      <rect x="282" y="194" width="120" height="8" rx="4" fill="#cbd5e1" />
      <rect x="282" y="210" width="150" height="8" rx="4" fill="#e2e8f0" />
      <rect x="282" y="226" width="100" height="8" rx="4" fill="#e2e8f0" />
      <rect x="60" y="320" width="440" height="8" rx="4" fill="#e2e8f0" />
      <rect x="250" y="328" width="60" height="14" rx="4" fill="#cbd5e1" />
      {/* Profesor circular */}
      <circle cx="452" cy="252" r="52" fill="#ffffff" stroke="#ffffff" strokeWidth="6" />
      <circle cx="452" cy="252" r="46" fill="#e0e7ff" />
      <circle cx="452" cy="240" r="14" fill="#6366f1" />
      <path d="M 424 278 Q 452 250 480 278 L 480 290 L 424 290 Z" fill="#6366f1" />
      <circle cx="452" cy="252" r="46" fill="none" stroke="#4f46e5" strokeWidth="3" opacity="0.35" />
    </svg>
  );
}

export function Home() {
  const { support, startWizard } = useStudio();
  const [showPrivacy, setShowPrivacy] = useState(false);

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <span className="brand-dot" />
          </span>
          <span className="brand-name">AulaRec</span>
        </div>
        <nav>
          <button type="button" className="link-btn" onClick={() => setShowPrivacy(true)}>
            Privacidad
          </button>
        </nav>
      </header>

      <main className="hero">
        <div className="hero-copy">
          <p className="hero-badge">100 % en tu navegador · Sin instalaciones</p>
          <h1>Graba tus explicaciones</h1>
          <p className="hero-sub">
            Captura tu pantalla, tu voz y tu cámara. Crea vídeos listos para YouTube
            directamente desde tu navegador.
          </p>
          {support.ok ? (
            <button type="button" className="btn btn-primary btn-xl" onClick={startWizard}>
              Nueva grabación
            </button>
          ) : (
            <CompatibilityWarning support={support} />
          )}
          <ul className="hero-points">
            <li>Sin instalaciones.</li>
            <li>Sin subir tus vídeos.</li>
            <li>Listo para YouTube.</li>
          </ul>
        </div>
        <div className="hero-art">
          <HeroMockup />
        </div>
      </main>

      <section className="how" aria-label="Cómo funciona">
        <div className="how-card">
          <span className="how-num" aria-hidden="true">1</span>
          <h3>Prepara</h3>
          <p>Elige qué pantalla grabar, coloca tu cámara circular y comprueba tu micrófono.</p>
        </div>
        <div className="how-card">
          <span className="how-num" aria-hidden="true">2</span>
          <h3>Graba</h3>
          <p>Cuenta atrás, pausa cuando quieras y finaliza. El vídeo ya sale compuesto.</p>
        </div>
        <div className="how-card">
          <span className="how-num" aria-hidden="true">3</span>
          <h3>Exporta</h3>
          <p>Recorta el inicio o el final y descarga tu MP4 listo para subir a YouTube.</p>
        </div>
      </section>

      <section className="privacy-strip">
        <p>
          <strong>
            Tus vídeos no se suben a ningún servidor. La grabación y el procesamiento se
            realizan localmente en tu navegador.
          </strong>{' '}
          <button type="button" className="link-btn" onClick={() => setShowPrivacy(true)}>
            Privacidad
          </button>
        </p>
      </section>

      <footer className="footer">
        <p>
          AulaRec · Una herramienta de Jon Peciña ·{' '}
          <a href="mailto:jpecina@gmail.com">jpecina@gmail.com</a>
        </p>
      </footer>

      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
    </div>
  );
}
