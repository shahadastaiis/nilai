import React, { useState, useEffect } from 'react';
import { User, Role, NavItem } from './types';
import Login from './components/Login';
import LecturerDashboard from './components/LecturerDashboard';
import StudentDashboard from './components/StudentDashboard';
import AdminDashboard from './components/AdminDashboard';
import Layout from './components/Layout';
import ChangePasswordModal from './components/ChangePasswordModal';
import SheetsConfigModal from './components/SheetsConfigModal';
import { 
  DEFAULT_LOGO_URL, 
  changePassword, 
  fetchInitialData, 
  startRealtimeSync, 
  stopRealtimeSync,
  isOfflineModeActive,
  setOfflineMode
} from './services/mockData';
import { showSuccess, showError } from './utils/swal';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [logoUrl, setLogoUrl] = useState<string>(DEFAULT_LOGO_URL);
  const [isPasswordModalOpen, setPasswordModalOpen] = useState(false);
  const [isSheetsModalOpen, setSheetsModalOpen] = useState(false);
  
  // App States
  const [isInitializing, setIsInitializing] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [showLocalBanner, setShowLocalBanner] = useState(true);

  // Admin Nav State
  const [activeAdminMenu, setActiveAdminMenu] = useState<string>('students');

  // Initialize Data
  const initializeApp = async () => {
    setIsInitializing(true);
    setConnectionError(false);
    
    try {
      const success = await fetchInitialData();
      if (success) {
        startRealtimeSync();
        setIsInitializing(false);
      } else {
        setConnectionError(true);
        setIsInitializing(false);
      }
    } catch (e) {
      console.error("Initialization error:", e);
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    initializeApp();
    return () => stopRealtimeSync();
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    setUser(null);
  };

  const handlePasswordUpdate = async (newPass: string) => {
    if (user) {
      try {
        await changePassword(user.id, newPass);
        showSuccess('تم تغيير كلمة المرور بنجاح');
      } catch (e) {
        showError('فشل تغيير كلمة المرور');
      }
    }
  };

  const handleContinueOffline = () => {
    setOfflineMode(true);
    setConnectionError(false);
    initializeApp();
  };

  // --- Admin Navigation Config ---
  const adminNavItems: NavItem[] = [
    { id: 'students', label: 'الطلاب', group: 'master', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg> },
    { id: 'lecturers', label: 'المحاضرين', group: 'master', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> },
    { id: 'subjects', label: 'المواد', group: 'master', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg> },
    { id: 'classes', label: 'الفصول', group: 'academic', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> },
    { id: 'report', label: 'التقارير', group: 'academic', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
    { id: 'khs', label: 'نتائج (KHS)', group: 'academic', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg> },
    { id: 'settings', label: 'إعدادات', group: 'settings', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
  ];

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-emerald-950 flex flex-col items-center justify-center text-white space-y-4 font-tajawal" dir="rtl">
        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center p-3 mb-2 shadow-2xl backdrop-blur-md">
          <img src={logoUrl} alt="Logo" className="w-full h-full object-contain brightness-0 invert" />
        </div>
        <svg className="animate-spin h-8 w-8 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-sm font-medium text-emerald-200">جاري تهيئة النظام وقاعدة البيانات...</p>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center font-tajawal" dir="rtl">
        <div className="w-20 h-20 bg-amber-100 rounded-3xl flex items-center justify-center text-amber-700 mb-6 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-2xl font-extrabold text-gray-800 mb-2">تنبيه بشأن الاتصال بـ Google Sheets</h2>
        <p className="text-gray-600 mb-4 max-w-lg text-sm leading-relaxed">
          تعذر الاتصال برابط تطبيق Google Apps Script (بسبب قيود الصلاحيات أو انقطاع الاتصال). يمكنك المتابعة مباشرة بوضع قاعدة البيانات المحلية المجهزة ببيانات كلية STAI Imam Syafi'i، أو تعديل الرابط.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md justify-center">
          <button 
            onClick={handleContinueOffline}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 px-6 rounded-2xl shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 text-xs"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>المتابعة بوضع قاعدة البيانات المحلية</span>
          </button>
          
          <button 
            onClick={() => setSheetsModalOpen(true)}
            className="bg-white hover:bg-gray-50 text-gray-700 font-bold py-3 px-6 rounded-2xl border border-gray-200 shadow-sm transition-all flex items-center justify-center gap-2 text-xs"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>إعداد رابط الرابط</span>
          </button>
        </div>

        <SheetsConfigModal 
          isOpen={isSheetsModalOpen} 
          onClose={() => setSheetsModalOpen(false)} 
          onConfigSaved={initializeApp}
        />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Login 
          onLogin={handleLogin} 
          logoUrl={logoUrl} 
          onOpenSheetsConfig={() => setSheetsModalOpen(true)}
        />
        <SheetsConfigModal 
          isOpen={isSheetsModalOpen} 
          onClose={() => setSheetsModalOpen(false)} 
          onConfigSaved={initializeApp}
        />
      </>
    );
  }

  const isAdmin = user.role === Role.ADMIN;
  const isOffline = isOfflineModeActive();

  // Top bar badge
  const connectionBadge = (
    <button
      onClick={() => setSheetsModalOpen(true)}
      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-2 border transition-all ${
        isOffline 
          ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100' 
          : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
      }`}
      title="انقر لتعديل إعدادات الربط بقاعدة البيانات"
    >
      <span className={`w-2 h-2 rounded-full ${isOffline ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></span>
      <span>{isOffline ? 'وضع محلي (Local DB)' : 'Google Sheets متصل'}</span>
    </button>
  );

  return (
    <>
      {/* Informative Local Mode Banner */}
      {isOffline && showLocalBanner && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shadow-sm sticky top-0 z-50 font-tajawal">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="bg-white/20 px-2 py-0.5 rounded-lg text-[10px] shrink-0">تنبيه النظام</span>
            <span className="truncate">يعمل النظام حالياً بوضع قاعدة البيانات المحلية (Local Storage). جميع الوظائف والبيانات تعمل بكامل طاقتها.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 mr-2">
            <button
              onClick={() => setSheetsModalOpen(true)}
              className="bg-white text-amber-900 px-3 py-1 rounded-lg text-[11px] font-bold hover:bg-amber-50 transition-colors"
            >
              إعداد Google Sheets
            </button>
            <button
              onClick={() => setShowLocalBanner(false)}
              className="text-white/80 hover:text-white p-1"
              title="إغلاق التنبيه"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <Layout 
        user={user} 
        onLogout={handleLogout} 
        onChangePassword={() => setPasswordModalOpen(true)}
        logoUrl={logoUrl}
        navItems={isAdmin ? adminNavItems : []}
        activeNavId={activeAdminMenu}
        onNavClick={setActiveAdminMenu}
        topBarContent={connectionBadge}
      >
        {user.role === Role.LECTURER && (
          <LecturerDashboard user={user} />
        )}
        
        {user.role === Role.STUDENT && (
          <StudentDashboard user={user} />
        )}

        {user.role === Role.ADMIN && (
          <AdminDashboard 
            user={user} 
            logoUrl={logoUrl} 
            onUpdateLogo={setLogoUrl} 
            activeMenu={activeAdminMenu} 
            onMenuChange={setActiveAdminMenu}
          />
        )}

        <ChangePasswordModal 
          isOpen={isPasswordModalOpen} 
          onClose={() => setPasswordModalOpen(false)} 
          onSave={handlePasswordUpdate}
        />

        <SheetsConfigModal 
          isOpen={isSheetsModalOpen} 
          onClose={() => setSheetsModalOpen(false)} 
          onConfigSaved={initializeApp}
        />
      </Layout>
    </>
  );
};

export default App;
