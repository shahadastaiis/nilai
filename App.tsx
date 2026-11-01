import React, { useState, useEffect } from 'react';
import { User, Role, NavItem } from './types';
import Login from './components/Login';
import LecturerDashboard from './components/LecturerDashboard';
import StudentDashboard from './components/StudentDashboard';
import AdminDashboard from './components/AdminDashboard';
import Layout from './components/Layout';
import ChangePasswordModal from './components/ChangePasswordModal';
import { 
  DEFAULT_LOGO_URL, 
  changePassword, 
  fetchInitialData, 
  startRealtimeSync, 
  stopRealtimeSync,
  setSyncUserRole
} from './services/mockData';
import { showSuccess, showError } from './utils/swal';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [logoUrl, setLogoUrl] = useState<string>(DEFAULT_LOGO_URL);
  const [isPasswordModalOpen, setPasswordModalOpen] = useState(false);
  
  // App States
  const [isInitializing, setIsInitializing] = useState(true);
  const [connectionError, setConnectionError] = useState(false);

  // Admin Nav State
  const [activeAdminMenu, setActiveAdminMenu] = useState<string>('students');

  // Initialize Data
  const initializeApp = async () => {
    setIsInitializing(true);
    setConnectionError(false);
    
    const success = await fetchInitialData();
    if (success) {
      startRealtimeSync();
      setIsInitializing(false);
    } else {
      setConnectionError(true);
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    initializeApp();
    return () => stopRealtimeSync();
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setSyncUserRole(loggedInUser.role);
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    setSyncUserRole(null);
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

  // --- Admin Navigation Config ---
  const adminNavItems: NavItem[] = [
    { id: 'students', label: 'الطلاب', group: 'master', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg> },
    { id: 'lecturers', label: 'المحاضرون', group: 'master', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> },
    { id: 'subjects', label: 'المقررات', group: 'master', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg> },
    { id: 'classes', label: 'الفصول', group: 'academic', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> },
    { id: 'remidi', label: 'التكميلي', group: 'academic', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg> },
    { id: 'report', label: 'التقارير', group: 'academic', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
    { id: 'khs', label: 'السجل التراكمي', group: 'academic', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg> },
    { id: 'settings', label: 'الإعدادات', group: 'settings', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
  ];

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#042F24] flex flex-col items-center justify-center text-white space-y-5 font-tajawal" dir="rtl">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-800/40 border border-emerald-600/30 flex items-center justify-center">
            <svg className="animate-spin h-8 w-8 text-emerald-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-base font-bold text-white">جامعة الإمام الشافعي</p>
          <p className="text-xs text-emerald-200/80 font-medium">جاري تحميل البيانات الأكاديمية...</p>
        </div>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-tajawal" dir="rtl">
        <div className="w-16 h-16 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center text-red-600 mb-5">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-xl font-extrabold text-slate-900 mb-2">تعذر الاتصال بالخادم</h2>
        <p className="text-slate-500 mb-6 max-w-sm text-xs leading-relaxed">
          لم نتمكن من جلب البيانات الأكاديمية. يرجى التأكد من اتصال الإنترنت ثم المحاولة مجدداً.
        </p>
        <button 
          onClick={initializeApp}
          className="bg-[#064E3B] hover:bg-emerald-800 text-white font-bold py-2.5 px-6 rounded-xl shadow-sm transition-all flex items-center gap-2 text-xs whitespace-nowrap"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          <span>إعادة المحاولة</span>
        </button>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} logoUrl={logoUrl} />;
  }

  const isAdmin = user.role === Role.ADMIN || user.role === Role.ADMIN_PUTRI;

  return (
    <Layout 
      user={user} 
      onLogout={handleLogout} 
      onChangePassword={() => setPasswordModalOpen(true)}
      logoUrl={logoUrl}
      navItems={isAdmin ? adminNavItems : []}
      activeNavId={activeAdminMenu}
      onNavClick={setActiveAdminMenu}
    >
      {user.role === Role.LECTURER && (
        <LecturerDashboard user={user} />
      )}
      
      {user.role === Role.STUDENT && (
        <StudentDashboard user={user} />
      )}

      {isAdmin && (
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
    </Layout>
  );
};

export default App;
