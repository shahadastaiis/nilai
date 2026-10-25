import React, { useState } from 'react';
import { login, isOfflineModeActive } from '../services/mockData';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
  logoUrl: string;
  onOpenSheetsConfig?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, logoUrl, onOpenSheetsConfig }) => {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isOffline = isOfflineModeActive();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const user = await login(id, password);
      if (user) {
        onLogin(user);
      } else {
        setError('بيانات الدخول غير صحيحة. يرجى التحقق من الرقم الوظيفي/الأكاديمي وكلمة المرور.');
      }
    } catch (err) {
      setError('حدث خطأ في النظام أثناء تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (quickId: string, quickPass: string) => {
    setId(quickId);
    setPassword(quickPass);
    setError('');
  };

  return (
    <div className="min-h-screen flex items-stretch relative overflow-hidden font-tajawal bg-gray-50" dir="rtl">
        {/* --- BACKGROUND IMAGE SECTION --- */}
        <div className="absolute inset-0 z-0 lg:static lg:w-1/2 lg:flex-shrink-0 relative">
             <img 
                src="https://images.unsplash.com/photo-1544812368-aa6ae3305221?q=80&w=2000&auto=format&fit=crop" 
                alt="Architecture" 
                className="absolute inset-0 w-full h-full object-cover"
             />
             <div className="absolute inset-0 bg-gradient-to-t from-[#064E3B] via-[#064E3B]/80 to-[#064E3B]/40 lg:bg-gradient-to-br lg:from-[#064E3B]/95 lg:to-[#065f46]/90 mix-blend-multiply lg:mix-blend-normal" />
             <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/arabesque.png')] pointer-events-none"></div>

             {/* Content Overlay */}
             <div className="hidden lg:flex relative z-10 flex-col justify-center items-start h-full p-16 xl:p-24 text-white">
                 <div className="mb-8 p-4 bg-white/10 backdrop-blur-md rounded-3xl border border-white/10 shadow-2xl">
                    <img src={logoUrl} alt="Logo" className="w-20 h-20 object-contain drop-shadow-md brightness-0 invert" />
                 </div>
                 <h1 className="text-4xl xl:text-5xl font-extrabold mb-6 leading-tight tracking-tight">
                     التميز الأكاديمي <br/>
                     <span className="text-emerald-200">والريادة المعرفية</span>
                 </h1>
                 <p className="text-base text-emerald-50/80 font-light max-w-lg leading-relaxed">
                     بوابة متكاملة لإدارة الشؤون الأكاديمية والدرجات العلمية بكفاءة عالية لمجتمع STAI Imam Syafi'i.
                 </p>
                 
                 <div className="mt-12 flex gap-4">
                     <div className="flex -space-x-4 space-x-reverse">
                        {[1,2,3].map(i => (
                            <div key={i} className="w-10 h-10 rounded-full border-2 border-[#064E3B] bg-emerald-200/20 backdrop-blur-sm flex items-center justify-center text-xs">
                                <svg className="w-5 h-5 text-white opacity-70" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                            </div>
                        ))}
                     </div>
                     <div className="flex flex-col justify-center text-xs text-emerald-200 font-bold">
                         <span>نظام أكاديمي معتمد لـ</span>
                         <span className="text-white text-sm">كلية STAI Imam Syafi'i</span>
                     </div>
                 </div>
             </div>
        </div>

        {/* --- FORM SECTION --- */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-12 z-10 relative">
            <div className="w-full max-w-[430px] bg-white/95 lg:bg-white backdrop-blur-xl lg:backdrop-blur-none p-8 md:p-10 rounded-[2.5rem] shadow-2xl lg:shadow-none border border-white/50 lg:border-none animate-fade-in-up">
                
                {/* Header */}
                <div className="text-center lg:text-right mb-8">
                    <div className="lg:hidden w-20 h-20 bg-white rounded-2xl p-2 mx-auto mb-6 shadow-lg border border-emerald-50 flex items-center justify-center transform rotate-2">
                         <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-extrabold text-[#064E3B] tracking-tight mb-2">تسجيل الدخول</h2>
                    <p className="text-gray-500 font-medium text-sm">أدخل رقم القيد أو الرقم الوظيفي للمتابعة</p>
                </div>

                {/* Quick Test Logins */}
                <div className="mb-6 bg-emerald-50/60 border border-emerald-100 rounded-2xl p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-extrabold text-emerald-900 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      حسابات تجريبية سريعة:
                    </span>
                    <span className="text-[10px] text-emerald-700 font-medium">(انقر للتعبئة)</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => handleQuickLogin('admin', 'admin')}
                      className="py-1.5 px-2 rounded-xl text-[11px] font-bold bg-white text-emerald-800 shadow-sm border border-emerald-200 hover:bg-emerald-600 hover:text-white transition-all"
                    >
                      مدير النظام
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickLogin('19800101', 'dosen123')}
                      className="py-1.5 px-2 rounded-xl text-[11px] font-bold bg-white text-emerald-800 shadow-sm border border-emerald-200 hover:bg-emerald-600 hover:text-white transition-all"
                    >
                      أستاذ / محاضر
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickLogin('2024001', 'mhs123')}
                      className="py-1.5 px-2 rounded-xl text-[11px] font-bold bg-white text-emerald-800 shadow-sm border border-emerald-200 hover:bg-emerald-600 hover:text-white transition-all"
                    >
                      طالب (أحمد)
                    </button>
                  </div>
                </div>

                <form className="space-y-5" onSubmit={handleSubmit}>
                    {error && (
                        <div className="bg-red-50 border border-red-100 text-red-600 p-3.5 rounded-2xl text-xs font-bold flex items-center gap-3 shadow-sm">
                            <div className="bg-red-100 p-1 rounded-full shrink-0">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            </div>
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="space-y-1.5 group">
                            <label className="text-xs font-bold text-gray-600 mr-1 group-focus-within:text-[#064E3B] transition-colors">
                              رقم القيد / الرقم الوظيفي (NIM / NIDN)
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={id}
                                    onChange={(e) => setId(e.target.value)}
                                    className="w-full pl-4 pr-11 py-3.5 bg-gray-50 border-2 border-transparent rounded-2xl text-gray-900 font-bold text-sm focus:border-[#064E3B]/20 focus:bg-white focus:shadow-md transition-all placeholder-gray-400 outline-none text-left"
                                    placeholder="مثال: admin أو 2024001"
                                    required
                                    dir="ltr"
                                />
                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#064E3B] transition-colors">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5 group">
                            <label className="text-xs font-bold text-gray-600 mr-1 group-focus-within:text-[#064E3B] transition-colors">
                              كلمة المرور
                            </label>
                            <div className="relative">
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-4 pr-11 py-3.5 bg-gray-50 border-2 border-transparent rounded-2xl text-gray-900 font-bold text-sm focus:border-[#064E3B]/20 focus:bg-white focus:shadow-md transition-all placeholder-gray-400 outline-none text-left"
                                    placeholder="••••••••"
                                    required
                                    dir="ltr"
                                />
                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#064E3B] transition-colors">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 px-6 rounded-2xl text-white bg-gradient-to-r from-[#064E3B] to-emerald-800 hover:to-emerald-900 font-extrabold text-sm transition-all shadow-lg shadow-emerald-900/20 hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed transform active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                <span>جاري التحقق...</span>
                            </>
                        ) : (
                            <>
                                <span>دخول للنظام</span>
                                <svg className="w-5 h-5 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                            </>
                        )}
                    </button>
                </form>
                
                {/* Database Mode Status & Config Button */}
                <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 text-gray-500 font-medium">
                        <span className={`w-2 h-2 rounded-full ${isOffline ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                        <span>{isOffline ? 'وضع قاعدة البيانات المحلية' : 'Google Sheets متصل'}</span>
                    </div>
                    {onOpenSheetsConfig && (
                        <button
                            type="button"
                            onClick={onOpenSheetsConfig}
                            className="text-[#064E3B] hover:text-emerald-700 font-bold hover:underline flex items-center gap-1"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>إعداد الربط</span>
                        </button>
                    )}
                </div>

                <div className="mt-4 text-center">
                    <p className="text-[10px] text-gray-400 font-mono">نظام المعلومات الأكاديمي &copy; STAI Imam Syafi'i</p>
                </div>
            </div>
        </div>
    </div>
  );
};

export default Login;
