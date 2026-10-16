import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { PageLoading } from './components/ui/index'

// Layouts
import AdminLayout from './components/layout/AdminLayout'
import StudentLayout from './components/layout/StudentLayout'

// Auth
import LoginPage from './pages/auth/LoginPage'

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminStudents from './pages/admin/AdminStudents'
import AdminStudentRegister from './pages/admin/AdminStudentRegister'
import AdminClasses from './pages/admin/AdminClasses'
import AdminClassDetail from './pages/admin/AdminClassDetail'
import AdminSubjects from './pages/admin/AdminSubjects'
import AdminSubjectDetail from './pages/admin/AdminSubjectDetail'
import AdminTeachers from './pages/admin/AdminTeachers'
import AdminSettings from './pages/admin/AdminSettings'
import AdminGames from './pages/admin/AdminGames'

// Teacher Pages
import TeacherDashboard from './pages/teacher/TeacherDashboard'
import TeacherAssignments from './pages/teacher/TeacherAssignments'
import TeacherAssignmentCreate from './pages/teacher/TeacherAssignmentCreate'
import TeacherAssignmentDetail from './pages/teacher/TeacherAssignmentDetail'
import TeacherGradebookPrint from './pages/teacher/TeacherGradebookPrint'
import TeacherSubmissions from './pages/teacher/TeacherSubmissions'
import TeacherSubmissionReview from './pages/teacher/TeacherSubmissionReview'
import TeacherMessages from './pages/teacher/TeacherMessages'
import TeacherGradebook from './pages/teacher/TeacherGradebook'
import TeacherGames from './pages/teacher/TeacherGames'
import TeacherReports from './pages/teacher/TeacherReports'

// Student Pages
import StudentDashboard from './pages/student/StudentDashboard'
import StudentAssignments from './pages/student/StudentAssignments'
import StudentAssignmentDetail from './pages/student/StudentAssignmentDetail'
import StudentPoints from './pages/student/StudentPoints'
import StudentGrades from './pages/student/StudentGrades'
import StudentMessages from './pages/student/StudentMessages'
import StudentGames from './pages/student/StudentGames'
import StudentGamePlay from './pages/student/StudentGamePlay'
import StudentProfile from './pages/student/StudentProfile'
import StudentNotifications from './pages/student/StudentNotifications'
import StudentCalendar from './pages/student/StudentCalendar'

import AdminNotifications from './pages/admin/AdminNotifications'
import TeacherNotifications from './pages/teacher/TeacherNotifications'

// Kiosk
import KioskPage from './pages/kiosk/KioskPage'

// ============================================================
// Route Guards
// ============================================================

function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode
  allowedRoles: string[]
}) {
  const { isAuthenticated, isLoading, role } = useAuth()

  if (isLoading) return <PageLoading message="กำลังตรวจสอบสิทธิ์..." />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (role && !allowedRoles.includes(role)) {
    // Redirect to appropriate dashboard
    switch (role) {
      case 'SUPER_ADMIN': return <Navigate to="/admin/dashboard" replace />
      case 'TEACHER': return <Navigate to="/admin/dashboard" replace />
      case 'STUDENT': return <Navigate to="/student/dashboard" replace />
      case 'KIOSK': return <Navigate to="/kiosk" replace />
      default: return <Navigate to="/login" replace />
    }
  }
  return <>{children}</>
}

function RootRedirect() {
  const { isAuthenticated, isLoading, role } = useAuth()
  if (isLoading) return <PageLoading />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  switch (role) {
    case 'SUPER_ADMIN': return <Navigate to="/admin/dashboard" replace />
    case 'TEACHER': return <Navigate to="/admin/dashboard" replace />
    case 'STUDENT': return <Navigate to="/student/dashboard" replace />
    case 'KIOSK': return <Navigate to="/kiosk" replace />
    default: return <Navigate to="/login" replace />
  }
}

function AppRoutes() {
  return (
    <Routes>
      {/* Root */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />

      {/* ======================== ADMIN ======================== */}
      <Route path="/admin/*" element={
        <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'TEACHER']}>
          <AdminLayout>
            <Routes>
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="students" element={<AdminStudents />} />
              <Route path="students/register" element={<AdminStudentRegister />} />
              <Route path="classes" element={<AdminClasses />} />
              <Route path="classes/:id" element={<AdminClassDetail />} />
              <Route path="subjects" element={<AdminSubjects />} />
              <Route path="subjects/:id" element={<AdminSubjectDetail />} />
              <Route path="teachers" element={<AdminTeachers />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="games" element={<AdminGames />} />
              <Route path="notifications" element={<AdminNotifications />} />
              <Route path="assignments" element={<TeacherAssignments />} />
              <Route path="assignments/create" element={<TeacherAssignmentCreate />} />
              <Route path="assignments/:id" element={<TeacherAssignmentDetail />} />
              <Route path="submissions" element={<TeacherSubmissions />} />
              <Route path="submissions/:id" element={<TeacherSubmissionReview />} />
              <Route path="messages" element={<TeacherMessages />} />
              <Route path="gradebook" element={<TeacherGradebook />} />
              <Route path="reports" element={<TeacherReports />} />
              <Route path="*" element={<Navigate to="dashboard" replace />} />
            </Routes>
          </AdminLayout>
        </ProtectedRoute>
      } />

      {/* ======================== PRINT VIEW ======================== */}
      <Route path="/admin/print/gradebook" element={
        <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'TEACHER']}>
          <TeacherGradebookPrint />
        </ProtectedRoute>
      } />

      {/* ======================== STUDENT ======================== */}
      <Route path="/student/*" element={
        <ProtectedRoute allowedRoles={['STUDENT', 'SUPER_ADMIN']}>
          <StudentLayout>
            <Routes>
              <Route path="dashboard" element={<StudentDashboard />} />
              <Route path="assignments" element={<StudentAssignments />} />
              <Route path="assignments/:id" element={<StudentAssignmentDetail />} />
              <Route path="points" element={<StudentPoints />} />
              <Route path="grades" element={<StudentGrades />} />
              <Route path="messages" element={<StudentMessages />} />
              <Route path="games" element={<StudentGames />} />
              <Route path="games/:id/play" element={<StudentGamePlay />} />
              <Route path="profile" element={<StudentProfile />} />
              <Route path="notifications" element={<StudentNotifications />} />
              <Route path="calendar" element={<StudentCalendar />} />
              <Route path="*" element={<Navigate to="dashboard" replace />} />
            </Routes>
          </StudentLayout>
        </ProtectedRoute>
      } />

      {/* ======================== KIOSK ======================== */}
      <Route path="/kiosk" element={<KioskPage />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <AppRoutes />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
