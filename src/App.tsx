import { useState } from 'react';
import { Layers, X, ChevronUp } from 'lucide-react';
import { PublicLayout } from './components/layouts/PublicLayout';
import { CabinetLayout } from './components/layouts/CabinetLayout';
import { HomePage } from './pages/public/HomePage';
import { VerifyPage } from './pages/public/VerifyPage';
import { TariffsPage } from './pages/public/TariffsPage';
import { ServicesPage } from './pages/public/ServicesPage';
import { DocumentsPage } from './pages/public/DocumentsPage';
import { OpenDataPage } from './pages/public/OpenDataPage';
import { FaqPage } from './pages/public/FaqPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ApplicantDashboard } from './pages/applicant/ApplicantDashboard';
import { PermitWizardPage } from './pages/applicant/PermitWizardPage';
import { ApplicationDetailPage } from './pages/applicant/ApplicationDetailPage';
import { MyPermitsPage } from './pages/applicant/MyPermitsPage';
import { ApplicantHelpPage } from './pages/applicant/ApplicantHelpPage';
import { GisEditorPage } from './pages/gis/GisEditorPage';
import { GisImportPage } from './pages/gis/GisImportPage';
import { GeobotanicNormsPage } from './pages/normative/GeobotanicNormsPage';
import { LeskhozInboxPage } from './pages/leskhoz/LeskhozInboxPage';
import { LeskhozReviewPage } from './pages/leskhoz/LeskhozReviewPage';
import { ManagerDecisionPage } from './pages/manager/ManagerDecisionPage';
import { InspectorTasksPage } from './pages/field/InspectorTasksPage';
import { InspectorScanPage } from './pages/field/InspectorScanPage';
import { InspectorInspectionPage } from './pages/field/InspectorInspectionPage';
import { AccountantReconciliationPage } from './pages/accountant/AccountantReconciliationPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { ProsecutorPortalPage } from './pages/prosecutor/ProsecutorPortalPage';
import { UIKitShowcase } from './components/ui-kit/UIKitShowcase';

