import { useStudio } from '../../studio/StudioContext.tsx';
import { ScreenStep } from './ScreenStep.tsx';
import { CameraStep } from './CameraStep.tsx';
import { MicStep } from './MicStep.tsx';
import { CropSelector } from './CropSelector.tsx';

const STEPS = ['Pantalla', 'Cámara', 'Micrófono'];

/** Asistente de preparación: verificar visualmente todo antes de grabar. */
export function PermissionsWizard() {
  const { wizardStep, setWizardStep, notice, dismissNotice, showCropEditor } = useStudio();

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <span className="brand-dot" />
          </span>
          <span className="brand-name">AulaRec</span>
        </div>
      </header>

      <main className="wizard">
        <ol className="steps" aria-label="Pasos de preparación">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={
                'step' + (i === wizardStep ? ' step-current' : '') + (i < wizardStep ? ' step-done' : '')
              }
              aria-current={i === wizardStep ? 'step' : undefined}
            >
              <span className="step-num" aria-hidden="true">{i + 1}</span> {label}
            </li>
          ))}
        </ol>

        {notice && (
          <div className="notice" role="status">
            {notice}
            <button type="button" className="link-btn" onClick={dismissNotice}>
              Cerrar
            </button>
          </div>
        )}

        {wizardStep === 0 && <ScreenStep />}
        {wizardStep === 1 && <CameraStep />}
        {wizardStep === 2 && <MicStep />}
      </main>

      {showCropEditor && <CropSelector onClose={() => setWizardStep(wizardStep)} />}
    </div>
  );
}
