
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

  const getRoleLabel = () => {
    switch(user.role) {
      case Role.LECTURER: return 'المحاضر';
      case Role.STUDENT: return 'الطالب';
      case Role.ADMIN: return 'الإدارة';
      default: return '';
    }
  };

  // Mobile Bottom Nav Categories
  const mobileTabs: { id: NavGroup, label: string, icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'الرئيسية', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> },
    { id: 'master', label: 'البيانات', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
    { id: 'academic', label: 'أكاديمي', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg> },
    { id: 'settings', label: 'إعدادات', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
  ];

  const getActiveGroup = (): NavGroup => {
    const activeItem = navItems.find(i => i.id === activeNavId);
    return activeItem ? activeItem.group : 'dashboard';
  };

  const handleMobileNavClick = (group: NavGroup) => {
      const target = navItems.find(i => i.group === group);
      if (target && onNavClick) onNavClick(target.id);
  };

  const activeGroup = getActiveGroup();

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col md:flex-row font-tajawal text-gray-800">
      
      {/* --- DESKTOP SIDEBAR --- */}
      <aside 
        className={`hidden md:flex flex-col fixed right-0 top-0 bottom-0 z-50 bg-white border-l border-gray-100 transition-all duration-300
        ${sidebarCollapsed ? 'w-16' : 'w-64'}`}
      >
        {/* Toggle Button */}
        <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute top-5 left-[-10px] w-5 h-5 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-400 hover:text-emerald-600 transition-colors z-50 shadow-sm"
        >
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`w-3 h-3 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>

        {/* Header / Logo */}
        <div className={`p-4 flex flex-col items-center mb-2 transition-all ${sidebarCollapsed ? 'px-2' : ''}`}>
          <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-100 p-1.5 mb-2 flex items-center justify-center overflow-hidden">
             <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
          </div>
          {!sidebarCollapsed && (
            <div className="animate-fade-in text-center">
                <h1 className="text-base font-extrabold text-gray-900 tracking-tight leading-tight">نظام الأكاديمية</h1>
                <p className="text-[9px] text-gray-400 font-bold tracking-wide uppercase">STAI Imam Syafi'i</p>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        {navItems.length > 0 && (
            <div className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onNavClick && onNavClick(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative group
                        ${activeNavId === item.id 
                            ? 'bg-[#064E3B] text-white shadow-md shadow-emerald-900/10' 
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
                        title={sidebarCollapsed ? item.label : ''}
                    >
                        <div className={`${activeNavId === item.id ? 'text-emerald-100' : 'text-current'} shrink-0 transition-colors`}>
                            {/* Make icons slightly smaller */}
                            <div className="w-5 h-5 [&>svg]:w-full [&>svg]:h-full">{item.icon}</div>
                        </div>
                        {!sidebarCollapsed && (
                            <span className="font-bold text-xs whitespace-nowrap animate-fade-in">{item.label}</span>
                        )}
                        
                        {/* Tooltip for collapsed */}
                        {sidebarCollapsed && (
                            <div className="absolute right-full mr-3 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl font-bold">
                                {item.label}
                            </div>
                        )}
                    </button>
                ))}
            </div>
        )}

        {/* User Info & Footer */}
        <div className="mt-auto p-3 space-y-2 border-t border-gray-50">
           {!sidebarCollapsed ? (
               <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50/50 border border-gray-100 animate-fade-in">
                    <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-[#064E3B] shadow-sm">
                       {user.name.charAt(0)}
                    </div>
                    <div className="overflow-hidden">
                        <p className="font-bold text-xs text-gray-900 truncate">{user.name}</p>
                        <p className="text-[10px] text-gray-400 font-bold truncate">{getRoleLabel()}</p>
                    </div>
                </div>
           ) : (
               <div className="flex justify-center mb-1">
                   <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-700">
                       {user.name.charAt(0)}
                   </div>
               </div>
           )}

           <div className="flex gap-2">
               <button onClick={onChangePassword} className="flex-1 flex items-center justify-center p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-[#064E3B] transition-all" title="كلمة المرور">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
               </button>
               <button onClick={onLogout} className="flex-1 flex items-center justify-center p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all" title="خروج">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 transform rotate-180"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
               </button>
           </div>
        </div>
      </aside>

      {/* --- MOBILE TOP BAR (Super Compact) --- */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-12 bg-white/95 backdrop-blur-md z-40 flex items-center justify-between px-4 border-b border-gray-100 shadow-sm">
          <div className="flex items-center gap-2">
              <div className="w-6 h-6">
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
              </div>
              <span className="text-[#064E3B] font-extrabold text-sm">STAI Imam Syafi'i</span>
          </div>
          <button onClick={onLogout} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:text-red-500 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
          </button>
      </div>

      {/* --- CONTENT AREA --- */}
      <main 
        className={`flex-1 flex flex-col transition-all duration-300 min-h-screen pt-14 md:pt-0 pb-20 md:pb-0
        ${sidebarCollapsed ? 'md:mr-16' : 'md:mr-64'}`}
      >
        {/* Desktop Top Header (Hidden on Mobile) */}
        {topBarContent && (
             <header className="hidden md:flex items-center justify-between px-6 py-4 bg-transparent">
                 <div>
                    <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">لوحة التحكم</h2>
                    <p className="text-gray-400 text-xs font-bold mt-0.5">مرحباً بك، {user.name}</p>
                 </div>
                 <div className="flex items-center gap-3">
                     {topBarContent}
                 </div>
             </header>
        )}
        
        {/* Children Content */}
        <div className="px-3 md:px-6 pb-6 flex-1 overflow-x-hidden">
           {children}
        </div>
      </main>

      {/* --- MOBILE BOTTOM NAVIGATION (Compact) --- */}
      {user.role === Role.ADMIN ? (
          <nav className="md:hidden fixed bottom-3 left-3 right-3 bg-white/95 backdrop-blur-xl border border-white/20 rounded-2xl z-50 flex justify-between items-center px-4 py-2.5 shadow-[0_4px_20px_rgb(0,0,0,0.06)]">
             {mobileTabs.map(tab => (
                 <button 
                    key={tab.id}
                    onClick={() => handleMobileNavClick(tab.id)}
                    className={`flex flex-col items-center justify-center transition-all ${activeGroup === tab.id ? 'text-[#064E3B]' : 'text-gray-300 hover:text-gray-500'}`}
                 >
                    <div className={`${activeGroup === tab.id ? 'scale-110' : ''} transition-transform`}>{tab.icon}</div>
                    {activeGroup === tab.id && <span className="w-1 h-1 bg-[#064E3B] rounded-full mt-1"></span>}
                 </button>
             ))}
          </nav>
      ) : (
          /* Student/Lecturer Mobile Nav */
          <nav className="md:hidden fixed bottom-3 left-3 right-3 bg-[#064E3B] text-white rounded-2xl shadow-xl z-50 flex justify-between items-center px-6 py-3 backdrop-blur-xl bg-opacity-95">
            <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-white/10 rounded-full p-1.5 flex items-center justify-center">
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                </div>
            </div>
            <div className="h-6 w-[1px] bg-white/10"></div>
            <button onClick={onChangePassword} className="flex flex-col items-center text-emerald-100/70 active:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
            </button>
            <button onClick={onLogout} className="flex flex-col items-center text-red-200/80 active:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
            </button>
        </nav>
      )}

    </div>
  );
};

export default Layout;
