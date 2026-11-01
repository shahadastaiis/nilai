import React, { useState, useEffect, useMemo } from 'react';
import { User, SubjectView, GradeRecord, AcademicYear, GradeStatus, GradeInputType, GradeEditRequest, RemidiRecord, RemidiSettings } from '../types';
import { 
  getLecturerSubjects, 
  getClassStudents, 
  getAcademicYears, 
  subscribeToData, 
  reloadSpecificData,
  getGradeEditRequests,
  submitGradeEditRequest,
  saveSubjectSemesterGrades,
  getRemidiSettings,
  getLecturerRemidiRecords,
  bulkSaveRemidiScores
} from '../services/mockData';
import { showSuccess, showError, confirmAction } from '../utils/swal';

interface LecturerDashboardProps {
  user: User;
}

type TabType = 'sem1' | 'sem2' | 'recap' | 'remidi';

interface ScoreInputProps {
  value: number;
  max: number;
  onChange: (v: number) => void;
  disabled: boolean;
  label: string;
  highlight?: boolean;
  rowIndex: number;
  colKey: string;
}

const ScoreInput: React.FC<ScoreInputProps> = React.memo(({
  value,
  max,
  onChange,
  disabled,
  label,
  highlight = false,
  rowIndex,
  colKey
}) => {
  const [localValue, setLocalValue] = useState(value.toString());

  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '' || /^[0-9]*$/.test(raw)) {
      setLocalValue(raw);
    }
  };

  const commitValue = () => {
    let num = parseInt(localValue, 10);
    if (isNaN(num)) num = 0;
    else if (num > max) num = max;
    else if (num < 0) num = 0;

    setLocalValue(num.toString());
    if (num !== value) {
      onChange(num);
    }
  };

  const handleBlur = () => {
    commitValue();
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitValue();

      const allInputs = Array.from(
        document.querySelectorAll<HTMLInputElement>('input[data-grade-input="true"]:not([disabled])')
      );
      const currentIndex = allInputs.indexOf(e.currentTarget);
      if (currentIndex >= 0 && currentIndex < allInputs.length - 1) {
        const nextInput = allInputs[currentIndex + 1];
        nextInput.focus();
        nextInput.select();
      } else {
        e.currentTarget.blur();
      }
    } else if (e.key === 'ArrowDown') {
      commitValue();
      const target = document.querySelector<HTMLInputElement>(
        `input[data-grade-input="true"][data-row-index="${rowIndex + 1}"][data-col-key="${colKey}"]:not([disabled])`
      );
      if (target) {
        e.preventDefault();
        target.focus();
        target.select();
      }
    } else if (e.key === 'ArrowUp') {
      commitValue();
      const target = document.querySelector<HTMLInputElement>(
        `input[data-grade-input="true"][data-row-index="${rowIndex - 1}"][data-col-key="${colKey}"]:not([disabled])`
      );
      if (target) {
        e.preventDefault();
        target.focus();
        target.select();
      }
    }
  };

  if (disabled) {
    return (
      <div className="w-full">
        <span className="text-[10px] text-slate-400 block mb-0.5 md:hidden font-bold">{label}</span>
        <div className={`w-full h-9 rounded-lg flex items-center justify-center text-xs md:text-sm font-extrabold tabular-nums border ${highlight ? 'bg-amber-50/70 border-amber-200 text-amber-800' : 'bg-slate-100 border-slate-200 text-slate-500'} cursor-not-allowed`}>
          {value}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full relative group">
      <span className="text-[10px] text-slate-500 block mb-0.5 md:hidden font-bold">{label}</span>
      <input 
        type="text" 
        inputMode="numeric"
        pattern="[0-9]*"
        data-grade-input="true"
        data-row-index={rowIndex}
        data-col-key={colKey}
        tabIndex={0}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder="0"
        className={`w-full h-9 md:h-10 text-center border rounded-lg focus:ring-2 focus:ring-emerald-500/15 outline-none font-extrabold tabular-nums text-xs md:text-sm transition-all placeholder-slate-300 shadow-2xs ${highlight ? 'bg-amber-50 border-amber-300 text-amber-900 focus:border-amber-500' : 'bg-white border-slate-300 focus:border-[#064E3B] text-slate-800'}`}
      />
      <span className={`hidden group-focus-within:block absolute -top-2 right-2 px-1 text-[9px] font-bold border rounded z-10 tabular-nums ${highlight ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-emerald-700 border-emerald-100'}`}>
        الحد: {max}
      </span>
    </div>
  );
});

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

  const [activeTab, setActiveTab] = useState<TabType>('sem1');

  const [editRequests, setEditRequests] = useState<GradeEditRequest[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestNotes, setRequestNotes] = useState('');
  const [whatsappClicked, setWhatsappClicked] = useState(false);

  const [remidiRecords, setRemidiRecords] = useState<RemidiRecord[]>([]);
  const [remidiScores, setRemidiScores] = useState<{ [id: string]: string }>({});
  const [remidiSettings, setRemidiSettings] = useState<RemidiSettings>({ academicYearId: '', isInputOpen: false, isPublished: false });
  const [savingRemidi, setSavingRemidi] = useState(false);

  const loadMetadata = async () => {
    const data = await getAcademicYears();
    setYears(data);
    if (!selectedYear) {
      const active = data.find(y => y.isActive);
      if (active) setSelectedYear(active.id);
      else if (data.length > 0) setSelectedYear(data[0].id);
    }
    
    if (selectedYear) {
      const config = data.find(y => y.id === selectedYear);
      setCurrentYearConfig(config);
      
      if (user.id) {
        const subs = await getLecturerSubjects(user.id, selectedYear);
        setSubjects(subs);
        
        if (selectedSubject) {
          const updatedSubject = subs.find(s => s.id === selectedSubject.id);
          if (updatedSubject && updatedSubject.status !== selectedSubject.status) {
            setSelectedSubject(updatedSubject);
          }
        }
      }

      const reqs = await getGradeEditRequests(selectedYear);
      setEditRequests(reqs);
    }
  };

  useEffect(() => {
    loadMetadata();

    const unsubscribe = subscribeToData(() => {
      loadMetadata();
    });
    return () => unsubscribe();
  }, [selectedYear]); 

  useEffect(() => {
    const config = years.find(y => y.id === selectedYear);
    setCurrentYearConfig(config);
  }, [selectedYear, years]);

  useEffect(() => {
    setSelectedSubject(null);
    setActiveTab('sem1'); 
    setShowEditModal(false);
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

  useEffect(() => {
    if (selectedSubject && selectedYear) {
      const records = getLecturerRemidiRecords(user.id, selectedYear, selectedSubject.id);
      setRemidiRecords(records);
      const s = getRemidiSettings(selectedYear);
      setRemidiSettings(s);

      const map: { [id: string]: string } = {};
      records.forEach(r => {
        map[r.id] = r.remidiScore !== undefined ? String(r.remidiScore) : '';
      });
      setRemidiScores(map);
    }
  }, [selectedSubject, selectedYear, activeTab]);

  const handleReload = async () => {
    setReloading(true);
    try {
      await reloadSpecificData(['class_subjects', 'student_enrollments', 'grades', 'classes', 'grade_edit_requests']);
      showSuccess('تم تحديث البيانات بنجاح');
    } catch (e) {
      showError('فشل تحديث البيانات');
    } finally {
      setReloading(false);
    }
  };

  const currentSem: 1 | 2 = activeTab === 'sem1' ? 1 : 2;

  const isSemActive = useMemo(() => {
    if (activeTab === 'sem1') return Boolean(currentYearConfig?.isSem1Active);
    if (activeTab === 'sem2') return Boolean(currentYearConfig?.isSem2Active);
    return false;
  }, [activeTab, currentYearConfig]);

  const isSubmitted = useMemo(() => {
    if (studentsData.length === 0) return false;
    return studentsData.some(s => {
      if (activeTab === 'sem1') return Boolean(s.grade.sem1_submitted);
      if (activeTab === 'sem2') return Boolean(s.grade.sem2_submitted);
      return false;
    });
  }, [studentsData, activeTab]);

  const latestRequest = useMemo(() => {
    if (!selectedSubject || activeTab === 'recap' || activeTab === 'remidi') return undefined;
    return editRequests
      .filter(r => r.classSubjectId === selectedSubject.id && r.semester === currentSem && !r.isRemidi)
      .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())[0];
  }, [editRequests, selectedSubject, currentSem, activeTab]);

  const hasEditPermission = useMemo(() => {
    return Boolean(latestRequest && latestRequest.status === 'APPROVED');
  }, [latestRequest]);

  const isLocked = useMemo(() => {
    if (activeTab === 'recap') return true;
    if (!isSemActive) return true;
    if (isSubmitted && !hasEditPermission) return true;
    return false;
  }, [activeTab, isSemActive, isSubmitted, hasEditPermission]);

  const isRemidiSubmitted = useMemo(() => {
    if (remidiRecords.length === 0) return false;
    return remidiRecords.some(r => Boolean(r.submitted) || (r.remidiScore !== undefined && r.remidiScore !== null));
  }, [remidiRecords]);

  const latestRemidiRequest = useMemo(() => {
    if (!selectedSubject || activeTab !== 'remidi') return undefined;
    return editRequests
      .filter(r => r.classSubjectId === selectedSubject.id && Boolean(r.isRemidi))
      .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())[0];
  }, [editRequests, selectedSubject, activeTab]);

  const hasRemidiEditPermission = useMemo(() => {
    return Boolean(latestRemidiRequest && latestRemidiRequest.status === 'APPROVED');
  }, [latestRemidiRequest]);

  const isRemidiLocked = useMemo(() => {
    if (!remidiSettings.isInputOpen) return true;
    if (isRemidiSubmitted && !hasRemidiEditPermission) return true;
    return false;
  }, [remidiSettings.isInputOpen, isRemidiSubmitted, hasRemidiEditPermission]);

  const activeRequest = activeTab === 'remidi' ? latestRemidiRequest : latestRequest;

  const handleRemidiScoreChange = (recordId: string, val: string) => {
    if (!remidiSettings.isInputOpen) {
      showError('فترة رصد التكميلي مغلقة حالياً من قبل الإدارة.');
      return;
    }
    if (isRemidiLocked) {
      showError('درجات التكميلي مقفلة. لتعديلها يرجى تقديم طلب تعديل للإدارة.');
      return;
    }
    if (val === '' || /^[0-9]*$/.test(val)) {
      setRemidiScores(prev => ({ ...prev, [recordId]: val }));
    }
  };

  const handleSaveRemidi = async (isEditSave: boolean = false) => {
    if (!remidiSettings.isInputOpen) {
      showError('فترة رصد التكميلي مغلقة حالياً من قبل الإدارة.');
      return;
    }

    if (isRemidiLocked && !isEditSave) {
      showError('درجات التكميلي مقفلة. يرجى تقديم طلب تعديل أولاً.');
      return;
    }

    const updates = remidiRecords.map(r => {
      const raw = remidiScores[r.id];
      const val = raw !== undefined && raw !== '' ? Math.max(0, Math.min(100, parseInt(raw, 10) || 0)) : 0;
      return {
        recordId: r.id,
        remidiScore: val
      };
    });

    const confirmed = await confirmAction(
      isEditSave ? 'تأكيد حفظ التعديل' : 'تأكيد حفظ الدرجات',
      isEditSave
        ? `هل أنت متأكد من حفظ تعديلات التكميلي (${updates.length} طالب)؟ سيتم قفل الدرجات تلقائياً بعد الحفظ.`
        : `هل أنت متأكد من حفظ درجات التكميلي (${updates.length} طالب)؟ سيتم قفل الدرجات بعد الحفظ.`
    );
    if (!confirmed) return;

    setSavingRemidi(true);
    try {
      await bulkSaveRemidiScores(updates, selectedSubject?.id);
      showSuccess(isEditSave ? 'تم حفظ التعديلات وإعادة قفل الدرجات' : 'تم حفظ درجات التكميلي بنجاح');
      
      const allRequests = await getGradeEditRequests(selectedYear);
      setEditRequests(allRequests);

      if (selectedSubject && selectedYear) {
        const updated = getLecturerRemidiRecords(user.id, selectedYear, selectedSubject.id);
        setRemidiRecords(updated);
      }
    } catch (e) {
      showError('فشل حفظ درجات التكميلي');
    } finally {
      setSavingRemidi(false);
    }
  };

  const handleGradeChange = (studentId: string, field: keyof GradeRecord, value: any) => {
    if (isLocked) {
      showError('الدرجات مقفلة حالياً.');
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

  const currentTabMode = useMemo(() => {
    if (studentsData.length === 0) return 'COMPONENT';
    const first = studentsData[0];
    return activeTab === 'sem1' ? (first.grade.sem1_input_type || 'COMPONENT') : (first.grade.sem2_input_type || 'COMPONENT');
  }, [studentsData, activeTab]);

  const handleGlobalToggle = async () => {
    if (isLocked) {
      showError('لا يمكن تغيير نمط الإدخال لأن الدرجات مقفلة.');
      return;
    }

    const sem = activeTab as 'sem1' | 'sem2';
    const newMethod: GradeInputType = currentTabMode === 'DIRECT' ? 'COMPONENT' : 'DIRECT';
    
    const confirmed = await confirmAction(
      'تبديل نمط الرصد',
      `هل تريد تغيير نمط الرصد إلى ${newMethod === 'DIRECT' ? 'الدرجة المباشرة (0-100)' : 'النمط التفصيلي (نصفي + نهائي)'} لجميع الطلاب؟`
    );
    
    if (!confirmed) return;

    setStudentsData(prev => prev.map(item => {
      let newUts = sem === 'sem1' ? item.grade.sem1_uts : item.grade.sem2_uts;
      let newUas = sem === 'sem1' ? item.grade.sem1_uas : item.grade.sem2_uas;

      if (newMethod === 'DIRECT') {
        newUas = newUts + newUas;
        newUts = 0;
        if (newUas > 100) newUas = 100;
      }

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

  const handleSaveInitial = async () => {
    if (!isSemActive) {
      showError('الفصل الدراسي مغلق حالياً من قبل الإدارة.');
      return;
    }

    const confirmed = await confirmAction(
      'حفظ واعتماد الدرجات',
      'هل تريد حفظ درجات جميع الطلاب؟ سيتم قفل الرصد تلقائياً بعد الحفظ.',
      'حفظ وقفل'
    );

    if (!confirmed) return;

    setSaving(true);
    try {
      const gradesToSave = studentsData.map(s => ({
        ...s.grade,
        ...(currentSem === 1 ? { sem1_submitted: true } : { sem2_submitted: true })
      }));

      await saveSubjectSemesterGrades(selectedSubject!.id, currentSem, user.id, gradesToSave);

      const freshData = await getClassStudents(selectedSubject!.id);
      setStudentsData(freshData);

      showSuccess('تم حفظ الدرجات وقفلها بنجاح');
    } catch (e: any) {
      showError(e.message || 'حدث خطأ أثناء حفظ الدرجات');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdited = async () => {
    if (!isSemActive) {
      showError('الفصل الدراسي مغلق حالياً من قبل الإدارة.');
      return;
    }

    const confirmed = await confirmAction(
      'حفظ التعديلات',
      'هل أنت متأكد من حفظ التعديلات؟ سيتم إعادة قفل الدرجات فوراً بعد الحفظ.',
      'حفظ التعديل'
    );

    if (!confirmed) return;

    setSaving(true);
    try {
      const gradesToSave = studentsData.map(s => ({
        ...s.grade,
        ...(currentSem === 1 ? { sem1_submitted: true } : { sem2_submitted: true })
      }));

      await saveSubjectSemesterGrades(selectedSubject!.id, currentSem, user.id, gradesToSave);

      const freshData = await getClassStudents(selectedSubject!.id);
      setStudentsData(freshData);

      const updatedReqs = await getGradeEditRequests(selectedYear);
      setEditRequests(updatedReqs);

      showSuccess('تم حفظ التعديلات وإعادة قفل الدرجات');
    } catch (e: any) {
      showError(e.message || 'حدث خطأ أثناء حفظ التعديلات');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (!selectedSubject) return;

    setSubmittingRequest(true);
    try {
      const isRemidiReq = activeTab === 'remidi';
      const newReq = await submitGradeEditRequest(
        selectedSubject.id,
        user.id,
        selectedYear,
        isRemidiReq ? 1 : currentSem,
        requestNotes.trim() || (isRemidiReq ? 'طلب تعديل درجات التكميلي' : 'طلب تعديل درجات الفصل'),
        isRemidiReq
      );

      setEditRequests(prev => [newReq, ...prev.filter(r => r.id !== newReq.id)]);
      showSuccess('تم إرسال طلب التعديل إلى الإدارة بنجاح');
      setShowEditModal(false);
      setRequestNotes('');
    } catch (e: any) {
      showError(e.message || 'فشل إرسال الطلب');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const whatsappUrl = useMemo(() => {
    if (!selectedSubject) {
      const defaultText = `السلام عليكم ورحمة الله وبركاته\nإلى المكرم مسؤول الشؤون الأكاديمية بجامعة الإمام الشافعي،\nأرجو المساعدة بخصوص نظام رصد الدرجات.`;
      return `https://wa.me/6282116031348?text=${encodeURIComponent(defaultText)}`;
    }

    if (activeTab === 'remidi') {
      const reasonText = requestNotes.trim() ? `\n- السبب: ${requestNotes.trim()}` : '';
      const text = `السلام عليكم ورحمة الله وبركاته\nإلى المكرم مسؤول الشؤون الأكاديمية بجامعة الإمام الشافعي،\n\nالمحاضر: ${user.name} (${user.id})\nأرجو التكرم بالموافقة على فتح تعديل درجات التكميلي:\n- المقرر: ${selectedSubject.subjectName}\n- الفصل: ${selectedSubject.className}\n- العام الدراسي: ${currentYearConfig?.name || selectedYear}${reasonText}\n\nوجزاكم الله خيراً.`;
      return `https://wa.me/6282116031348?text=${encodeURIComponent(text)}`;
    }

    const semName = currentSem === 1 ? 'الفصل الأول' : 'الفصل الثاني';
    const reasonText = requestNotes.trim() ? `\n- السبب: ${requestNotes.trim()}` : '';

    const text = `السلام عليكم ورحمة الله وبركاته\nإلى المكرم مسؤول الشؤون الأكاديمية بجامعة الإمام الشافعي،\n\nالمحاضر: ${user.name} (${user.id})\nأرجو التكرم بالموافقة على فتح تعديل درجات الطلاب:\n- المقرر: ${selectedSubject.subjectName}\n- الفصل: ${selectedSubject.className}\n- الفصل الدراسي: ${semName}\n- العام الدراسي: ${currentYearConfig?.name || selectedYear}${reasonText}\n\nوجزاكم الله خيراً.`;

    return `https://wa.me/6282116031348?text=${encodeURIComponent(text)}`;
  }, [selectedSubject, activeTab, currentSem, user.name, user.id, currentYearConfig, selectedYear, requestNotes]);

  const TabButton = ({ id, label }: { id: TabType, label: string }) => (
    <button 
      onClick={() => setActiveTab(id)}
      className={`flex-1 py-2 px-2.5 text-xs font-extrabold rounded-lg transition-all duration-200 whitespace-nowrap ${
        activeTab === id 
        ? 'bg-[#064E3B] text-white shadow-2xs' 
        : 'bg-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100'
      }`}
    >
      {label}
    </button>
  );
  const isGlobalDirect = currentTabMode === 'DIRECT';

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* Header */}
      <div className={`bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${selectedSubject ? 'hidden md:flex' : ''}`}>
        <div>
          <h2 className="text-base sm:text-xl font-extrabold text-slate-900">بوابة المحاضر</h2>
          <p className="text-slate-500 text-xs mt-0.5">رصد الدرجات الفصلية والاختبارات التكميلية</p>
        </div>
        
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-2.5 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80 flex items-center gap-2 flex-1 sm:flex-initial justify-between sm:justify-start">
            <span className="text-[11px] font-bold text-slate-400">العام:</span>
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

      {/* --- SUBJECT SELECTION GRID --- */}
      {!selectedSubject && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 block">المقررات المسندة</span>
              <span className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5 block tabular-nums">{subjects.length}</span>
            </div>
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 block">المنشورة</span>
              <span className="text-lg sm:text-xl font-extrabold text-emerald-700 mt-0.5 block tabular-nums">
                {subjects.filter(s => s.status === GradeStatus.PUBLISHED).length}
              </span>
            </div>
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 block">الفصل الأول</span>
              <span className={`text-[11px] font-extrabold mt-1.5 inline-block px-2 py-0.5 rounded-md ${currentYearConfig?.isSem1Active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {currentYearConfig?.isSem1Active ? 'مفتوح للرصد' : 'مغلق'}
              </span>
            </div>
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 block">الفصل الثاني</span>
              <span className={`text-[11px] font-extrabold mt-1.5 inline-block px-2 py-0.5 rounded-md ${currentYearConfig?.isSem2Active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {currentYearConfig?.isSem2Active ? 'مفتوح للرصد' : 'مغلق'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {subjects.map(subject => (
              <div
                key={subject.id}
                onClick={() => setSelectedSubject(subject)}
                className="group bg-white rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all duration-200 border border-slate-200/80 hover:border-emerald-500/40 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center mb-2.5">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${subject.status === GradeStatus.DRAFT ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'}`}>
                      {subject.status === GradeStatus.DRAFT ? 'قيد الرصد' : 'منشور'}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 tabular-nums">{subject.subjectCode}</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 group-hover:text-[#064E3B] transition-colors">{subject.subjectName}</h3>
                </div>
                
                <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px] font-bold">{subject.className}</span>
                    <span className="text-[11px] text-slate-400 tabular-nums">{subject.sks} ساعات</span>
                  </div>
                  <span className="text-xs font-bold text-[#064E3B] inline-flex items-center gap-1">
                    <span>فتح السجل</span>
                    <svg className="w-3.5 h-3.5 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </span>
                </div>
              </div>
            ))}
            {subjects.length === 0 && (
              <div className="col-span-full py-14 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300 font-bold text-xs sm:text-sm">
                لا توجد مقررات مسندة في هذا العام الدراسي
              </div>
            )}
          </div>
        </>
      )}

      {/* --- GRADING INTERFACE --- */}
      {selectedSubject && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col relative">
          
          {/* TOP BAR (Non-colliding clean header) */}
          <div className="bg-white px-3.5 py-3 sm:px-5 border-b border-slate-200/70 flex flex-row justify-between items-center gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={() => setSelectedSubject(null)}
                className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-emerald-50 hover:text-[#064E3B] rounded-xl transition-colors shrink-0"
                title="رجوع"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-4 h-4 rotate-180"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
              </button>
              <div className="min-w-0">
                <h2 className="text-xs sm:text-base font-extrabold text-slate-900 leading-tight truncate">{selectedSubject.subjectName}</h2>
                <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-500 mt-0.5 flex-wrap">
                  <span className="font-bold text-slate-700">{selectedSubject.className}</span>
                  <span>•</span>
                  <span className="tabular-nums">{studentsData.length} طالب</span>
                  {selectedSubject.status === GradeStatus.PUBLISHED && (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-1.5 py-0.2 rounded text-[9px] font-bold">منشور</span>
                  )}
                </div>
              </div>
            </div>
            
            <button 
              onClick={handleReload}
              disabled={reloading}
              className="bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200/80 text-slate-600 hover:text-[#064E3B] transition-all disabled:opacity-50 text-xs font-bold flex items-center gap-1.5 shrink-0"
              title="تحديث"
            >
              <svg className={`w-3.5 h-3.5 ${reloading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden sm:inline">تحديث</span>
            </button>
          </div>

          {/* TAB NAVIGATION */}
          <div className="px-3.5 py-2 sm:px-5 bg-slate-50/70 border-b border-slate-200/60 overflow-x-auto no-scrollbar">
            <div className="flex bg-slate-200/60 p-1 rounded-xl min-w-[280px] max-w-xl">
              <TabButton id="sem1" label="الفصل الأول" />
              <TabButton id="sem2" label="الفصل الثاني" />
              <TabButton id="recap" label="المحصلة" />
              <TabButton id="remidi" label="التكميلي" />
            </div>
          </div>

          {/* STATUS NOTIFICATION BANNER */}
          {activeTab !== 'recap' && activeTab !== 'remidi' && (
            <div className="px-3.5 pt-3 sm:px-5">
              {!isSemActive ? (
                <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-2.5 sm:p-3 text-amber-900 text-xs flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  <span><strong>الرصد مغلق:</strong> فترة إدخال الدرجات لهذا الفصل مغلقة من قِبل الإدارة.</span>
                </div>
              ) : !isSubmitted ? (
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-2.5 sm:p-3 text-emerald-900 text-xs flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span><strong>الرصد متاح:</strong> أدخل درجات الطلاب ثم اضغط على <strong>حفظ</strong> لاعتمادها.</span>
                </div>
              ) : hasEditPermission ? (
                <div className="bg-emerald-600 text-white rounded-xl p-2.5 sm:p-3 text-xs flex items-center gap-2 shadow-xs">
                  <svg className="w-4 h-4 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span><strong>التعديل متاح:</strong> قم بتعديل الدرجات ثم اضغط <strong>حفظ التعديل</strong>.</span>
                </div>
              ) : latestRequest?.status === 'PENDING' ? (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 sm:p-3 text-amber-900 text-xs flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span><strong>طلب التعديل قيد المراجعة:</strong> بانتظار موافقة الإدارة.</span>
                  </div>
                  <a 
                    href={whatsappUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={() => setWhatsappClicked(true)}
                    className="inline-flex items-center gap-1.5 bg-[#25D366] text-white px-3 py-1 rounded-lg font-bold text-[11px] hover:bg-[#20ba59] transition-all shrink-0 whitespace-nowrap"
                  >
                    <span>مراسلة الإدارة</span>
                  </a>
                </div>
              ) : latestRequest?.status === 'REJECTED' ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 sm:p-3 text-red-900 text-xs flex items-center justify-between gap-2">
                  <span><strong>تم رفض الطلب:</strong> السجل مقفل حالياً.</span>
                  <button 
                    onClick={() => setShowEditModal(true)}
                    className="text-xs font-bold text-red-700 bg-red-100 hover:bg-red-200 px-3 py-1 rounded-lg transition-colors shrink-0 whitespace-nowrap"
                  >
                    طلب جديد
                  </button>
                </div>
              ) : (
                <div className="bg-slate-100 border border-slate-200 rounded-xl p-2.5 sm:p-3 text-slate-700 text-xs flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  <span><strong>السجل مقفل:</strong> تم حفظ الدرجات مسبقاً، وللتعديل يلزم تقديم طلب للإدارة.</span>
                </div>
              )}
            </div>
          )}

          {/* REMIDI STATUS BANNER */}
          {activeTab === 'remidi' && (
            <div className="px-3.5 pt-3 sm:px-5">
              {!remidiSettings.isInputOpen ? (
                <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-2.5 sm:p-3 text-amber-900 text-xs flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  <span><strong>رصد التكميلي مغلق:</strong> فترة إدخال درجات التكميلي مغلقة حالياً من قِبل الإدارة.</span>
                </div>
              ) : hasRemidiEditPermission ? (
                <div className="bg-emerald-600 text-white rounded-xl p-2.5 sm:p-3 text-xs flex items-center gap-2 shadow-xs">
                  <svg className="w-4 h-4 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span><strong>تعديل التكميلي متاح:</strong> يمكنك الآن تعديل الدرجات ثم الضغط على <strong>حفظ التعديل</strong>.</span>
                </div>
              ) : latestRemidiRequest?.status === 'PENDING' ? (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 sm:p-3 text-amber-900 text-xs flex flex-wrap items-center justify-between gap-2">
                  <span><strong>طلب تعديل التكميلي قيد المراجعة:</strong> بانتظار موافقة الإدارة.</span>
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setWhatsappClicked(true)}
                    className="inline-flex items-center gap-1.5 bg-[#25D366] text-white px-3 py-1 rounded-lg font-bold text-[11px] hover:bg-[#20ba59] transition-all shrink-0 whitespace-nowrap"
                  >
                    <span>مراسلة الإدارة</span>
                  </a>
                </div>
              ) : isRemidiSubmitted ? (
                <div className="bg-slate-100 border border-slate-200 rounded-xl p-2.5 sm:p-3 text-slate-700 text-xs flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  <span><strong>درجات التكميلي مقفلة:</strong> تم اعتماد الرصد مسبقاً، وللتعديل اضغط على <strong>طلب تعديل</strong>.</span>
                </div>
              ) : (
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-2.5 sm:p-3 text-emerald-900 text-xs flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span><strong>رصد التكميلي متاح:</strong> أدخل درجات الطلاب ثم اضغط <strong>حفظ</strong>.</span>
                </div>
              )}
            </div>
          )}

          {/* CONTENT AREA */}
          <div className="flex-1 bg-slate-50/50 p-3 sm:p-5">
            {loading ? (
              <div className="space-y-2.5 max-w-4xl mx-auto">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-white rounded-xl border border-slate-100 animate-pulse" />)}
              </div>
            ) : activeTab === 'remidi' ? (
              <div className="max-w-4xl mx-auto space-y-2">
                <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-200/70 text-slate-600 text-xs font-extrabold rounded-xl">
                  <div className="col-span-1 text-center">#</div>
                  <div className="col-span-4 text-right">اسم الطالب</div>
                  <div className="col-span-2 text-center">الفصل الدراسي</div>
                  <div className="col-span-2 text-center">الدرجة السابقة</div>
                  <div className="col-span-3 text-center">درجة التكميلي (0-100)</div>
                </div>

                {remidiRecords.map((item, idx) => {
                  const scoreStr = remidiScores[item.id] !== undefined ? remidiScores[item.id] : '';
                  const numScore = parseInt(scoreStr, 10);
                  const isGraded = scoreStr !== '' && !isNaN(numScore);
                  const isPassed = isGraded && numScore >= 60;

                  return (
                    <div key={item.id} className="bg-white p-3 md:px-4 md:py-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col md:grid md:grid-cols-12 gap-2.5 md:gap-3 items-center">
                      <div className="w-full md:contents flex items-center justify-between border-b md:border-0 pb-2 md:pb-0 border-slate-100">
                        <div className="hidden md:block col-span-1 text-center text-xs text-slate-400 font-bold tabular-nums">
                          {idx + 1}
                        </div>
                        <div className="col-span-4 flex items-center gap-2 min-w-0">
                          <span className="md:hidden text-xs font-bold text-slate-400 tabular-nums shrink-0">#{idx + 1}</span>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm block truncate">{item.studentName}</span>
                            <span className="text-[10px] text-slate-400 font-mono tabular-nums">{item.studentId}</span>
                          </div>
                        </div>
                        <span className="md:hidden px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold shrink-0">
                          {item.semester === 1 ? 'الفصل الأول' : 'الفصل الثاني'}
                        </span>
                      </div>

                      <div className="hidden md:flex md:col-span-2 items-center justify-center">
                        <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-bold">
                          {item.semester === 1 ? 'الأول' : 'الثاني'}
                        </span>
                      </div>

                      <div className="w-full md:contents flex items-center justify-between gap-2">
                        <div className="md:col-span-2 flex items-center gap-1.5 md:justify-center">
                          <span className="text-[10px] text-slate-400 md:hidden font-bold">السابقة:</span>
                          <span className="inline-flex items-center justify-center min-w-[2.1rem] bg-red-50 text-red-700 border border-red-200/80 px-2 py-0.5 rounded-lg font-extrabold text-xs tabular-nums">
                            {item.initialScore}
                          </span>
                        </div>

                        <div className="md:col-span-3 flex items-center gap-2 md:justify-center">
                          <span className="text-[10px] text-slate-500 md:hidden font-bold">التكميلي:</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="0-100"
                            disabled={isRemidiLocked}
                            value={scoreStr}
                            onChange={e => handleRemidiScoreChange(item.id, e.target.value)}
                            className={`w-20 h-9 text-center border rounded-xl font-extrabold text-xs sm:text-sm tabular-nums outline-none transition-all ${
                              isRemidiLocked 
                                ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                                : isGraded
                                  ? (isPassed ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-red-300 bg-red-50 text-red-900')
                                  : 'border-slate-300 bg-white text-slate-800 focus:border-[#064E3B] focus:ring-2 focus:ring-emerald-500/20'
                            }`}
                          />
                          {isGraded && (
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold whitespace-nowrap ${isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                              {isPassed ? 'مجتاز' : 'راسب'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {remidiRecords.length === 0 && (
                  <div className="py-14 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                    <svg className="w-11 h-11 mx-auto text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="font-extrabold text-xs sm:text-sm text-slate-700">لا يوجد طلاب مسجلون في التكميلي لهذا المقرر</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="max-w-4xl mx-auto space-y-2">
                {activeTab !== 'recap' && !isLocked && (
                  <div className="flex justify-end pb-1">
                    <button 
                      onClick={handleGlobalToggle}
                      className="text-xs font-bold text-[#064E3B] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/70 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                      <span>{isGlobalDirect ? 'تبديل للنمط التفصيلي (نصفي + نهائي)' : 'تبديل للنمط المباشر (0-100)'}</span>
                    </button>
                  </div>
                )}

                <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-200/70 text-slate-600 text-xs font-extrabold rounded-xl">
                  <div className="col-span-1 text-center">#</div>
                  <div className="col-span-4 text-right">اسم الطالب</div>
                  
                  {activeTab !== 'recap' ? (
                    <>
                      <div className="col-span-4 text-center">{isGlobalDirect ? 'الدرجة النهائية (100)' : 'أعمال الفصل (20) + النهائي (80)'}</div>
                      <div className="col-span-3 text-center">المجموع</div>
                    </>
                  ) : (
                    <>
                      <div className="col-span-2 text-center">الأول</div>
                      <div className="col-span-2 text-center">الثاني</div>
                      <div className="col-span-2 text-center">المعدل</div>
                      <div className="col-span-1 text-center">الحالة</div>
                    </>
                  )}
                </div>

                {studentsData.map((item, idx) => {
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
                    <div key={item.student.id} className="bg-white p-3 md:px-4 md:py-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-3 items-center">
                      {/* Student Name Row (No absolute positioning collision!) */}
                      <div className="w-full md:contents flex items-center justify-between gap-2 border-b md:border-0 pb-1.5 md:pb-0 border-slate-100">
                        <div className="hidden md:block col-span-1 text-center text-xs text-slate-400 font-bold tabular-nums">
                          {idx + 1}
                        </div>
                        <div className="col-span-4 flex items-center gap-2 min-w-0">
                          <span className="md:hidden text-xs font-bold text-slate-400 tabular-nums shrink-0">#{idx + 1}</span>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm block truncate">{item.student.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono tabular-nums">{item.student.id}</span>
                          </div>
                        </div>
                        {activeTab === 'recap' && (
                          <span className={`md:hidden px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${passed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                            {passed ? 'ناجح' : 'راسب'}
                          </span>
                        )}
                      </div>

                      {activeTab !== 'recap' ? (
                        <>
                          <div className="w-full md:col-span-4 flex items-end md:items-center gap-2">
                            {isDirect ? (
                              <ScoreInput 
                                label="الدرجة النهائية"
                                value={uas}
                                max={100}
                                onChange={(val) => handleGradeChange(item.student.id, activeTab === 'sem1' ? 'sem1_uas' : 'sem2_uas', val)}
                                disabled={isLocked}
                                highlight={true}
                                rowIndex={idx}
                                colKey="uas"
                              />
                            ) : (
                              <div className="grid grid-cols-2 gap-2 w-full">
                                <ScoreInput 
                                  label="النصفي (20)"
                                  value={uts}
                                  max={20}
                                  onChange={(val) => handleGradeChange(item.student.id, activeTab === 'sem1' ? 'sem1_uts' : 'sem2_uts', val)}
                                  disabled={isLocked}
                                  rowIndex={idx}
                                  colKey="uts"
                                />
                                <ScoreInput 
                                  label="النهائي (80)"
                                  value={uas}
                                  max={80}
                                  onChange={(val) => handleGradeChange(item.student.id, activeTab === 'sem1' ? 'sem1_uas' : 'sem2_uas', val)}
                                  disabled={isLocked}
                                  rowIndex={idx}
                                  colKey="uas"
                                />
                              </div>
                            )}

                            <div className="md:hidden flex flex-col items-center justify-center min-w-[56px] h-9 bg-slate-50 rounded-lg px-2 border border-slate-200 shrink-0">
                              <span className="text-[8px] text-slate-400 font-bold leading-none">المجموع</span>
                              <span className={`text-xs font-extrabold tabular-nums leading-tight mt-0.5 ${total < 60 ? 'text-red-600' : 'text-emerald-700'}`}>{total}</span>
                            </div>
                          </div>

                          <div className="hidden md:flex col-span-3 items-center justify-center gap-2">
                            <span className={`text-sm font-extrabold tabular-nums ${total < 60 ? 'text-red-600' : 'text-emerald-700'}`}>
                              {total}
                            </span>
                            {isDirect && <span className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 font-bold">مباشر</span>}
                          </div>
                        </>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 w-full md:contents">
                          <div className="col-span-1 md:col-span-2 text-center bg-slate-50 md:bg-transparent rounded-lg p-1.5 md:p-0">
                            <span className="text-[9px] text-slate-400 block md:hidden">الأول</span>
                            <span className="font-extrabold text-slate-700 text-xs md:text-sm tabular-nums">{sem1Total}</span>
                          </div>
                          <div className="col-span-1 md:col-span-2 text-center bg-slate-50 md:bg-transparent rounded-lg p-1.5 md:p-0">
                            <span className="text-[9px] text-slate-400 block md:hidden">الثاني</span>
                            <span className="font-extrabold text-slate-700 text-xs md:text-sm tabular-nums">{sem2Total}</span>
                          </div>
                          <div className="col-span-1 md:col-span-2 text-center bg-emerald-50 md:bg-transparent rounded-lg p-1.5 md:p-0">
                            <span className="text-[9px] text-emerald-700 block md:hidden">المعدل</span>
                            <span className="font-extrabold text-emerald-800 text-xs md:text-sm tabular-nums">{finalAvg.toFixed(1)}</span>
                          </div>
                          <div className="hidden md:block col-span-3 md:col-span-1 text-center">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${passed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                              {passed ? 'ناجح' : 'راسب'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* STICKY FOOTER BAR */}
          {activeTab === 'remidi' ? (
            <div className="sticky bottom-0 left-0 right-0 p-3 sm:p-3.5 bg-white/95 backdrop-blur-md border-t border-slate-200 z-30">
              <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
                <div className="text-xs text-slate-500 hidden sm:block">
                  {!remidiSettings.isInputOpen ? (
                    <span className="text-amber-700 font-bold">رصد التكميلي مغلق من قبل الإدارة.</span>
                  ) : !isRemidiSubmitted ? (
                    <span className="text-emerald-800 font-bold">أدخل درجات التكميلي ثم اضغط على حفظ.</span>
                  ) : hasRemidiEditPermission ? (
                    <span className="text-emerald-700 font-bold">التعديل متاح حالياً، احفظ التغييرات بعد الانتهاء.</span>
                  ) : (
                    <span className="text-slate-600">السجل مقفل، يمكنك تقديم طلب تعديل للإدارة.</span>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {!remidiSettings.isInputOpen ? (
                    <div className="w-full sm:w-auto text-center px-4 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold border border-slate-200">
                      مغلق
                    </div>
                  ) : !isRemidiSubmitted ? (
                    <button
                      onClick={() => handleSaveRemidi(false)}
                      disabled={savingRemidi || remidiRecords.length === 0}
                      className="w-full sm:w-auto bg-[#064E3B] hover:bg-emerald-800 text-white font-extrabold py-2.5 px-6 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-xs whitespace-nowrap disabled:opacity-50"
                    >
                      {savingRemidi ? <span>جاري الحفظ...</span> : <span>حفظ</span>}
                    </button>
                  ) : hasRemidiEditPermission ? (
                    <button
                      onClick={() => handleSaveRemidi(true)}
                      disabled={savingRemidi || remidiRecords.length === 0}
                      className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 px-6 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-xs whitespace-nowrap"
                    >
                      {savingRemidi ? <span>جاري الحفظ...</span> : <span>حفظ التعديل</span>}
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowEditModal(true)}
                      className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-2.5 px-6 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-xs whitespace-nowrap"
                    >
                      <span>طلب تعديل</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab !== 'recap' && (
            <div className="sticky bottom-0 left-0 right-0 p-3 sm:p-3.5 bg-white/95 backdrop-blur-md border-t border-slate-200 z-30">
              <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
                <div className="text-xs text-slate-500 hidden sm:block">
                  {!isSemActive ? (
                    <span className="text-amber-700 font-bold">الفصل مغلق من قبل الإدارة.</span>
                  ) : !isSubmitted ? (
                    <span className="text-emerald-800 font-bold">أدخل درجات جميع الطلاب ثم اضغط حفظ.</span>
                  ) : hasEditPermission ? (
                    <span className="text-emerald-700 font-bold">التعديل متاح، اضغط حفظ التعديل عند الانتهاء.</span>
                  ) : (
                    <span className="text-slate-600">السجل مقفل، يمكنك تقديم طلب تعديل للإدارة.</span>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {!isSemActive ? (
                    <div className="w-full sm:w-auto text-center px-4 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold border border-slate-200">
                      مغلق
                    </div>
                  ) : !isSubmitted ? (
                    <button 
                      onClick={handleSaveInitial}
                      disabled={saving}
                      className="w-full sm:w-auto bg-[#064E3B] hover:bg-emerald-800 text-white font-extrabold py-2.5 px-6 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-xs whitespace-nowrap"
                    >
                      {saving ? <span>جاري الحفظ...</span> : <span>حفظ</span>}
                    </button>
                  ) : hasEditPermission ? (
                    <button 
                      onClick={handleSaveEdited}
                      disabled={saving}
                      className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 px-6 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-xs whitespace-nowrap"
                    >
                      {saving ? <span>جاري الحفظ...</span> : <span>حفظ التعديل</span>}
                    </button>
                  ) : (
                    <button 
                      onClick={() => setShowEditModal(true)}
                      className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-2.5 px-6 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-xs whitespace-nowrap"
                    >
                      <span>طلب تعديل</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* EDIT REQUEST MODAL */}
          {showEditModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs" dir="rtl">
              <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200">
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                  <h3 className="text-base font-extrabold text-slate-900">طلب إذن تعديل الدرجات</h3>
                  <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                <div className="mt-4 space-y-3.5">
                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/70 text-xs space-y-2">
                    <div className="flex justify-between"><span className="text-slate-500">المقرر:</span><span className="font-bold text-slate-900">{selectedSubject.subjectName}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">الفصل:</span><span className="font-bold text-slate-800">{selectedSubject.className}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">النوع:</span><span className="font-bold text-slate-800">{activeTab === 'remidi' ? 'الاختبار التكميلي' : currentSem === 1 ? 'الفصل الأول' : 'الفصل الثاني'}</span></div>
                    <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/70">
                      <span className="text-slate-500">الحالة:</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                        !activeRequest ? 'bg-slate-200 text-slate-700' :
                        activeRequest.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                        activeRequest.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                        activeRequest.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                        'bg-slate-200 text-slate-700'
                      }`}>
                        {!activeRequest ? 'جديد' :
                         activeRequest.status === 'PENDING' ? 'قيد المراجعة' :
                         activeRequest.status === 'APPROVED' ? 'مقبول' :
                         activeRequest.status === 'REJECTED' ? 'مرفوض' : 'مكتمل'}
                      </span>
                    </div>
                  </div>

                  {(!activeRequest || activeRequest.status === 'REJECTED' || activeRequest.status === 'COMPLETED') && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">سبب التعديل</label>
                      <textarea 
                        value={requestNotes}
                        onChange={(e) => setRequestNotes(e.target.value)}
                        placeholder="اكتب سبب طلب فتح التعديل..."
                        className="w-full h-20 p-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-[#064E3B] outline-none"
                      />
                    </div>
                  )}

                  <a 
                    href={whatsappUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={() => setWhatsappClicked(true)}
                    className="w-full bg-[#25D366] hover:bg-[#20ba59] text-white font-extrabold py-2.5 px-4 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 text-xs"
                  >
                    <span>إشعار الإدارة عبر واتساب</span>
                  </a>
                </div>

                <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button 
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                  >
                    إغلاق
                  </button>

                  {(!activeRequest || activeRequest.status === 'REJECTED' || activeRequest.status === 'COMPLETED') && (
                    <button 
                      onClick={handleSubmitRequest}
                      disabled={submittingRequest || !whatsappClicked}
                      title={!whatsappClicked ? 'يرجى مراسلة الإدارة عبر واتساب أولاً' : ''}
                      className="bg-[#064E3B] hover:bg-emerald-800 text-white px-5 py-2 rounded-xl font-extrabold text-xs shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {submittingRequest ? 'جاري الإرسال...' : 'إرسال الطلب'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LecturerDashboard;
