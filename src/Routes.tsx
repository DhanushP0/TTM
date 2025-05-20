import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'
import Login from './components/Auth/Login'
import Signup from './components/Auth/Signup'
import Buildings from './pages/Buildings'
import ClassroomForm from './components/Classrooms/ClassroomForm'
import DepartmentForm from './components/Departments/DepartmentForm'
import FloorForm from './components/Floors/FloorForm'
import Floors from './pages/Floors'
import Classrooms from './pages/Classrooms'
import Departments from './pages/Departments'
import Building from './pages/Buildings'
import Timetable from './pages/Timetable'
import AssignedClasses from './teacher/TeacherDashboard'
import PublicTimetable from './public/PublicTimetable'
import TeacherTimetableForm from './teacher/TeacherTimetableForm'
import SelectBuildingFloorPage from './public/SelectBuildingFloorPage'
import ClassroomDisplayPage from './public/ClassroomDisplayPage'
import PageNotFound from './pages/PageNotFound'
import ForgotPassword from './components/Auth/ForgotPassword'
import ResetPassword from './components/Auth/ResetPassword'
import ConfirmEmail from './components/Auth/ConfirmEmail'
import VerifySignup from './components/Auth/VerifySignup'

export default function AppRoutes() {
  const [session, setSession] = useState<Session | null>(null)
  const [roleId, setRoleId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getSessionAndRole = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)

      if (session?.user.email) {
        const { data, error } = await supabase
          .from('teachers')
          .select('role_id')
          .eq('email', session.user.email)
          .single()

        if (!error && data?.role_id) {
          setRoleId(data.role_id)
        }
      }

      setLoading(false)
    }

    getSessionAndRole()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user.email) {
        supabase
          .from('teachers')
          .select('role_id')
          .eq('email', session.user.email)
          .single()
          .then(({ data, error }) => {
            if (!error && data?.role_id) {
              setRoleId(data.role_id)
            }
          })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  // Helper function to check if user has admin access
  const isAdmin = roleId === 3
  // Helper function to check if user has teacher access
  const isTeacher = roleId === 1 || roleId === 2

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            !session ? (
              <Login />
            ) : isAdmin ? (
              <Navigate to="/timetable" />
            ) : isTeacher ? (
              <Navigate to="/teacher-dashboard" />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/signup"
          element={!session ? <Signup /> : <Navigate to="/login" />}
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/confirm-email" element={<ConfirmEmail />} />
        <Route path="/auth/v1/verify" element={<VerifySignup />} />
        <Route
          path="/public-timetable"
          element={<PublicTimetable />}
        />
        <Route
          path="/select-building-floor"
          element={<SelectBuildingFloorPage />}
        />
        <Route
          path="/classroom-display/"
          element={<ClassroomDisplayPage />}
        />
        {/* Admin Routes - Only accessible by role_id 3 */}
        <Route
          path="/buildings/:id"
          element={session && isAdmin ? <Buildings /> : <Navigate to="/login" />}
        />
        <Route
          path="/classrooms/:id"
          element={
            session && isAdmin ? (
              <ClassroomForm
                onSuccess={() => console.log('Classroom form submitted successfully')}
                onCancel={() => console.log('Classroom form canceled')}
              />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/departments/:id"
          element={
            session && isAdmin ? (
              <DepartmentForm
                onSuccess={() => console.log('Department form submitted successfully')}
                onCancel={() => console.log('Department form canceled')}
              />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/floors/:id"
          element={
            session && isAdmin ? (
              <FloorForm
                onSuccess={() => console.log('Floor form submitted successfully')}
                onCancel={() => console.log('Floor form canceled')}
              />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/"
          element={
            session ? (
              isAdmin ? (
                <Navigate to="/timetable" />
              ) : isTeacher ? (
                <Navigate to="/teacher-dashboard" />
              ) : (
                <Navigate to="/login" />
              )
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        {/* Admin-only pages */}
        <Route
          path="/timetable"
          element={session && isAdmin ? <Timetable /> : <Navigate to="/login" />}
        />
        <Route
          path="/buildings"
          element={session && isAdmin ? <Building /> : <Navigate to="/login" />}
        />
        <Route
          path="/floors"
          element={session && isAdmin ? <Floors /> : <Navigate to="/login" />}
        />
        <Route
          path="/classrooms"
          element={session && isAdmin ? <Classrooms /> : <Navigate to="/login" />}
        />
        <Route
          path="/departments"
          element={session && isAdmin ? <Departments /> : <Navigate to="/login" />}
        />
        {/* Teacher-only routes */}
        <Route
          path="/teacher-dashboard"
          element={session && isTeacher ? <AssignedClasses /> : <Navigate to="/login" />}
        />
        <Route
          path="/teacher-timetable-form"
          element={
            session && isTeacher ? (
              <TeacherTimetableForm
                onSuccess={() => console.log('Teacher timetable form submitted successfully')}
                onCancel={() => console.log('Teacher timetable form canceled')}
              />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/teacher-timetable-form/:id"
          element={
            session && isTeacher ? (
              <TeacherTimetableForm
                onSuccess={() => console.log('Teacher timetable form submitted successfully')}
                onCancel={() => console.log('Teacher timetable form canceled')}
              />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        {/* 404 Page */}
        <Route
          path="*"
          element={
            <PageNotFound />
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
