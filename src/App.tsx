import { Navigate, Route, Routes } from 'react-router-dom';
import { useStageScale } from './hooks/useStageScale';
import { AudiencePage } from './pages/AudiencePage';
import { OperatorPage } from './pages/OperatorPage';

export default function App() {
  useStageScale();
  return (
    <div className="shell">
      <div className="stage">
        <Routes>
          <Route path="/" element={<AudiencePage />} />
          {/* Forced routes for testing/rehearsal: always this view, regardless of the operator's choice. */}
          <Route path="/classic" element={<AudiencePage forceView="classic" />} />
          <Route path="/reveal" element={<AudiencePage forceView="reveal" />} />
          <Route path="/fallback" element={<AudiencePage forceView="fallback" />} />
          <Route path="/operator" element={<OperatorPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
