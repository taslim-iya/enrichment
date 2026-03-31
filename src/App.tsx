import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import LeadsPage from './pages/LeadsPage';
import LeadDetailPage from './pages/LeadDetailPage';
import CallSheetPage from './pages/CallSheetPage';
import SourcesPage from './pages/SourcesPage';
import TeamPage from './pages/TeamPage';
import DealFlowPage from './pages/DealFlowPage';
import ImportExportPage from './pages/ImportExportPage';
import SettingsPage from './pages/SettingsPage';
import EnrichmentPage from './pages/EnrichmentPage';
import JarvisPage from './pages/JarvisPage';

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#F6F9FC' }}>
        <Sidebar />
        <main style={{ flex: 1, marginLeft: 256, padding: '32px 40px' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/leads" replace />} />
            <Route path="/chat" element={<JarvisPage />} />
            <Route path="/jarvis" element={<JarvisPage />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/leads/:id" element={<LeadDetailPage />} />
            <Route path="/call-sheet" element={<CallSheetPage />} />
            <Route path="/sources" element={<SourcesPage />} />
            <Route path="/team" element={<TeamPage />} />
            <Route path="/dealflow" element={<DealFlowPage />} />
            <Route path="/import-export" element={<ImportExportPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/enrichment" element={<EnrichmentPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
