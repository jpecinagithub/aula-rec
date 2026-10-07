import { StudioProvider, useStudio } from './studio/StudioContext.tsx';
import { ComposerCanvas } from './components/ComposerCanvas.tsx';
import { Home } from './components/Home.tsx';
import { PermissionsWizard } from './components/wizard/PermissionsWizard.tsx';
import { SetupRecorder } from './components/SetupRecorder.tsx';
import { CountdownOverlay } from './components/CountdownOverlay.tsx';
import { RecordingView } from './components/RecordingView.tsx';
import { ResultScreen } from './components/ResultScreen.tsx';

function ProcessingOverlay() {
  return (
    <div className="processing-overlay" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <p>Finalizando grabación…</p>
    </div>
  );
}

function ErrorScreen() {
  const { error, dismissError } = useStudio();
  return (
    <div className="page">
      <main className="error-screen" role="alert">
        <h1>Algo no ha salido bien</h1>
        <p>
          <strong>{error?.title ?? 'Error desconocido'}</strong>
        </p>
        <p className="muted">{error?.detail}</p>
        <button type="button" className="btn btn-primary btn-lg" onClick={dismissError}>
          Volver al inicio
        </button>
      </main>
    </div>
  );
}

function Shell() {
  const { status } = useStudio();
  return (
    <div className="app">
      <ComposerCanvas />
      {status === 'idle' && <Home />}
      {status === 'permissions' && <PermissionsWizard />}
      {(status === 'setup' || status === 'countdown') && <SetupRecorder />}
      {status === 'countdown' && <CountdownOverlay />}
      {(status === 'recording' || status === 'paused') && <RecordingView />}
      {status === 'processing' && <ProcessingOverlay />}
      {(status === 'preview' || status === 'exporting' || status === 'completed') && <ResultScreen />}
      {status === 'error' && <ErrorScreen />}
    </div>
  );
}

export default function App() {
  return (
    <StudioProvider>
      <Shell />
    </StudioProvider>
  );
}
