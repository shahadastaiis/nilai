
import Swal from 'sweetalert2';

const baseBtnStyle = 'px-6 py-2.5 rounded-xl font-bold text-sm mx-2';

// Base Configuration to match "Clean Islamic Modernism"
const swalConfig = Swal.mixin({
  customClass: {
    popup: 'rounded-3xl shadow-2xl',
    confirmButton: baseBtnStyle,
    cancelButton: baseBtnStyle,
  },
  buttonsStyling: false,
  reverseButtons: true, // RTL Preference
});

/**
 * Toast Notification (Auto-close)
 * Use for: Success messages after save/update
 */
export const showSuccess = (message: string = 'تم حفظ البيانات في النظام') => {
  return swalConfig.fire({
    icon: 'success',
    title: 'تمت العملية بنجاح',
    text: message,
    toast: true,
    position: 'top-start', // RTL: Top Left
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    background: '#ffffff',
    iconColor: '#064E3B', // Emerald
    color: '#1F2937',
  });
};

/**
 * Error Toast
 * Use for: API errors or validation failures
 */
export const showError = (message: string = 'حدث خطأ غير متوقع') => {
  return swalConfig.fire({
    icon: 'error',
    title: 'خطأ',
    text: message,
    toast: true,
    position: 'top-start',
    showConfirmButton: false,
    timer: 4000,
    timerProgressBar: true,
    iconColor: '#EF4444',
  });
};

/**
 * Delete Confirmation Modal
 * Use for: Deleting Users, Subjects, etc.
 */
export const confirmDelete = async (
  title: string = 'هل أنت متأكد؟',
  text: string = 'لن تتمكن من استعادة هذه البيانات بعد الحذف!'
): Promise<boolean> => {
  const result = await swalConfig.fire({
    title: title,
    text: text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'نعم، احذف',
    cancelButtonText: 'إلغاء',
    customClass: {
      popup: 'rounded-3xl shadow-2xl',
      confirmButton: `${baseBtnStyle} bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30 transition-all`,
      cancelButton: `${baseBtnStyle} bg-gray-100 hover:bg-gray-200 text-gray-600`
    },
    iconColor: '#F59E0B', // Amber/Yellow
    focusConfirm: false, // Moved here (Safe for Modals)
  });

  return result.isConfirmed;
};

/**
 * Action Confirmation (Generic)
 * Use for: Finalizing grades, updating critical info
 */
export const confirmAction = async (
  title: string,
  text: string,
  confirmBtnText: string = 'نعم، تابع',
  isDangerous: boolean = false
): Promise<boolean> => {
  const confirmColorClass = isDangerous 
      ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30 transition-all'
      : 'bg-[#064E3B] hover:bg-emerald-800 text-white shadow-lg shadow-emerald-900/20 transition-all';

  const result = await swalConfig.fire({
    title: title,
    text: text,
    icon: 'info',
    showCancelButton: true,
    confirmButtonText: confirmBtnText,
    cancelButtonText: 'تراجع',
    customClass: {
      popup: 'rounded-3xl shadow-2xl',
      confirmButton: `${baseBtnStyle} ${confirmColorClass}`,
      cancelButton: `${baseBtnStyle} bg-gray-100 hover:bg-gray-200 text-gray-600`
    },
    iconColor: isDangerous ? '#EF4444' : '#064E3B', // Emerald for Info
    focusConfirm: false, // Moved here (Safe for Modals)
  });

  return result.isConfirmed;
};
