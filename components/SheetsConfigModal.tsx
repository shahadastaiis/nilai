import React, { useState } from 'react';
import { getApiUrl, setApiUrl, testApiUrl, resetToDefaultData, isOfflineModeActive, setOfflineMode } from '../services/mockData';
import { showSuccess, showError, confirmAction } from '../utils/swal';

interface SheetsConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: () => void;
}

const SheetsConfigModal: React.FC<SheetsConfigModalProps> = ({ isOpen, onClose, onConfigSaved }) => {
  const [url, setUrlState] = useState(getApiUrl());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const isOffline = isOfflineModeActive();

  if (!isOpen) return null;

  const handleTest = async () => {
    if (!url.trim()) {
      setTestResult({ success: false, message: 'يرجى إدخال رابط صالح أولاً' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testApiUrl(url.trim());
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'فشل الاتصال بالرابط المحدد'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    try {
      setApiUrl(url.trim());
      setOfflineMode(false);
      showSuccess('تم حفظ الرابط ومحاولة المزامنة بنجاح');
      if (onConfigSaved) onConfigSaved();
      onClose();
    } catch (e: any) {
      showError('فشل حفظ الإعدادات');
    }
  };

  const handleSwitchToOffline = () => {
    setOfflineMode(true);
    showSuccess('تم التحويل إلى وضع قاعدة البيانات المحلية');
    if (onConfigSaved) onConfigSaved();
    onClose();
  };

  const handleResetData = async () => {
    const ok = await confirmAction(
      'إعادة تعيين البيانات الافتراضية؟',
      'سيتم استعادة البيانات التجريبية الشاملة لـ STAI Imam Syafi\'i (الطلاب، المحاضرين، المواد، والدرجات).',
      'نعم، استعادة البيانات',
      false
    );
    if (ok) {
      resetToDefaultData();
      showSuccess('تمت استعادة البيانات الافتراضية بنجاح');
      if (onConfigSaved) onConfigSaved();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-tajawal">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-extrabold text-gray-900">إعدادات الاتصال بقاعدة البيانات</h3>
              <p className="text-xs text-gray-500">Google Sheets / Google Apps Script</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Current Status Badge */}
        <div className="mt-4 p-3 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between text-xs">
          <span className="text-gray-500 font-medium">الوضع الحالي:</span>
          {isOffline ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              قاعدة بيانات محلية (Local DB)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              متصل بـ Google Sheets
            </span>
          )}
        </div>

        {/* Input Form */}
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-bold text-gray-700">رابط تطبيق Google Apps Script (Web App URL)</label>
          <input
            type="text"
            dir="ltr"
            value={url}
            onChange={(e) => setUrlState(e.target.value)}
            placeholder="https://script.google.com/macros/s/.../exec"
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-800 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
          />

          <div className="flex gap-2">
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {testing ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  <span>جاري الفحص...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>فحص الاتصال</span>
                </>
              )}
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-900/10"
            >
              حفظ وتطبيق
            </button>
          </div>

          {/* Test feedback */}
          {testResult && (
            <div className={`p-3 rounded-xl text-xs font-bold flex items-start gap-2 ${testResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              <div className="shrink-0 mt-0.5">
                {testResult.success ? (
                  <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <p className="leading-relaxed">{testResult.message}</p>
            </div>
          )}
        </div>

        {/* Deployment Instructions Box */}
        <div className="mt-5 p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs space-y-2">
          <div className="font-extrabold flex items-center gap-1.5 text-amber-800">
            <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>شروط صحة إعداد Google Apps Script:</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed pr-1 text-amber-950 font-medium">
            <li>في محرر Apps Script اضغط على زر <strong className="font-bold">نشر (Deploy)</strong> &gt; <strong className="font-bold">نشر جديد (New deployment)</strong>.</li>
            <li>اختر نوع <strong className="font-bold">تطبيق ويب (Web app)</strong>.</li>
            <li>اضبط <strong className="font-bold">التنفيذ بصفتي (Execute as)</strong> على: <strong className="font-bold">حسابي (Me)</strong>.</li>
            <li><span className="text-red-700 font-bold underline">شرط حاسم:</span> اضبط <strong className="font-bold">من يملك حق الوصول (Who has access)</strong> على: <strong className="font-bold">أي شخص (Anyone)</strong> وليس Only myself!</li>
            <li>انسخ رابط الويب المنشور وألصقه أعلاه.</li>
          </ol>
        </div>

        {/* Offline / Reset Actions */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleSwitchToOffline}
            className="flex-1 py-2.5 px-3 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-xl border border-gray-200 transition-colors"
          >
            تفعيل الوضع المحلي (Local DB)
          </button>
          <button
            onClick={handleResetData}
            className="flex-1 py-2.5 px-3 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl border border-red-200 transition-colors"
          >
            إعادة تعيين البيانات الافتراضية
          </button>
        </div>
      </div>
    </div>
  );
};

export default SheetsConfigModal;
