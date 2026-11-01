
import React from 'react';

export enum Role {
  STUDENT = 'STUDENT',
  LECTURER = 'LECTURER',
  ADMIN = 'ADMIN',
  ADMIN_PUTRI = 'ADMIN_PUTRI'
}

export enum GradeStatus {
  DRAFT = 'DRAFT',         // Lecturer can edit
  SUBMITTED = 'SUBMITTED', // Locked for Lecturer, waiting Admin
  PUBLISHED = 'PUBLISHED'  // Visible to Student
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE', // Soft Deleted
  ALUMNI = 'ALUMNI',
  DROP_OUT = 'DROP_OUT'
}

// --- NAVIGATION TYPES ---
export type NavGroup = 'dashboard' | 'master' | 'academic' | 'settings';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  group: NavGroup;
}

// --- MASTER DATA ---
export interface User {
  id: string; // NIY or NIM (Unique Key)
  password?: string;
  name: string;
  role: Role;
  gender: 'MALE' | 'FEMALE';
  status: UserStatus; 
}

export interface MasterSubject {
  id: string; // e.g. "ARB101" (Primary Key / Code)
  name: string; // e.g. "Bahasa Arab I"
  sks: number; // Credit Points
}

// --- PERIOD DATA ---
export interface AcademicYear {
  id: string;
  name: string; // e.g., "1446/1447"
  isActive: boolean;
  startDate: string; // ISO Date for sorting (Newest logic)
  isSem1Active: boolean;
  isSem2Active: boolean;
}

export interface Class {
  id: string;
  academicYearId: string;
  name: string; // e.g. "Mustawa 1 - A"
  gender: 'MALE' | 'FEMALE'; // Added gender segregation
}

// --- MAPPING / TRANSACTIONAL DATA ---

// 1. Student Enrollment (Student -> Class)
export interface StudentEnrollment {
  id: string;
  studentId: string;
  classId: string; // Links to Class (which links to Year)
}

// 2. Class Subject Assignment (Lecturer -> Subject -> Class)
export interface ClassSubject {
  id: string;
  classId: string;
  masterSubjectId: string; // Link to MasterSubject
  lecturerId: string;
  status: GradeStatus; 
}

// 3. Helper View for UI (Joined Data)
export interface SubjectView {
  id: string; // ClassSubject ID
  subjectName: string;
  subjectCode: string;
  sks: number;
  className: string;
  classId: string; // Added for strict filtering
  lecturerId: string;
  academicYearId: string; // Helper for filtering
  status: GradeStatus;
}

export type GradeInputType = 'COMPONENT' | 'DIRECT';

export type EditRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

export interface GradeEditRequest {
  id: string;
  classSubjectId: string;
  lecturerId: string;
  academicYearId: string;
  semester: 1 | 2;
  isRemidi?: boolean; // Permohonan edit khusus nilai remidi
  status: EditRequestStatus;
  requestedAt: string;
  respondedAt?: string;
  notes?: string;
}

export interface GradeRecord {
  enrollmentId: string; // Links Student to Class
  classSubjectId: string; // Links Subject to Class
  sem1_uts: number; // Max 20
  sem1_uas: number; // Max 80
  sem1_input_type?: GradeInputType; // Method used for Sem 1
  sem1_submitted?: boolean; // True once lecturer has saved initial grades
  sem2_uts: number; // Max 20
  sem2_uas: number; // Max 80
  sem2_input_type?: GradeInputType; // Method used for Sem 2
  sem2_submitted?: boolean; // True once lecturer has saved initial grades
}

export interface StudentGradeView {
  subjectName: string;
  subjectCode: string;
  sks: number;
  lecturerName: string;
  sem1_total: number;
  sem2_total: number;
  final_average: number;
  yearName?: string; // For Transcript
  isRepeat?: boolean; // If true, this is an old grade that was repeated
  status: GradeStatus; // Added status field
}

export interface GradeDetail {
  sem1: number;
  sem2: number;
  avg: number;
}

export interface ClassRecapRow {
  student: User;
  grades: { [subjectId: string]: GradeDetail };
  totalScore: number;
  finalAverage: number;
}

export interface ClassRemidiRecapRow extends ClassRecapRow {
  hasRemidi: boolean;
  remidiDetails: {
    [subjectId: string]: {
      isRemidiSem1?: boolean;
      initialSem1?: number;
      pureRemidiSem1?: number;
      isRemidiSem2?: boolean;
      initialSem2?: number;
      pureRemidiSem2?: number;
    };
  };
}

// --- REMIDI / TAKMILI MODULE TYPES ---
export interface RemidiRecord {
  id: string; // Composite key, e.g. REM_{yearId}_{classSubjectId}_{studentId}_{sem}
  academicYearId: string;
  classId: string;
  className: string;
  classSubjectId: string;
  subjectName: string;
  subjectCode: string;
  studentId: string;
  studentName: string;
  gender: 'MALE' | 'FEMALE';
  lecturerId: string;
  lecturerName: string;
  semester: 1 | 2;
  initialScore: number; // Nilai merah (< 60)
  remidiScore?: number; // Nilai ujian remidi (0 - 100)
  studentDisplayScore?: number; // Nilai yang tampil di mahasiswa (maksimal 60 jika lulus)
  isEligible: boolean; // Dicentang / disetujui Admin untuk ikut remidi
  submitted?: boolean; // True jika nilai remidi sudah disimpan / dikunci oleh dosen
  notes?: string;
  updatedAt?: string;
}

export interface RemidiSettings {
  academicYearId: string;
  isInputOpen: boolean; // Akses buka-tutup bagi dosen untuk menginput nilai remidi
  isPublished: boolean; // Publikasi nilai remidi ke mahasiswa
}