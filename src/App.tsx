import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import LeadsPage from '@/pages/LeadsPage';
import LeadDetailPage from '@/pages/LeadDetailPage';
import CallSheetPage from '@/pages/CallSheetPage';
import SourcesPage from '@/pages/SourcesPage';
import TeamPage from '@/pages/TeamPage';
import DealFlowPage from '@/pages/DealFlowPage';
import ImportExportPage from '@/pages/ImportExportPage';
import SettingsPage from '@/pages/SettingsPage';
import EnrichmentPage from '@/pages/EnrichmentPage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#09090b] text-[#f7f8f8]">
        <Sidebar />
        <main className="ml-64 p-6 min-h-screen">
          <Routes>
            <Route path="/" element={<Navigate to="/leads" replace />} />
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
