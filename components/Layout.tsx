import React, { useState } from 'react';
import { User, Role, NavItem, NavGroup } from '../types';

interface LayoutProps {
  user: User;
  children: React.ReactNode;
  onLogout: () => void;
  onChangePassword: () => void;
  logoUrl: string;
  navItems?: NavItem[];
  activeNavId?: string;
  onNavClick?: (id: string) => void;
  topBarContent?: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ 
  user, children, onLogout, onChangePassword, logoUrl, 
  navItems = [], activeNavId, onNavClick, topBarContent 
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getRoleLabel = () => {
    switch(user.role) {
      case Role.LECTURER: return 'عضو هيئة التدريس';
      case Role.STUDENT: return 'طالب';
      case Role.ADMIN: return 'الإدارة العامة';
      case Role.ADMIN_PUTRI: return 'إدارة قسم البنات';
      default: return '';
    }
  };

  // Mobile Bottom Nav Categories
  const mobileTabs: { id: NavGroup, label: string, icon: React.ReactNode }[] = [
    { id: 'master', label: 'البيانات', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
    { id: 'academic', label: 'الأكاديمي', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg> },
    { id: 'settings', label: 'الإعدادات', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
  ];

  const getActiveGroup = (): NavGroup => {
    const activeItem = navItems.find(i => i.id === activeNavId);
    return activeItem ? activeItem.group : 'master';
  };

  const handleMobileNavClick = (group: NavGroup) => {
    const target = navItems.find(i => i.group === group);
    if (target && onNavClick) onNavClick(target.id);
  };

  const activeGroup = getActiveGroup();
  const isAdmin = user.role === Role.ADMIN || user.role === Role.ADMIN_PUTRI;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row font-tajawal text-slate-800" dir="rtl">
      
      {/* --- DESKTOP SIDEBAR (lg+) --- */}
      <aside 
        className={`hidden lg:flex flex-col fixed right-0 top-0 bottom-0 z-40 bg-white border-l border-slate-200/80 transition-all duration-200
        ${sidebarCollapsed ? 'w-20' : 'w-60'}`}
      >
        {/* Toggle Button */}
        <button 
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute top-6 left-[-12px] w-6 h-6 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 hover:text-[#064E3B] hover:border-emerald-300 transition-colors z-50 shadow-sm"
          title={sidebarCollapsed ? 'توسيع القائمة' : 'طي القائمة'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`w-3 h-3 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        {/* Brand Header */}
        <div className={`px-4 py-4 flex items-center gap-3 border-b border-slate-100 ${sidebarCollapsed ? 'justify-center px-2' : ''}`}>
          <div className="w-10 h-10 bg-emerald-50/60 rounded-xl border border-emerald-100 p-1.5 flex items-center justify-center shrink-0">
            <img src={logoUrl} alt="شعار الجامعة" referrerPolicy="no-referrer" className="w-full h-full object-contain" />
          </div>
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <h1 className="text-sm font-extrabold text-slate-900 tracking-tight leading-snug truncate">النظام الأكاديمي</h1>
              <p className="text-[11px] text-emerald-700 font-bold truncate">جامعة الإمام الشافعي</p>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        {navItems.length > 0 ? (
          <div className="flex-1 overflow-y-auto px-3 py-3.5 space-y-1 custom-scrollbar">
            {navItems.map((item, idx) => {
              const prevGroup = idx > 0 ? navItems[idx - 1].group : null;
              const showGroupHeader = !sidebarCollapsed && item.group !== prevGroup;
              const groupTitle = item.group === 'master' ? 'البيانات الأساسية' : item.group === 'academic' ? 'الشؤون الأكاديمية' : 'النظام';

              return (
                <React.Fragment key={item.id}>
                  {showGroupHeader && (
                    <div className={`px-3 pt-3 pb-1 text-[10px] font-bold text-slate-400 ${idx === 0 ? 'pt-0' : ''}`}>
                      {groupTitle}
                    </div>
                  )}
                  <button
                    onClick={() => onNavClick && onNavClick(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative group whitespace-nowrap
                    ${sidebarCollapsed ? 'justify-center' : ''}
                    ${activeNavId === item.id 
                        ? 'bg-[#064E3B] text-white shadow-sm' 
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'}`}
                    title={sidebarCollapsed ? item.label : ''}
                  >
                    <div className={`${activeNavId === item.id ? 'text-emerald-200' : 'text-slate-400 group-hover:text-slate-700'} shrink-0 transition-colors`}>
                      <div className="w-5 h-5 [&>svg]:w-full [&>svg]:h-full">{item.icon}</div>
                    </div>
                    {!sidebarCollapsed && (
                      <span className="font-bold text-xs truncate">{item.label}</span>
                    )}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          <div className="flex-1 px-3 py-5">
            {!sidebarCollapsed && (
              <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100 text-xs space-y-1">
                <p className="font-bold text-[#064E3B]">{getRoleLabel()}</p>
                <p className="text-slate-500 text-[11px] leading-relaxed">البوابة الأكاديمية الإلكترونية لمتابعة المقررات والدرجات.</p>
              </div>
            )}
          </div>
        )}

        {/* User Info & Footer */}
        <div className="mt-auto p-3 space-y-2 border-t border-slate-100 bg-slate-50/40">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white border border-slate-200/70">
              <div className="w-8 h-8 rounded-lg bg-[#064E3B] text-white flex items-center justify-center text-xs font-bold shrink-0">
                {user.name.charAt(0)}
              </div>
              <div className="overflow-hidden flex-1">
                <p className="font-bold text-xs text-slate-900 truncate">{user.name}</p>
                <p className="text-[10px] text-emerald-700 font-bold truncate">{getRoleLabel()}</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-9 h-9 rounded-lg bg-[#064E3B] text-white flex items-center justify-center text-xs font-bold">
                {user.name.charAt(0)}
              </div>
            </div>
          )}

