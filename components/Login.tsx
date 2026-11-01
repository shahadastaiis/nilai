import React, { useState } from 'react';
import { login } from '../services/mockData';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
  logoUrl: string;
}

const Login: React.FC<LoginProps> = ({ onLogin, logoUrl }) => {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const user = await login(id, password);
      if (user) {
        onLogin(user);
      } else {
        setError('بيانات الدخول غير صحيحة. يرجى التأكد من الرقم أو كلمة المرور.');
      }
    } catch (err) {
      setError('حدث خطأ أثناء تسجيل الدخول.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-stretch relative overflow-hidden font-tajawal bg-slate-50" dir="rtl">
      {/* --- ARCHITECTURAL SHOWCASE PANEL --- */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#042F24] via-[#064E3B] to-[#065F46] flex-col justify-between p-16 xl:p-20 text-white overflow-hidden">
        {/* Subtle Geometric Pattern SVG */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.06] pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
          <defs>
            <pattern id="islamic-grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M30 0 L60 30 L30 60 L0 30 Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="30" cy="30" r="12" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#islamic-grid)" />
        </svg>

        {/* Top Institution Mark */}
        <div className="relative z-10 flex items-center gap-4">
          <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 shadow-lg">
            <img src={logoUrl} alt="شعار الجامعة" referrerPolicy="no-referrer" className="w-14 h-14 object-contain brightness-0 invert" />
          </div>
          <div>
            <span className="text-xs font-bold text-emerald-200 block">البوابة الإلكترونية الرسمية</span>
            <h2 className="text-xl font-extrabold tracking-tight text-white">جامعة الإمام الشافعي</h2>
          </div>
        </div>

        {/* Center Editorial Headline */}
        <div className="relative z-10 my-auto max-w-lg space-y-5">
          <h1 className="text-4xl xl:text-5xl font-extrabold leading-tight tracking-tight">
            نظام إدارة الشؤون الأكاديمية والدرجات
          </h1>
          <p className="text-base text-emerald-100/85 font-normal leading-relaxed">
            منصة رقمية متكاملة لرصد الدرجات الفصلية، إدارة الاختبارات التكميلية، وإصدار السجلات الأكاديمية بدقة وموثوقية عالية.
          </p>

          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/10">
            <div>
              <span className="text-xl font-extrabold text-white block">رصد فوري</span>
              <span className="text-xs text-emerald-200/80">للدرجات الفصلية</span>
            </div>
            <div>
              <span className="text-xl font-extrabold text-white block">إدارة التكميلي</span>
              <span className="text-xs text-emerald-200/80">اعتماد ورصد آلي</span>
            </div>
            <div>
              <span className="text-xl font-extrabold text-white block">تقارير دقيقة</span>
              <span className="text-xs text-emerald-200/80">وسجلات تراكمية</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-xs text-emerald-200/70 font-medium flex items-center justify-between">
          <span>جميع الحقوق محفوظة © جامعة الإمام الشافعي</span>
          <span>النظام الأكاديمي الموحد</span>
        </div>
      </div>

      {/* --- FORM SECTION --- */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-10 lg:p-16 z-10 relative">
        <div className="w-full max-w-[420px] bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-slate-200/80">
          
          {/* Header */}
          <div className="text-center lg:text-right mb-8">
            <div className="lg:hidden w-16 h-16 bg-emerald-50 rounded-2xl p-2.5 mx-auto mb-4 border border-emerald-100 flex items-center justify-center">
              <img src={logoUrl} alt="شعار الجامعة" referrerPolicy="no-referrer" className="w-full h-full object-contain" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1.5">تسجيل الدخول</h2>
            <p className="text-slate-500 font-medium text-xs">أدخل الرقم الأكاديمي أو الوظيفي وكلمة المرور للمتابعة</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-xs font-bold flex items-center gap-2.5">
                <svg className="w-4 h-4 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  الرقم الأكاديمي أو الوظيفي
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold text-sm focus:border-[#064E3B] focus:bg-white focus:ring-2 focus:ring-emerald-500/15 transition-all placeholder-slate-400 outline-none text-left font-mono tabular-nums"
                    placeholder="أدخل الرقم"
                    required
                    dir="ltr"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  كلمة المرور
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold text-sm focus:border-[#064E3B] focus:bg-white focus:ring-2 focus:ring-emerald-500/15 transition-all placeholder-slate-400 outline-none text-left font-mono"
                    placeholder="••••••••"
                    required
                    dir="ltr"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#064E3B] transition-colors p-1 rounded-lg focus:outline-none"
                    title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 rounded-xl text-white bg-[#064E3B] hover:bg-emerald-800 font-bold text-sm transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <span>جاري الدخول...</span>
                </>
              ) : (
                <>
                  <span>دخول</span>
                  <svg className="w-4 h-4 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-slate-100 pt-5">
            <p className="text-[11px] text-slate-400 font-bold">جامعة الإمام الشافعي</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
