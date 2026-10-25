
import React from 'react';
import { User, Role } from '../types';

interface NavbarProps {
  user: User | null;
  onLogout: () => void;
  onChangePassword: () => void;
  logoUrl: string;
}

const Navbar: React.FC<NavbarProps> = ({ user, onLogout, onChangePassword, logoUrl }) => {
  const getRoleName = (role: Role) => {
    switch(role) {
      case Role.LECTURER: return 'عضو هيئة التدريس';
      case Role.STUDENT: return 'طالب';
      case Role.ADMIN: return 'مدير النظام';
      default: return '';
    }
  };

  return (
    <nav className="bg-[#064E3B] text-white shadow-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center gap-4">
             {/* Logo Icon */}
            <div className="bg-white p-1.5 rounded-2xl text-[#064E3B] w-12 h-12 flex items-center justify-center overflow-hidden shadow-lg shadow-black/10">
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight font-tajawal">نظام المعلومات الأكاديمي</h1>
              <p className="text-xs text-emerald-200 opacity-90 font-light">STAI Imam Syafi'i</p>
            </div>
          </div>
          
          {user && (
            <div className="flex items-center gap-6">
              <div className="hidden md:block text-left">
                <p className="font-bold text-sm">{user.name}</p>
                <p className="text-emerald-300 text-xs font-medium">
                    {getRoleName(user.role)}
                </p>
              </div>
              
              <div className="flex items-center gap-3 border-r border-emerald-600/50 pr-6 mr-2">
                <button
                    onClick={onChangePassword}
                    className="p-2.5 rounded-xl bg-emerald-800/40 hover:bg-emerald-800 text-emerald-100 hover:text-white transition-all backdrop-blur-sm"
                    title="تغيير كلمة المرور"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                </button>

                <button
                    onClick={onLogout}
                    className="bg-white text-[#064E3B] hover:bg-emerald-50 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2 shadow-sm"
                >
                    <span>خروج</span>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 transform rotate-180">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                    </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
