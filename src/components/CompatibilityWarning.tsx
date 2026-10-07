import { isProbablyMobile } from '../services/browserSupport.ts';
import type { SupportReport } from '../services/browserSupport.ts';

/** Mensaje comprensible cuando faltan APIs críticas. Sin tecnicismos. */
export function CompatibilityWarning({ support }: { support: SupportReport }) {
  const mobile = isProbablyMobile();
  return (
    <div className="compat-card" role="alert">
      <div className="compat-icon" aria-hidden="true">
        ⚠️
      </div>
      <div>
        <h3>Tu navegador no admite todas las funciones necesarias</h3>
        <p>
          AulaRec necesita acceso a la captura de pantalla, la cámara, el micrófono y la
          grabación de vídeo en el navegador. En este dispositivo o navegador falta:{' '}
          <strong>{support.missingLabels.join(', ')}</strong>.
        </p>
        {mobile ? (
          <p>
            En móviles y tablets la captura de pantalla no suele estar permitida por el
            navegador. Puedes explorar la aplicación, pero para grabar usa un ordenador.
          </p>
        ) : (
          <p>Recomendamos utilizar la última versión de Chrome o Edge en un ordenador.</p>
        )}
      </div>
    </div>
  );
}
