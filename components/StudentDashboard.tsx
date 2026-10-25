
import React, { useState, useEffect, useRef } from 'react';
import { User, StudentGradeView, AcademicYear, GradeStatus } from '../types';
import { getAcademicYears, getStudentGrades, reloadSpecificData, generatePdf } from '../services/mockData';
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
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAcademicYears().then(data => {
        setYears(data);
        const active = data.find(y => y.isActive);
        if (active) setSelectedYear(active.id);
        else if (data.length > 0) setSelectedYear(data[0].id);
    });
  }, []);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
              setDropdownOpen(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (user.id && selectedYear) {
      setLoading(true);
      getStudentGrades(user.id, selectedYear).then(data => {
        setGrades(data);
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
        }
        showSuccess('تم تحديث الدرجات بنجاح');
    } catch (e) {
        showError('فشل تحديث البيانات');
    } finally {
        setReloading(false);
    }
  };

  const handleDownloadPdf = async (type: 'DEFAULT' | 'SEM1' | 'SEM2' | 'YEARLY') => {
      if (type !== 'DEFAULT' && !selectedYear) {
          showError('يرجى اختيار السنة الدراسية أولاً من القائمة');
          return;
      }

      setDownloadingPdf(true);
      setDropdownOpen(false); // Close menu
      
      try {
          const { base64, filename } = await generatePdf(user.id, type, selectedYear);
          const link = document.createElement('a');
          link.href = `data:application/pdf;base64,${base64}`;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          showSuccess('تم تحميل KHS بنجاح');
      } catch (e: any) {
          console.error("PDF Error:", e);
          let msg = e.message || 'فشل إنشاء ملف PDF.';
          if (msg.includes("DriveApp") || msg.includes("permission") || msg.includes("izin")) {
             msg = "خطأ تصاريح (Google Permissions): يجب على المسؤول تحديث Script Editor.";
          }
          showError(msg);
      } finally {
          setDownloadingPdf(false);
      }
  };

  const ScoreBadge = ({ val, status }: { val: number, status: GradeStatus }) => {
     if (status !== GradeStatus.PUBLISHED) {
         return <span className="text-gray-300 text-xs font-bold">-</span>;
     }
     const isLow = val < 60;
     return (
        <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-bold ${isLow ? 'bg-red-50 text-red-600 border border-red-100' : 'text-gray-800 bg-gray-50 border border-gray-100'}`}>
           {isLow && <span className="mr-1">⚠️</span>}
           {val}
        </span>
     )
  }

  return (
    <div className="space-y-4 md:space-y-6 pb-20">
       {/* Header */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3 bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-lg md:text-2xl font-extrabold text-[#064E3B] tracking-tight">سجل النتائج</h2>
          <p className="text-gray-500 mt-1 text-[10px] md:text-xs font-medium">كشف درجات الطالب: <span className="text-gray-900 font-bold">{user.name}</span></p>
        </div>
        
        <div className="flex items-center gap-2 self-end md:self-auto relative z-20">
             
             {/* PDF Dropdown Button */}
             <div className="relative" ref={dropdownRef}>
                <button 
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    disabled={downloadingPdf}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all disabled:opacity-70"
                >
                    {downloadingPdf ? (
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    )}
                    <span>تحميل KHS</span>
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && !downloadingPdf && (
                    <div className="absolute left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-30 animate-fade-in-up origin-top-left">
                        <div className="p-2 space-y-1">
                            <button onClick={() => handleDownloadPdf('DEFAULT')} className="w-full text-right px-3 py-2 text-xs font-bold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-colors flex items-center justify-between group">
                                <span>KHS (كل البيانات)</span>
                                <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded group-hover:bg-emerald-100">تراكمي</span>
                            </button>
                            <div className="h-px bg-gray-100 my-1"></div>
                            <button onClick={() => handleDownloadPdf('SEM1')} className="w-full text-right px-3 py-2 text-xs font-bold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-colors flex items-center justify-between">
                                <span>KHS الفصل الأول</span>
                                <span className="text-[10px] text-gray-400 font-mono">{selectedYear ? years.find(y => y.id === selectedYear)?.name : '-'}</span>
                            </button>
                            <button onClick={() => handleDownloadPdf('SEM2')} className="w-full text-right px-3 py-2 text-xs font-bold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-colors flex items-center justify-between">
                                <span>KHS الفصل الثاني</span>
                                <span className="text-[10px] text-gray-400 font-mono">{selectedYear ? years.find(y => y.id === selectedYear)?.name : '-'}</span>
                            </button>
                            <div className="h-px bg-gray-100 my-1"></div>
                            <button onClick={() => handleDownloadPdf('YEARLY')} className="w-full text-right px-3 py-2 text-xs font-bold text-emerald-800 bg-emerald-50/50 hover:bg-emerald-100 hover:text-emerald-900 rounded-lg transition-colors flex items-center justify-between">
                                <span>KHS سنوي (شامل)</span>
                                <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            </button>
                        </div>
                    </div>
                )}
             </div>

             {/* Reload Button */}
             <button 
                onClick={handleReload}
                disabled={reloading}
                className="bg-white p-1.5 md:p-2 rounded-xl shadow-sm border border-gray-200 text-gray-500 hover:text-[#064E3B] hover:border-[#064E3B] transition-all disabled:opacity-50"
                title="تحديث البيانات"
            >
                <svg className={`w-4 h-4 ${reloading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
            </button>

            <div className="bg-gray-50 p-1 rounded-xl flex items-center border border-gray-200">
                <span className="text-[10px] font-bold text-gray-400 px-2">العام الدراسي:</span>
                <select 
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="bg-transparent text-[#064E3B] font-bold text-[10px] md:text-xs outline-none py-0.5 px-1 cursor-pointer"
                >
                    {years.map(y => (
                        <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                </select>
            </div>
        </div>
      </div>

      {loading ? (
           <div className="grid gap-3">
               {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
           </div>
      ) : grades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
                <div className="text-gray-200 mb-3">
                    <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <p className="text-gray-400 font-bold text-sm">لا توجد مواد دراسية مسجلة لهذا الفصل</p>
            </div>
      ) : (
            <>
            {/* DESKTOP TABLE */}
            <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-xs md:text-sm text-right">
                    <thead className="bg-gray-50 text-gray-500 font-bold">
                        <tr>
                            <th className="px-5 py-4">المقرر الدراسي</th>
                            <th className="px-5 py-4">عضو هيئة التدريس</th>
                            <th className="px-4 py-4 text-center">درجة ف1</th>
                            <th className="px-4 py-4 text-center">درجة ف2</th>
                            <th className="px-4 py-4 text-center bg-emerald-50 text-emerald-800">المعدل النهائي</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {grades.map((grade, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/80 transition-colors group">
                                <td className="px-5 py-4">
                                    <div className="font-bold text-gray-900 text-sm mb-0.5">{grade.subjectName}</div>
                                    <div className="text-[10px] text-gray-400 font-mono flex items-center gap-2">
                                        <span className="text-emerald-600 font-bold">{grade.sks} وحدات</span>
                                    </div>
                                </td>
                                <td className="px-5 py-4 text-gray-600 font-medium text-xs">{grade.lecturerName}</td>
                                <td className="px-4 py-4 text-center"><ScoreBadge val={grade.sem1_total} status={grade.status} /></td>
                                <td className="px-4 py-4 text-center"><ScoreBadge val={grade.sem2_total} status={grade.status} /></td>
                                <td className="px-4 py-4 text-center bg-emerald-50/20 group-hover:bg-emerald-50/40 transition-colors border-l border-r border-gray-100">
                                    {grade.status === GradeStatus.PUBLISHED ? (
                                        <span className={`text-lg font-extrabold ${grade.final_average < 60 ? 'text-red-500' : 'text-emerald-700'}`}>
                                            {grade.final_average.toFixed(1)}
                                        </span>
                                    ) : (
                                        <span className="text-gray-300 text-lg font-bold">-</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* MOBILE CARD VIEW */}
            <div className="md:hidden space-y-2">
                {grades.map((grade, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                        <div className="flex justify-between items-start mb-2 pb-2 border-b border-gray-50">
                            <div>
                                <h3 className="font-bold text-gray-900 text-xs leading-snug mb-0.5">{grade.subjectName}</h3>
                                <p className="text-[9px] text-gray-400">{grade.lecturerName}</p>
                            </div>
                            <div className={`flex flex-col items-center justify-center w-10 h-10 rounded-lg ${grade.status === GradeStatus.PUBLISHED ? (grade.final_average < 60 ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-[#064E3B] text-white shadow-lg shadow-emerald-900/20') : 'bg-gray-100 text-gray-400'}`}>
                                <span className="text-[7px] opacity-80 font-medium mb-0.5">المعدل</span>
                                <span className="font-extrabold text-xs">
                                    {grade.status === GradeStatus.PUBLISHED ? grade.final_average.toFixed(0) : '-'}
                                </span>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-gray-50 rounded-lg p-1.5 text-center border border-gray-100">
                                <span className="text-[9px] font-bold text-gray-400 block mb-0.5">فصل 1</span>
                                <ScoreBadge val={grade.sem1_total} status={grade.status} />
                            </div>
                            <div className="bg-gray-50 rounded-lg p-1.5 text-center border border-gray-100">
                                <span className="text-[9px] font-bold text-gray-400 block mb-0.5">فصل 2</span>
                                <ScoreBadge val={grade.sem2_total} status={grade.status} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            </>
      )}
    </div>
  );
};

export default StudentDashboard;
