import React, { useState, useEffect, useMemo } from 'react';
import { User, AcademicYear, GradeStatus, RemidiRecord } from '../types';
import { getAcademicYears, getStudentGrades, reloadSpecificData, getStudentRemidiData } from '../services/mockData';
import { showSuccess, showError } from '../utils/swal';

interface StudentDashboardProps {
  user: User;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ user }) => {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [grades, setGrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [activeTab, setActiveTab] = useState<'grades' | 'remidi'>('grades');
  const [remidiData, setRemidiData] = useState<{
    hasFailingGrades: boolean;
    eligibleRecords: RemidiRecord[];
    allRecords: RemidiRecord[];
    isPublished: boolean;
  }>({ hasFailingGrades: false, eligibleRecords: [], allRecords: [], isPublished: false });

  useEffect(() => {
    getAcademicYears().then(data => {
      setYears(data);
      const active = data.find(y => y.isActive);
      if (active) setSelectedYear(active.id);
      else if (data.length > 0) setSelectedYear(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (user.id && selectedYear) {
      setLoading(true);
      getStudentGrades(user.id, selectedYear).then(data => {
        setGrades(data);
        const rData = getStudentRemidiData(user.id, selectedYear);
        setRemidiData(rData);
        setLoading(false);
      });
    }
  }, [user.id, selectedYear]);

  const handleReload = async () => {
    setReloading(true);
    try {
      await reloadSpecificData(['grades', 'class_subjects', 'student_enrollments']);
      if (user.id && selectedYear) {
        const data = await getStudentGrades(user.id, selectedYear);
        setGrades(data);
        const rData = getStudentRemidiData(user.id, selectedYear);
        setRemidiData(rData);
      }
      showSuccess('تم تحديث الدرجات بنجاح');
    } catch (e) {
      showError('فشل تحديث البيانات');
    } finally {
      setReloading(false);
    }
  };

  const selectedYearName = years.find(y => y.id === selectedYear)?.name || '';

  const stats = useMemo(() => {
    const total = grades.length;
    const published = grades.filter(g => g.status === GradeStatus.PUBLISHED);
    const publishedCount = published.length;
    const avg = publishedCount > 0
      ? published.reduce((acc, g) => acc + (g.final_average || 0), 0) / publishedCount
      : 0;
    const passedCount = published.filter(g => g.final_average >= 60).length;
    return { total, publishedCount, avg, passedCount };
  }, [grades]);

  const ScoreBadge = ({ val, status }: { val: number; status: GradeStatus }) => {
    if (status !== GradeStatus.PUBLISHED) {
      return <span className="text-slate-300 text-xs font-bold tabular-nums">—</span>;
    }
    const isLow = val < 60;
    return (
      <span
        className={`inline-flex items-center justify-center min-w-[2.1rem] px-2 py-0.5 rounded-lg text-xs font-extrabold tabular-nums border ${
          isLow
            ? 'bg-red-50 text-red-700 border-red-200/80'
            : 'bg-slate-50 text-slate-800 border-slate-200/80'
        }`}
      >
        {val}
      </span>
    );
  };

  return (
    <div className="space-y-3.5 sm:space-y-5 pb-10">
      {/* Top Header */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
          <div className="w-10 h-10 rounded-xl bg-[#064E3B] text-white flex items-center justify-center font-extrabold text-base shadow-xs shrink-0">
            {user.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">السجل الأكاديمي</h2>
              <span className="text-[10px] font-bold bg-emerald-50 text-[#064E3B] border border-emerald-200/60 px-2 py-0.5 rounded-md tabular-nums">
                {user.id}
              </span>
            </div>
            <p className="text-slate-500 text-xs font-medium mt-0.5 truncate">{user.name}</p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-2.5 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <div className="bg-slate-50 px-3 py-1.5 rounded-xl flex items-center gap-2 border border-slate-200/80 flex-1 sm:flex-initial justify-between sm:justify-start">
            <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">العام:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent text-[#064E3B] font-extrabold text-xs outline-none cursor-pointer tabular-nums"
            >
              {years.map(y => (
                <option key={y.id} value={y.id}>{y.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleReload}
            disabled={reloading}
            className="bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 text-slate-600 hover:text-[#064E3B] hover:border-emerald-300 transition-all disabled:opacity-50 flex items-center gap-1.5 text-xs font-bold whitespace-nowrap shrink-0"
            title="تحديث"
          >
            <svg className={`w-3.5 h-3.5 ${reloading ? 'animate-spin text-[#064E3B]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>تحديث</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 block truncate">إجمالي المقررات</span>
            <span className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5 block tabular-nums">{stats.total}</span>
          </div>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 block truncate">الدرجات المعتمدة</span>
            <span className="text-lg sm:text-xl font-extrabold text-emerald-700 mt-0.5 block tabular-nums">{stats.publishedCount} <span className="text-[11px] text-slate-400 font-semibold">/ {stats.total}</span></span>
          </div>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 block truncate">المعدل العام</span>
            <span className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5 block tabular-nums">
              {stats.publishedCount > 0 ? stats.avg.toFixed(1) : '—'}
            </span>
          </div>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 block truncate">مواد التكميلي</span>
            <span className={`text-lg sm:text-xl font-extrabold mt-0.5 block tabular-nums ${remidiData.eligibleRecords.length > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
              {remidiData.eligibleRecords.length}
            </span>
          </div>
          <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 ${remidiData.eligibleRecords.length > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white p-1 rounded-xl shadow-2xs border border-slate-200/80 flex sm:inline-flex gap-1 w-full sm:w-auto">
        <button
          onClick={() => setActiveTab('grades')}
          className={`flex-1 sm:flex-initial py-2 px-4 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
            activeTab === 'grades'
              ? 'bg-[#064E3B] text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          <span>كشف الدرجات</span>
        </button>

        <button
          onClick={() => setActiveTab('remidi')}
          className={`flex-1 sm:flex-initial py-2 px-4 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 relative whitespace-nowrap ${
            activeTab === 'remidi'
              ? 'bg-[#064E3B] text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          <span>التكميلي</span>
          {remidiData.eligibleRecords.length > 0 && (
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-extrabold tabular-nums ${
              activeTab === 'remidi' ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'
            }`}>
              {remidiData.eligibleRecords.length}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="grid gap-2.5">
          {[1, 2, 3].map(i => <div key={i} className="h-18 bg-white rounded-2xl border border-slate-100 animate-pulse" />)}
        </div>
      ) : activeTab === 'remidi' ? (
        remidiData.eligibleRecords.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 sm:p-10 border border-slate-200/80 shadow-2xs text-center relative overflow-hidden">
            <div className="w-14 h-14 mx-auto mb-3.5 rounded-2xl bg-emerald-50 text-[#064E3B] border border-emerald-200/60 flex items-center justify-center">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mb-1">
              سجلك خالٍ من مواد التكميلي
            </h3>
            <p className="text-slate-500 text-xs max-w-md mx-auto leading-relaxed mb-5">
              أحسنت، لقد استوفيت متطلبات النجاح في جميع المقررات المعتمدة ولا توجد عليك اختبارات تكميلية في هذا العام الدراسي.
            </p>

            <div className="inline-flex flex-wrap items-center justify-center gap-2.5 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200/70 text-[11px] font-bold text-slate-700">
              <span>الرقم الأكاديمي: <strong className="tabular-nums text-slate-900">{user.id}</strong></span>
              <span className="text-slate-300">•</span>
              <span>العام الدراسي: <strong className="tabular-nums text-slate-900">{selectedYearName}</strong></span>
              <span className="text-slate-300">•</span>
              <span className="text-emerald-700">مكتمل النجاح</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
            <div className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
              remidiData.isPublished
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                : 'bg-amber-50/70 border-amber-200 text-amber-950'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  remidiData.isPublished ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                }`}>
                  {remidiData.isPublished ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  )}
                </div>
                <div>
                  <h4 className="font-extrabold">
                    {remidiData.isPublished
                      ? 'تم اعتماد ونشر نتائج التكميلي'
                      : 'نتائج التكميلي قيد الرصد والمراجعة'}
                  </h4>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    {remidiData.isPublished
                      ? 'الحد الأقصى للدرجة المعتمدة عند اجتياز الاختبار التكميلي هو 60 درجة.'
                      : 'ستظهر الدرجات النهائية فور اعتمادها من قِبل الإدارة الأكاديمية.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/70 font-extrabold text-slate-800 flex justify-between items-center text-xs">
                <span>المقررات المسجلة في التكميلي</span>
                <span className="bg-red-50 text-red-700 border border-red-200/60 px-2.5 py-0.5 rounded-lg text-[11px] tabular-nums">
                  {remidiData.eligibleRecords.length} مقرر
                </span>
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead className="bg-slate-50/50 text-slate-500 font-bold border-b border-slate-200/60 text-[11px]">
                    <tr>
                      <th className="py-3 px-4">المقرر</th>
                      <th className="py-3 px-4">الفصل</th>
                      <th className="py-3 px-4 text-center">الفصل الدراسي</th>
                      <th className="py-3 px-4">المحاضر</th>
                      <th className="py-3 px-4 text-center">الدرجة السابقة</th>
                      <th className="py-3 px-4 text-center">درجة التكميلي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {remidiData.eligibleRecords.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{item.subjectName}</div>
                          <div className="text-[10px] text-slate-400 font-mono tabular-nums mt-0.5">{item.subjectCode}</div>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-700">{item.className}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md font-bold text-[10px]">
                            {item.semester === 1 ? 'الأول' : 'الثاني'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{item.lecturerName}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center justify-center min-w-[2.1rem] bg-red-50 text-red-700 border border-red-200/80 px-2 py-0.5 rounded-lg text-xs font-extrabold tabular-nums">
                            {item.initialScore}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {remidiData.isPublished ? (
                            item.remidiScore !== undefined ? (
                              (() => {
                                const finalDisplay = item.remidiScore >= 60 ? 60 : item.remidiScore;
                                const isPassed = item.remidiScore >= 60;
                                return (
                                  <div className="inline-flex items-center gap-2">
                                    <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-0.5 rounded-lg text-xs font-extrabold tabular-nums border ${
                                      isPassed ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                                    }`}>
                                      {finalDisplay}
                                    </span>
                                    <span className={`text-[10px] font-bold ${isPassed ? 'text-emerald-700' : 'text-red-600'}`}>
                                      {isPassed ? 'ناجح' : 'راسب'}
                                    </span>
                                  </div>
                                );
                              })()
                            ) : (
                              <span className="text-slate-400 font-bold text-xs">لم ترصد</span>
                            )
                          ) : (
                            <span className="inline-flex items-center bg-amber-50 text-amber-800 border border-amber-200/80 px-2.5 py-0.5 rounded-lg text-[10px] font-bold">
                              قيد المراجعة
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden divide-y divide-slate-100">
                {remidiData.eligibleRecords.map((item, idx) => (
                  <div key={idx} className="p-3.5 space-y-2.5">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate">{item.subjectName}</h4>
                        <p className="text-[10px] text-slate-400 font-mono tabular-nums mt-0.5 truncate">{item.subjectCode} • {item.className}</p>
                      </div>
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold text-[10px] shrink-0">
                        {item.semester === 1 ? 'الفصل الأول' : 'الفصل الثاني'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-bold">السابقة:</span>
                        <span className="bg-red-50 text-red-700 border border-red-200/70 px-2 py-0.5 rounded-md font-extrabold tabular-nums text-[11px]">{item.initialScore}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-bold">التكميلي:</span>
                        {remidiData.isPublished ? (
                          item.remidiScore !== undefined ? (
                            (() => {
                              const finalDisplay = item.remidiScore >= 60 ? 60 : item.remidiScore;
                              const isPassed = item.remidiScore >= 60;
                              return (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold tabular-nums border ${
                                  isPassed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                                }`}>
                                  {finalDisplay} ({isPassed ? 'ناجح' : 'راسب'})
                                </span>
                              );
                            })()
                          ) : (
                            <span className="text-slate-400 text-[11px] font-bold">لم ترصد</span>
                          )
                        ) : (
                          <span className="bg-amber-50 text-amber-700 border border-amber-200/70 px-2 py-0.5 rounded-md text-[10px] font-bold">
                            قيد المراجعة
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      ) : (
        grades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 bg-white rounded-2xl border border-dashed border-slate-300">
            <svg className="w-11 h-11 text-slate-300 mb-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <p className="text-slate-500 font-bold text-xs sm:text-sm">لا توجد مقررات مسجلة في هذا العام الدراسي</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 overflow-hidden">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200/70 text-[11px]">
                    <th className="py-3 px-4">المقرر الدراسي</th>
                    <th className="py-3 px-4">المحاضر</th>
                    <th className="py-3 px-4 text-center">الفصل الأول</th>
                    <th className="py-3 px-4 text-center">الفصل الثاني</th>
                    <th className="py-3 px-4 text-center bg-slate-50">المعدل النهائي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {grades.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{item.subjectName}</div>
                        <div className="text-[10px] text-slate-400 font-mono tabular-nums mt-0.5">{item.subjectCode}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{item.lecturerName}</td>
                      <td className="py-3 px-4 text-center">
                        <ScoreBadge val={item.sem1_total} status={item.status} />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <ScoreBadge val={item.sem2_total} status={item.status} />
                      </td>
                      <td className="py-3 px-4 text-center bg-slate-50/40">
                        {item.status === GradeStatus.PUBLISHED ? (
                          <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-0.5 rounded-lg text-xs font-extrabold tabular-nums border ${
                            item.final_average < 60
                              ? 'bg-red-50 text-red-700 border-red-200/80'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
                          }`}>
                            {item.final_average.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs font-bold">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-slate-100">
              {grades.map((item, idx) => (
                <div key={idx} className="p-3.5 space-y-2.5">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate">{item.subjectName}</h4>
                      <p className="text-[10px] text-slate-400 font-mono tabular-nums mt-0.5 truncate">{item.subjectCode} • {item.lecturerName}</p>
                    </div>
                    {item.status === GradeStatus.PUBLISHED ? (
                      <span className={`px-2.5 py-0.5 rounded-lg text-xs font-extrabold tabular-nums border shrink-0 ${
                        item.final_average < 60
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}>
                        {item.final_average.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">قيد الرصد</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <div className="bg-slate-50/80 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500">الفصل الأول</span>
                      <ScoreBadge val={item.sem1_total} status={item.status} />
                    </div>
                    <div className="bg-slate-50/80 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500">الفصل الثاني</span>
                      <ScoreBadge val={item.sem2_total} status={item.status} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default StudentDashboard;
