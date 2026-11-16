import { Navigate, Route, Routes } from 'react-router-dom';
import { useStageScale } from './hooks/useStageScale';
import { AudiencePage } from './pages/AudiencePage';
import { OperatorPage } from './pages/OperatorPage';

export default function App() {
  const scale = useStageScale();
  return (
    <div className="shell">
      <div className="stage" style={{ transform: `scale(${scale})` }}>
        <Routes>
          <Route path="/" element={<AudiencePage />} />
          <Route path="/operator" element={<OperatorPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
