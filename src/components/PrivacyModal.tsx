/** Explicación sencilla de privacidad. */
export function PrivacyModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="privacy-title">Privacidad</h2>
        <p>
          <strong>
            Tus vídeos no se suben a ningún servidor. La grabación y el procesamiento se
            realizan localmente en tu navegador.
          </strong>
        </p>
        <ul className="privacy-list">
          <li>La pantalla, la cámara y el micrófono se capturan en tu ordenador.</li>
          <li>El vídeo se compone y se graba en la memoria de tu navegador.</li>
          <li>La exportación (recorte, cambio de tamaño o formato) también ocurre en tu equipo.</li>
          <li>No guardamos grabaciones, ni audio, ni imágenes en ningún servidor.</li>
          <li>Al cerrar o recargar la página, los datos temporales desaparecen.</li>
        </ul>
        <p className="muted">
          La única información que sale de tu navegador son métricas anónimas de uso
          (por ejemplo, «grabación completada»), nunca contenido multimedia.
        </p>
        <button type="button" className="btn btn-primary" onClick={onClose} autoFocus>
          Entendido
        </button>
      </div>
    </div>
  );
}
