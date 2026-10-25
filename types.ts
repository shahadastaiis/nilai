
import React from 'react';

export enum Role {
  STUDENT = 'STUDENT',
  LECTURER = 'LECTURER',
  ADMIN = 'ADMIN'
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

export interface GradeRecord {
  enrollmentId: string; // Links Student to Class
  classSubjectId: string; // Links Subject to Class
  sem1_uts: number; // Max 20
  sem1_uas: number; // Max 80
  sem1_input_type?: GradeInputType; // Method used for Sem 1
  sem2_uts: number; // Max 20
  sem2_uas: number; // Max 80
  sem2_input_type?: GradeInputType; // Method used for Sem 2
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