export function App() {
  const [currentPage, setCurrentPage] = useState<string>('home');
  const [pageParams, setPageParams] = useState<any>({});
  const [showDemoMenu, setShowDemoMenu] = useState<boolean>(false);

  const handleNavigate = (page: string, params?: any) => {
    setCurrentPage(page);
    if (params) setPageParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isCabinetRoute =
    currentPage.startsWith('applicant_') ||
    currentPage.startsWith('gis_') ||
    currentPage.startsWith('normative_') ||
    currentPage.startsWith('leskhoz_') ||
    currentPage.startsWith('manager_') ||
    currentPage.startsWith('field_') ||
    currentPage.startsWith('accountant_') ||
    currentPage.startsWith('admin_') ||
    currentPage.startsWith('prosecutor_');

  return (
    <div className="relative min-h-screen bg-[#F8F9FA] text-[#1A1F24]">
      {/* ── Floating Demo Switcher Widget (Bottom Right) ──────────────── */}
      <div className="fixed bottom-4 right-4 z-50 font-sans">
        {showDemoMenu ? (
          <div className="bg-[#123522] text-white p-4 rounded-2xl shadow-2xl border border-white/20 w-80 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <span className="bg-[#2E7D4F] text-white text-[10px] font-bold px-2 py-0.5 rounded">
                  DEMO ROLLAR
                </span>
                <span className="text-xs font-bold text-gray-200">Sahifalar Oʻtishi</span>
              </div>
              <button
                onClick={() => setShowDemoMenu(false)}
                className="p-1 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 text-xs max-h-80 overflow-y-auto pr-1">
              <div className="text-[10px] font-bold uppercase text-[#7FB98A] pt-1">Ochiq Portal</div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => { handleNavigate('home'); setShowDemoMenu(false); }}
                  className={`px-2 py-1.5 rounded text-left transition-colors ${currentPage === 'home' ? 'bg-[#2E7D4F] font-bold text-white' : 'hover:bg-white/10 text-gray-300'}`}
                >
                  Bosh sahifa
                </button>
                <button
                  onClick={() => { handleNavigate('services'); setShowDemoMenu(false); }}
                  className={`px-2 py-1.5 rounded text-left transition-colors ${currentPage === 'services' ? 'bg-[#2E7D4F] font-bold text-white' : 'hover:bg-white/10 text-gray-300'}`}
                >
                  Xizmatlar
                </button>
                <button
                  onClick={() => { handleNavigate('tariffs'); setShowDemoMenu(false); }}
                  className={`px-2 py-1.5 rounded text-left transition-colors ${currentPage === 'tariffs' ? 'bg-[#2E7D4F] font-bold text-white' : 'hover:bg-white/10 text-gray-300'}`}
                >
                  Tariflar
                </button>
                <button
                  onClick={() => { handleNavigate('documents'); setShowDemoMenu(false); }}
                  className={`px-2 py-1.5 rounded text-left transition-colors ${currentPage === 'documents' ? 'bg-[#2E7D4F] font-bold text-white' : 'hover:bg-white/10 text-gray-300'}`}
                >
                  Hujjatlar
                </button>
                <button
                  onClick={() => { handleNavigate('opendata'); setShowDemoMenu(false); }}
                  className={`px-2 py-1.5 rounded text-left transition-colors ${currentPage === 'opendata' ? 'bg-[#2E7D4F] font-bold text-white' : 'hover:bg-white/10 text-gray-300'}`}
                >
                  Ochiq maʼlumotlar
                </button>
                <button
                  onClick={() => { handleNavigate('faq'); setShowDemoMenu(false); }}
                  className={`px-2 py-1.5 rounded text-left transition-colors ${currentPage === 'faq' ? 'bg-[#2E7D4F] font-bold text-white' : 'hover:bg-white/10 text-gray-300'}`}
                >
                  Savollar
                </button>
              </div>

              <div className="text-[10px] font-bold uppercase text-[#7FB98A] pt-2">Arizachi Kabineti</div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => { handleNavigate('applicant_dashboard'); setShowDemoMenu(false); }}
                  className={`px-2 py-1.5 rounded text-left transition-colors ${currentPage === 'applicant_dashboard' ? 'bg-[#2E7D4F] font-bold text-white' : 'hover:bg-white/10 text-gray-300'}`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => { handleNavigate('applicant_wizard'); setShowDemoMenu(false); }}
                  className={`px-2 py-1.5 rounded text-left transition-colors ${currentPage === 'applicant_wizard' ? 'bg-[#2E7D4F] font-bold text-white' : 'hover:bg-white/10 text-gray-300'}`}
                >
                  6-Step Vizard
                </button>
              </div>

              <div className="text-[10px] font-bold uppercase text-[#7FB98A] pt-2">Xodim va Rahbar</div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => { handleNavigate('leskhoz_inbox'); setShowDemoMenu(false); }}
                  className={`px-2 py-1.5 rounded text-left transition-colors ${currentPage === 'leskhoz_inbox' ? 'bg-[#2E7D4F] font-bold text-white' : 'hover:bg-white/10 text-gray-300'}`}
                >
                  Oʻrmon Xodimi
                </button>
                <button
                  onClick={() => { handleNavigate('manager_decision'); setShowDemoMenu(false); }}
                  className={`px-2 py-1.5 rounded text-left transition-colors ${currentPage === 'manager_decision' ? 'bg-[#2E7D4F] font-bold text-white' : 'hover:bg-white/10 text-gray-300'}`}
                >
                  Rahbar (E-IMZO)
                </button>
              </div>

              <div className="text-[10px] font-bold uppercase text-[#7FB98A] pt-2">Nazorat va Moliya</div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => { handleNavigate('field_tasks'); setShowDemoMenu(false); }}
                  className={`px-2 py-1.5 rounded text-left transition-colors ${currentPage === 'field_tasks' ? 'bg-[#2E7D4F] font-bold text-white' : 'hover:bg-white/10 text-gray-300'}`}
                >
                  Inspektor PWA
                </button>
                <button
                  onClick={() => { handleNavigate('accountant_reconciliation'); setShowDemoMenu(false); }}
                  className={`px-2 py-1.5 rounded text-left transition-colors ${currentPage === 'accountant_reconciliation' ? 'bg-[#2E7D4F] font-bold text-white' : 'hover:bg-white/10 text-gray-300'}`}
                >
                  Buxgalteriya
                </button>
              </div>

              <div className="text-[10px] font-bold uppercase text-[#7FB98A] pt-2">Tizim va Prokuratura</div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => { handleNavigate('admin_settings'); setShowDemoMenu(false); }}
                  className={`px-2 py-1.5 rounded text-left transition-colors ${currentPage === 'admin_settings' ? 'bg-[#2E7D4F] font-bold text-white' : 'hover:bg-white/10 text-gray-300'}`}
                >
                  Admin Tizimi
                </button>
                <button
                  onClick={() => { handleNavigate('prosecutor_portal'); setShowDemoMenu(false); }}
                  className={`px-2 py-1.5 rounded text-left transition-colors ${currentPage === 'prosecutor_portal' ? 'bg-[#B91C1C] font-bold text-white' : 'hover:bg-white/10 text-red-300'}`}
                >
                  Prokuror Portali
                </button>
              </div>

              <div className="pt-2 border-t border-white/10">
                <button
                  onClick={() => { handleNavigate('uikit'); setShowDemoMenu(false); }}
                  className="w-full py-1.5 rounded text-center bg-white/10 hover:bg-white/20 text-white font-bold transition-colors"
                >
                  UI Kit Showcase
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowDemoMenu(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#123522] text-[#FFFFFF] shadow-xl hover:bg-[#23653F] border border-white/20 text-xs font-bold transition-all transform hover:scale-105"
          >
            <Layers className="w-4 h-4 text-[#7FB98A]" />
            <span>Demo Sahifalar</span>
            <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
          </button>
        )}
      </div>

      {/* Render Selected View */}
      {isCabinetRoute ? (
        <CabinetLayout
          onNavSelect={(page) => handleNavigate(page)}
          activeNavId={
            currentPage === 'applicant_permits' || currentPage === 'applicant_application_detail'
              ? 'permits'
              : currentPage === 'applicant_help'
              ? 'help'
              : currentPage.startsWith('gis_')
              ? 'gis'
              : currentPage.startsWith('field_')
              ? 'inspections'
              : currentPage.startsWith('admin_')
              ? 'users'
              : 'dashboard'
          }
        >
          {currentPage === 'applicant_dashboard' && (
            <ApplicantDashboard onNavigate={handleNavigate} />
          )}
          {currentPage === 'applicant_wizard' && (
            <PermitWizardPage onNavigate={handleNavigate} />
          )}
          {currentPage === 'applicant_application_detail' && (
            <ApplicationDetailPage applicationId={pageParams?.id || 1} onNavigate={handleNavigate} />
          )}
          {currentPage === 'applicant_permits' && (
            <MyPermitsPage onNavigate={handleNavigate} />
          )}
          {currentPage === 'applicant_help' && (
            <ApplicantHelpPage onNavigate={handleNavigate} />
          )}
          {currentPage === 'gis_editor' && (
            <GisEditorPage onNavigate={handleNavigate} />
          )}
          {currentPage === 'gis_import' && (
            <GisImportPage onNavigate={handleNavigate} />
          )}
          {currentPage === 'normative_norms' && (
            <GeobotanicNormsPage onNavigate={handleNavigate} />
          )}
          {currentPage === 'leskhoz_inbox' && (
            <LeskhozInboxPage onNavigate={handleNavigate} />
          )}
          {currentPage === 'leskhoz_review' && (
            <LeskhozReviewPage onNavigate={handleNavigate} />
          )}
          {currentPage === 'manager_decision' && (
            <ManagerDecisionPage onNavigate={handleNavigate} />
          )}
          {currentPage === 'field_tasks' && (
            <InspectorTasksPage onNavigate={handleNavigate} />
          )}
          {currentPage === 'field_scan' && (
            <InspectorScanPage onNavigate={handleNavigate} />
          )}
          {currentPage === 'field_inspection' && (
            <InspectorInspectionPage permitNo={pageParams?.permitNo || 'RX-2026-0089'} onNavigate={handleNavigate} />
          )}
          {currentPage === 'accountant_reconciliation' && (
            <AccountantReconciliationPage onNavigate={handleNavigate} />
          )}
          {currentPage === 'admin_settings' && (
            <AdminSettingsPage onNavigate={handleNavigate} />
          )}
          {currentPage === 'prosecutor_portal' && (
            <ProsecutorPortalPage onNavigate={handleNavigate} />
          )}
        </CabinetLayout>
      ) : (
        <>
          {currentPage === 'uikit' ? (
            <UIKitShowcase />
          ) : (
            <PublicLayout
              onNavigate={handleNavigate}
              activeNav={currentPage}
              onCheckPermit={(no) => handleNavigate('verify', { query: no })}
            >
              {currentPage === 'home' && (
                <HomePage onNavigate={handleNavigate} />
              )}
              {currentPage === 'services' && (
                <ServicesPage onNavigate={handleNavigate} />
              )}
              {currentPage === 'tariffs' && (
                <TariffsPage />
              )}
              {currentPage === 'documents' && (
                <DocumentsPage onNavigate={handleNavigate} />
              )}
              {currentPage === 'opendata' && (
                <OpenDataPage onNavigate={handleNavigate} />
              )}
              {currentPage === 'faq' && (
                <FaqPage onNavigate={handleNavigate} />
              )}
              {currentPage === 'verify' && (
                <VerifyPage initialQuery={pageParams?.query || 'RX-2026-0089'} />
              )}
              {currentPage === 'auth_login' && (
                <LoginPage
                  onSuccessLogin={() => handleNavigate('applicant_dashboard')}
                  onNavigate={handleNavigate}
                />
              )}
              {currentPage === 'auth_register' && (
                <RegisterPage
                  onSuccessRegister={() => handleNavigate('auth_login')}
                  onNavigate={handleNavigate}
                />
              )}
            </PublicLayout>
          )}
        </>
      )}
    </div>
  );
}

export default App;
