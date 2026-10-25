
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, SubjectView, GradeRecord, AcademicYear, GradeStatus, GradeInputType } from '../types';
import { getLecturerSubjects, getClassStudents, getAcademicYears, saveGrades, updateSubjectStatus, subscribeToData, reloadSpecificData } from '../services/mockData';
import { showSuccess, showError, confirmAction } from '../utils/swal';

interface LecturerDashboardProps {
  user: User;
}

type TabType = 'sem1' | 'sem2' | 'recap';

const LecturerDashboard: React.FC<LecturerDashboardProps> = ({ user }) => {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [currentYearConfig, setCurrentYearConfig] = useState<AcademicYear | undefined>(undefined);
  const [subjects, setSubjects] = useState<SubjectView[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<SubjectView | null>(null);
  
  const [studentsData, setStudentsData] = useState<{ student: User, grade: GradeRecord }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<TabType>('sem1');

  // --- Realtime Loading Wrapper ---
  const loadMetadata = async () => {
    const data = await getAcademicYears();
    setYears(data);
    if (!selectedYear) {
        const active = data.find(y => y.isActive);
        if (active) setSelectedYear(active.id);
        else if (data.length > 0) setSelectedYear(data[0].id);
    }
    
    // Refresh Current Year Config explicitly to catch toggle updates immediately
    if (selectedYear) {
         const config = data.find(y => y.id === selectedYear);
         setCurrentYearConfig(config);
         
         // If subjects are visible, refresh them too (in case status changed)
         if (user.id) {
            const subs = await getLecturerSubjects(user.id, selectedYear);
            setSubjects(subs);
            
            // If inside a subject, refresh its internal data if needed (unlikely for status but good for consistency)
            if (selectedSubject) {
                const updatedSubject = subs.find(s => s.id === selectedSubject.id);
                if (updatedSubject && updatedSubject.status !== selectedSubject.status) {
                    setSelectedSubject(updatedSubject);
                }
            }
         }
    }
  };

  useEffect(() => {
    loadMetadata();

    // Subscribe to Realtime Updates (e.g. Admin toggles semester lock)
    const unsubscribe = subscribeToData(() => {
        loadMetadata();
    });
    return () => unsubscribe();
  }, [selectedYear]); 

  useEffect(() => {
    // Also update config when years array updates via realtime
    const config = years.find(y => y.id === selectedYear);
    setCurrentYearConfig(config);
  }, [selectedYear, years]);

  useEffect(() => {
    setSelectedSubject(null);
    setActiveTab('sem1'); 
  }, [user.id, selectedYear]);

  useEffect(() => {
    if (selectedSubject) {
      setLoading(true);
      getClassStudents(selectedSubject.id).then(data => {
        setStudentsData(data);
        setLoading(false);
      });
    }
  }, [selectedSubject]);

  const handleReload = async () => {
      setReloading(true);
      try {
          // Lecturer only needs classes, subjects assignments, enrollments (for student lists), and grades
          await reloadSpecificData(['class_subjects', 'student_enrollments', 'grades', 'classes']);
          // After reloading data, UI updates via notifyListeners -> loadMetadata
          showSuccess('تم تحديث البيانات بنجاح');
      } catch (e) {
          showError('فشل تحديث البيانات');
      } finally {
          setReloading(false);
      }
  };

  const handleGradeChange = (studentId: string, field: keyof GradeRecord, value: any) => {
    // SECURITY: Ensure we respect the Admin's Semester Lock
    const isSem1 = field.toString().includes('sem1');
    const isSem2 = field.toString().includes('sem2');

    if (isSem1 && !currentYearConfig?.isSem1Active) {
        showError('الفصل الدراسي الأول مغلق من قبل الإدارة.');
        return;
    }
    if (isSem2 && !currentYearConfig?.isSem2Active) {
        showError('الفصل الدراسي الثاني مغلق من قبل الإدارة.');
        return;
    }

    setStudentsData(prev => prev.map(item => {
      if (item.student.id === studentId) {
        return {
          ...item,
          grade: { ...item.grade, [field]: value }
        };
      }
      return item;
    }));
  };

  // Determine current global input mode based on the first student
  const currentTabMode = useMemo(() => {
      if (studentsData.length === 0) return 'COMPONENT';
      const first = studentsData[0];
      return activeTab === 'sem1' ? (first.grade.sem1_input_type || 'COMPONENT') : (first.grade.sem2_input_type || 'COMPONENT');
  }, [studentsData, activeTab]);

  const handleGlobalToggle = async () => {
      const sem = activeTab as 'sem1' | 'sem2';
      
      // SECURITY CHECK
      if (sem === 'sem1' && !currentYearConfig?.isSem1Active) { showError('الفصل الدراسي الأول مغلق.'); return; }
      if (sem === 'sem2' && !currentYearConfig?.isSem2Active) { showError('الفصل الدراسي الثاني مغلق.'); return; }

      const newMethod: GradeInputType = currentTabMode === 'DIRECT' ? 'COMPONENT' : 'DIRECT';
      
      const confirmed = await confirmAction(
          'تغيير طريقة الإدخال للجميع',
          `هل أنت متأكد من تغيير طريقة الإدخال إلى ${newMethod === 'DIRECT' ? 'الدرجة النهائية (0-100)' : 'التفصيلي (نصفي + نهائي)'} لجميع الطلاب؟`
      );
      
      if (!confirmed) return;

      setStudentsData(prev => prev.map(item => {
          let newUts = sem === 'sem1' ? item.grade.sem1_uts : item.grade.sem2_uts;
          let newUas = sem === 'sem1' ? item.grade.sem1_uas : item.grade.sem2_uas;

          if (newMethod === 'DIRECT') {
              // Switching TO Direct: Combine into UAS
              newUas = newUts + newUas;
              newUts = 0;
              if (newUas > 100) newUas = 100;
          }
          // If Switching TO Component:
          // Keep values as is (UAS has Total, UTS is 0). User can adjust manually.
          
          const updates: any = {};
          if (sem === 'sem1') {
              updates.sem1_input_type = newMethod;
              updates.sem1_uts = newUts;
              updates.sem1_uas = newUas;
          } else {
              updates.sem2_input_type = newMethod;
              updates.sem2_uts = newUts;
              updates.sem2_uas = newUas;
          }

          return { ...item, grade: { ...item.grade, ...updates } };
      }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const gradesToSave = studentsData.map(s => s.grade);
      await saveGrades(gradesToSave);
      showSuccess('تم حفظ كافة التغييرات بنجاح');
    } catch (e: any) {
      showError(e.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  // --- Sub-Components ---

  const TabButton = ({ id, label }: { id: TabType, label: string }) => (
      <button 
        onClick={() => setActiveTab(id)}
        className={`flex-1 py-1.5 md:py-2 text-[10px] md:text-xs font-bold rounded-lg transition-all duration-200 ${
            activeTab === id 
            ? 'bg-[#064E3B] text-white shadow-md shadow-emerald-900/10' 
            : 'bg-transparent text-gray-500 hover:bg-gray-100'
        }`}
      >
          {label}
      </button>
  );

  const ScoreInput = ({ value, max, onChange, disabled, label, highlight = false }: { value: number, max: number, onChange: (v: number) => void, disabled: boolean, label: string, highlight?: boolean }) => {
      const [localValue, setLocalValue] = useState(value.toString());

      // Update local state if parent value changes externally (e.g. initial load)
      useEffect(() => {
          setLocalValue(value.toString());
      }, [value]);

      const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          // Allow typing freely
          const raw = e.target.value;
          if (raw === '' || /^[0-9]*$/.test(raw)) {
              setLocalValue(raw);
          }
      };

      const handleBlur = () => {
          // Validate and Commit ONLY on Blur
          let num = parseInt(localValue, 10);
          
          if (isNaN(num)) {
              num = 0;
          } else if (num > max) {
              num = max;
          } else if (num < 0) {
              num = 0;
          }

          // Update UI to sanitized number
          setLocalValue(num.toString());
          
          // Notify Parent
          if (num !== value) {
              onChange(num);
          }
      };

      const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'Enter') {
              e.currentTarget.blur();
          }
      };

      if(disabled) {
          return (
              <div className="w-full">
                  <span className="text-[8px] md:text-[9px] text-gray-400 block mb-0.5 md:hidden">{label}</span>
                  <div className={`w-full h-7 md:h-9 rounded-lg flex items-center justify-center text-gray-500 text-xs md:text-sm font-bold border ${highlight ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-gray-100 border-gray-200'} cursor-not-allowed`}>
                      {value}
                  </div>
              </div>
          )
      }

      return (
          <div className="w-full relative group">
               <span className="text-[8px] md:text-[9px] text-gray-500 block mb-0.5 md:hidden font-bold">{label}</span>
               <input 
                type="text" 
                inputMode="numeric"
                pattern="[0-9]*"
                value={localValue}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                placeholder="0"
                className={`w-full h-8 md:h-10 text-center border rounded-lg focus:ring-4 focus:ring-emerald-500/10 outline-none font-bold text-xs md:text-sm transition-all placeholder-gray-300 shadow-sm ${highlight ? 'bg-amber-50 border-amber-300 text-amber-800 focus:border-amber-500' : 'bg-white border-gray-300 focus:border-[#064E3B] text-gray-800'}`}
               />
               <span className={`hidden group-focus-within:block absolute -top-2 right-2 px-1 text-[9px] font-bold border rounded ${highlight ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-white text-emerald-600 border-emerald-100'}`}>
                   Max: {max}
               </span>
          </div>
      );
  };

  // Determine if current tab is locked by ADMIN
  // NOTE: We no longer lock based on "Published" status. Only "Semester Active" status.
  const isTabLocked = () => {
      if (activeTab === 'sem1' && !currentYearConfig?.isSem1Active) return true;
      if (activeTab === 'sem2' && !currentYearConfig?.isSem2Active) return true;
      if (activeTab === 'recap') return true; // Recap is always read-only
      return false;
  };

  const isLocked = isTabLocked();
  // Is current view primarily DIRECT mode?
  const isGlobalDirect = currentTabMode === 'DIRECT';

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Header */}
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-3 ${selectedSubject ? 'hidden md:flex' : ''}`}>
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-[#064E3B]">لوحة المحاضر</h2>
          <p className="text-gray-500 text-xs mt-0.5">إدارة الدرجات والمواد الدراسية</p>
        </div>
        
        <div className="flex items-center gap-2">
             {/* Reload Button */}
             <button 
                onClick={handleReload}
                disabled={reloading}
                className="bg-white p-2 rounded-lg shadow-sm border border-gray-200 text-gray-500 hover:text-[#064E3B] hover:border-[#064E3B] transition-all disabled:opacity-50"
                title="تحديث البيانات"
            >
                <svg className={`w-4 h-4 ${reloading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
            </button>

            <div className="bg-white p-1 rounded-lg shadow-sm border border-gray-200 flex items-center">
                <span className="text-[10px] font-bold text-gray-400 px-2">السنة:</span>
                <select 
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="bg-transparent text-[#064E3B] font-bold text-xs outline-none py-1 px-1 cursor-pointer"
                >
                    {years.map(y => (
                        <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                </select>
            </div>
        </div>
      </div>

      {/* --- SUBJECT SELECTION GRID --- */}
      {!selectedSubject && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {subjects.map(subject => (
            <div
                key={subject.id}
                onClick={() => setSelectedSubject(subject)}
                className="group bg-white rounded-xl p-3 md:p-4 shadow-sm hover:shadow-lg transition-all duration-300 border border-transparent hover:border-emerald-100 cursor-pointer relative overflow-hidden transform hover:-translate-y-1"
            >
                <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-2 md:mb-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${subject.status === GradeStatus.DRAFT ? 'bg-gray-100 text-gray-600' : 'bg-emerald-100 text-emerald-700'}`}>
                            {subject.status === GradeStatus.DRAFT ? 'مسودة' : 'تم النشر'}
                        </span>
                        <div className="text-xl text-emerald-100 group-hover:text-emerald-600 transition-colors">
                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
                        </div>
                    </div>
                    <h3 className="text-base md:text-lg font-bold text-gray-800 mb-0.5 group-hover:text-[#064E3B]">{subject.subjectName}</h3>
                    
                    <div className="flex items-center gap-2 mt-2 md:mt-3 pt-2 md:pt-3 border-t border-gray-50">
                        <span className="bg-gray-50 text-gray-600 px-2 py-0.5 rounded-md text-[10px] font-medium">{subject.className}</span>
                        <span className="text-[10px] text-gray-400">{subject.sks} وحدات</span>
                    </div>
                </div>
            </div>
          ))}
          {subjects.length === 0 && <div className="col-span-full py-16 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">لا توجد مواد مسجلة</div>}
        </div>
      )}

      {/* --- GRADING INTERFACE --- */}
      {selectedSubject && (
        <div className="animate-fade-in bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden min-h-[75vh] flex flex-col relative">
            
            {/* TOP BAR */}
            <div className="bg-white px-3 py-3 md:px-5 md:py-4 border-b border-gray-100 flex flex-col md:flex-row justify-between md:items-center gap-3 sticky top-0 z-30 shadow-sm">
                <div className="flex items-center gap-2">
                    <button onClick={() => setSelectedSubject(null)} className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center bg-gray-50 hover:bg-emerald-50 hover:text-emerald-700 rounded-full transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 rotate-180"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
                    </button>
                    <div>
                        <h2 className="text-sm md:text-lg font-bold text-gray-900 leading-tight">{selectedSubject.subjectName}</h2>
                        <div className="flex items-center gap-2 text-[10px] md:text-xs text-gray-500 mt-0.5">
                             <span>{selectedSubject.className}</span>
                             {selectedSubject.status === GradeStatus.PUBLISHED && (
                                 <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">منشور</span>
                             )}
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-2 self-end md:self-auto">
                    {/* Reload Button inside subject view */}
                    <button 
                        onClick={handleReload}
                        disabled={reloading}
                        className="bg-white p-1.5 md:p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-[#064E3B] transition-all disabled:opacity-50"
                        title="تحديث الدرجات"
                    >
                        <svg className={`w-4 h-4 ${reloading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* TAB NAVIGATION */}
            <div className="px-3 py-2 bg-gray-50/50 border-b border-gray-100 sticky top-[60px] md:top-[72px] z-20 backdrop-blur-md">
                <div className="flex bg-gray-200/50 p-1 rounded-xl">
                    <TabButton id="sem1" label="الفصل الأول" />
                    <TabButton id="sem2" label="الفصل الثاني" />
                    <TabButton id="recap" label="النتيجة" />
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1 overflow-auto bg-gray-50 p-0 md:p-4 pb-20 md:pb-24">
                {loading ? (
                    <div className="p-6 space-y-3">
                        {[1,2,3,4].map(i => <div key={i} className="h-12 bg-white rounded-lg animate-pulse" />)}
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto space-y-1.5 md:space-y-3">
                        
                        {/* GLOBAL TOGGLE BUTTON */}
                        {activeTab !== 'recap' && !isLocked && (
                            <div className="flex justify-end px-3 pt-2">
                                <button 
                                    onClick={handleGlobalToggle}
                                    className="text-[9px] md:text-[10px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                    {isGlobalDirect ? "التبديل للنمط التفصيلي (نصفي + نهائي)" : "التبديل للنمط المباشر (الدرجة النهائية)"}
                                </button>
                            </div>
                        )}

                        {/* HEADER ROW (Desktop) */}
                        <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 bg-gray-200 text-gray-600 text-xs font-bold rounded-lg mx-2">
                            <div className="col-span-1 text-center">#</div>
                            <div className="col-span-4 text-right">اسم الطالب</div>
                            
                            {activeTab !== 'recap' ? (
                                <>
                                    <div className="col-span-4 text-center">تفاصيل الدرجات</div>
                                    <div className="col-span-3 text-center">المجموع</div>
                                </>
                            ) : (
                                <>
                                    <div className="col-span-2 text-center">مجموع ف1</div>
                                    <div className="col-span-2 text-center">مجموع ف2</div>
                                    <div className="col-span-2 text-center">المعدل</div>
                                    <div className="col-span-1 text-center">الحالة</div>
                                </>
                            )}
                        </div>

                        {/* STUDENT ROWS */}
                        {studentsData.map((item, idx) => {
                            // Extract values based on active tab
                            const uts = activeTab === 'sem1' ? item.grade.sem1_uts : item.grade.sem2_uts;
                            const uas = activeTab === 'sem1' ? item.grade.sem1_uas : item.grade.sem2_uas;
                            const inputMethod = activeTab === 'sem1' ? item.grade.sem1_input_type : item.grade.sem2_input_type;
                            
                            const total = uts + uas;

                            const sem1Total = item.grade.sem1_uts + item.grade.sem1_uas;
                            const sem2Total = item.grade.sem2_uts + item.grade.sem2_uas;
                            const finalAvg = (sem1Total + sem2Total) / 2;
                            const passed = finalAvg >= 60;

                            const isDirect = inputMethod === 'DIRECT';

                            return (
                                <div key={item.student.id} className="relative bg-white p-2 md:p-4 rounded-xl border border-gray-200 md:border-transparent md:shadow-none shadow-sm flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-3 items-center">
                                    
                                    {/* Mobile Status Badge (Recap Mode) - Absolute Top Left */}
                                    {activeTab === 'recap' && (
                                        <div className="md:hidden absolute top-2 left-2 z-10">
                                             <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${passed ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                {passed ? 'ناجح' : 'راسب'}
                                            </span>
                                        </div>
                                    )}

                                    {/* Mobile Name & ID */}
                                    <div className="flex justify-between items-center w-full md:contents">
                                        <div className="flex items-center gap-2 col-span-5 w-full">
                                            <div className="hidden md:flex w-6 h-6 rounded-full bg-gray-100 items-center justify-center text-[10px] font-bold text-gray-500">
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900 text-xs md:text-sm">{item.student.name}</div>
                                                <div className="text-[9px] md:text-[10px] text-gray-400 font-mono">{item.student.id}</div>
                                            </div>
                                        </div>
                                        {/* Mobile Total Badge (Top Right) */}
                                        {activeTab !== 'recap' && (
                                            <div className="md:hidden flex items-center gap-2">
                                                <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${total < 60 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                    {total}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* INPUTS / RECAP CONTENT */}
                                    {activeTab !== 'recap' ? (
                                        <>
                                            {/* --- INPUT AREA --- */}
                                            <div className="w-full md:col-span-4 flex items-center justify-center gap-2 relative">
                                                
                                                {isDirect ? (
                                                    // DIRECT INPUT MODE
                                                    <div className="w-full flex-1">
                                                        <ScoreInput 
                                                            label="الدرجة النهائية (0-100)" 
                                                            value={uas} // We store total in UAS field for Direct mode
                                                            max={100} 
                                                            disabled={isLocked}
                                                            highlight={true}
                                                            onChange={(v) => handleGradeChange(item.student.id, activeTab === 'sem1' ? 'sem1_uas' : 'sem2_uas', v)} 
                                                        />
                                                    </div>
                                                ) : (
                                                    // COMPONENT INPUT MODE
                                                    <div className="flex gap-2 w-full">
                                                        <div className="flex-1">
                                                            <ScoreInput 
                                                                label="النصفي (20)" 
                                                                value={uts} 
                                                                max={20} 
                                                                disabled={isLocked}
                                                                onChange={(v) => handleGradeChange(item.student.id, activeTab === 'sem1' ? 'sem1_uts' : 'sem2_uts', v)} 
                                                            />
                                                        </div>
                                                        <div className="flex-1">
                                                            <ScoreInput 
                                                                label="النهائي (80)" 
                                                                value={uas} 
                                                                max={80} 
                                                                disabled={isLocked}
                                                                onChange={(v) => handleGradeChange(item.student.id, activeTab === 'sem1' ? 'sem1_uas' : 'sem2_uas', v)} 
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* TOTAL COLUMN */}
                                            <div className="hidden md:flex col-span-3 items-center justify-center gap-2">
                                                <span className={`text-base font-bold ${total < 60 ? 'text-red-500' : 'text-emerald-700'}`}>
                                                    {total}
                                                </span>
                                                {isDirect && <span className="text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded border border-amber-200">مباشر</span>}
                                            </div>
                                        </>
                                    ) : (
                                        /* RECAP VIEW */
                                        <>
                                            <div className="grid grid-cols-3 gap-2 w-full md:contents mt-1 md:mt-0">
                                                <div className="col-span-1 md:col-span-2 text-center bg-gray-50 md:bg-transparent rounded-lg p-1.5 md:p-0">
                                                    <span className="text-[9px] text-gray-400 block md:hidden">مجموع ف1</span>
                                                    <span className="font-bold text-gray-700 text-xs md:text-sm">{sem1Total}</span>
                                                </div>
                                                <div className="col-span-1 md:col-span-2 text-center bg-gray-50 md:bg-transparent rounded-lg p-1.5 md:p-0">
                                                    <span className="text-[9px] text-gray-400 block md:hidden">مجموع ف2</span>
                                                    <span className="font-bold text-gray-700 text-xs md:text-sm">{sem2Total}</span>
                                                </div>
                                                <div className="col-span-1 md:col-span-2 text-center bg-emerald-50 md:bg-transparent rounded-lg p-1.5 md:p-0">
                                                    <span className="text-[9px] text-emerald-600 block md:hidden">المعدل</span>
                                                    <span className="font-bold text-emerald-800 text-xs md:text-sm">{finalAvg.toFixed(1)}</span>
                                                </div>
                                                <div className="hidden md:block col-span-3 md:col-span-1 text-center mt-1 md:mt-0">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                        {passed ? 'ناجح' : 'راسب'}
                                                    </span>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* STICKY FOOTER (SAVE BUTTON) */}
            {!isLocked && activeTab !== 'recap' && (
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-white border-t border-gray-200 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                     <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
                         <div className="hidden md:block text-xs text-gray-500">
                             تأكد من حفظ التغييرات قبل مغادرة الصفحة
                         </div>
                         <button 
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full md:w-auto flex-1 md:flex-none bg-[#064E3B] text-white font-bold py-2.5 md:py-2 px-6 rounded-xl shadow-lg shadow-emerald-900/20 hover:bg-emerald-800 transition-all flex items-center justify-center gap-2 active:scale-95 text-xs md:text-sm"
                         >
                            {saving ? (
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : (
                                <>
                                    <span>حفظ كافة التغييرات</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                </>
                            )}
                         </button>
                     </div>
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export default LecturerDashboard;