          <div className="flex gap-1.5">
            <button
              onClick={onChangePassword}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-white border border-slate-200/80 text-slate-600 hover:bg-emerald-50 hover:text-[#064E3B] hover:border-emerald-200 transition-colors text-[11px] font-bold whitespace-nowrap"
              title="تغيير كلمة المرور"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              {!sidebarCollapsed && <span>كلمة المرور</span>}
            </button>
            <button
              onClick={onLogout}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-white border border-slate-200/80 text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors text-[11px] font-bold whitespace-nowrap"
              title="تسجيل الخروج"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 transform rotate-180 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              {!sidebarCollapsed && <span>خروج</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* --- MOBILE & TABLET TOP BAR (< lg) --- */}
      <header className="lg:hidden sticky top-0 left-0 right-0 h-13 bg-white/95 backdrop-blur-md z-40 flex items-center justify-between px-3.5 sm:px-5 border-b border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          {navItems.length > 0 && (
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-[#064E3B] transition-colors shrink-0"
              aria-label="القائمة"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          <div className="w-7 h-7 rounded-lg bg-emerald-50 p-1 border border-emerald-100 shrink-0">
            <img src={logoUrl} alt="شعار الجامعة" referrerPolicy="no-referrer" className="w-full h-full object-contain" />
          </div>
          <div className="truncate">
            <span className="text-[#064E3B] font-extrabold text-xs block leading-tight truncate">جامعة الإمام الشافعي</span>
            <span className="text-[10px] text-slate-400 font-bold block leading-tight truncate">{user.name} • {getRoleLabel()}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onChangePassword}
            className="h-8 px-2.5 flex items-center justify-center gap-1 rounded-lg bg-slate-100 text-slate-600 hover:text-[#064E3B] transition-colors text-[11px] font-bold"
            title="كلمة المرور"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
            <span className="hidden sm:inline">كلمة المرور</span>
          </button>
          <button
            onClick={onLogout}
            className="h-8 px-2.5 flex items-center justify-center gap-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-[11px] font-bold"
            title="خروج"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
            <span className="hidden sm:inline">خروج</span>
          </button>
        </div>
      </header>

      {/* --- MOBILE & TABLET SLIDE-OVER DRAWER (< lg) --- */}
      {mobileMenuOpen && navItems.length > 0 && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col z-10">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 p-1 border border-emerald-100">
                  <img src={logoUrl} alt="شعار الجامعة" referrerPolicy="no-referrer" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h2 className="text-xs font-extrabold text-slate-900">النظام الأكاديمي</h2>
                  <p className="text-[10px] text-emerald-700 font-bold">{getRoleLabel()}</p>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {navItems.map((item, idx) => {
                const prevGroup = idx > 0 ? navItems[idx - 1].group : null;
                const showGroupHeader = item.group !== prevGroup;
                const groupTitle = item.group === 'master' ? 'البيانات الأساسية' : item.group === 'academic' ? 'الشؤون الأكاديمية' : 'النظام';

                return (
                  <React.Fragment key={item.id}>
                    {showGroupHeader && (
                      <div className={`px-3 pt-2.5 pb-1 text-[10px] font-bold text-slate-400 ${idx === 0 ? 'pt-0' : ''}`}>
                        {groupTitle}
                      </div>
                    )}
                    <button
                      onClick={() => {
                        if (onNavClick) onNavClick(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-xs font-bold ${
                        activeNavId === item.id
                          ? 'bg-[#064E3B] text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="w-4 h-4 shrink-0 [&>svg]:w-full [&>svg]:h-full">{item.icon}</div>
                      <span>{item.label}</span>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>

            <div className="p-3 border-t border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-2.5 px-2 py-1.5">
                <div className="w-7 h-7 rounded-lg bg-[#064E3B] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {user.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 truncate">{user.name}</p>
                  <p className="text-[10px] text-slate-500 font-mono tabular-nums truncate">{user.id}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- CONTENT AREA --- */}
      <main 
        className={`flex-1 flex flex-col transition-all duration-200 min-h-[calc(100vh-3.25rem)] lg:min-h-screen pb-20 lg:pb-6
        ${sidebarCollapsed ? 'lg:mr-20' : 'lg:mr-60'}`}
      >
        {topBarContent && (
          <header className="hidden lg:flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200/80">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">لوحة التحكم</h2>
              <p className="text-slate-400 text-xs font-bold mt-0.5">مرحباً بك، {user.name}</p>
            </div>
            <div className="flex items-center gap-3">
              {topBarContent}
            </div>
          </header>
        )}
        
        <div className="px-3 sm:px-5 lg:px-7 py-3.5 sm:py-5 flex-1 overflow-x-hidden max-w-[1440px] w-full mx-auto">
          {children}
        </div>
      </main>

      {/* --- MOBILE & TABLET BOTTOM NAVIGATION --- */}
      {isAdmin && (
        <nav className="lg:hidden fixed bottom-2.5 left-3 right-3 max-w-md mx-auto bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-2xl z-40 flex justify-around items-center p-1.5 shadow-lg">
          {mobileTabs.map(tab => (
            <button 
              key={tab.id}
              onClick={() => handleMobileNavClick(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap ${
                activeGroup === tab.id 
                  ? 'bg-[#064E3B] text-white shadow-2xs' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
};

export default Layout;
