import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Login } from './pages/Login';
import { ResetPassword } from './pages/ResetPassword';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardLayout } from './layouts/DashboardLayout';
import { ComingSoon } from './pages/ComingSoon';
import { Settings } from './pages/Settings';
import { RootRedirect } from './components/RootRedirect';

// Dashboard imports
import { AdminDashboard } from './pages/dashboards/AdminDashboard';
import { ProgramLeaderDashboard } from './pages/dashboards/ProgramLeaderDashboard';
import { FacultyDashboard } from './pages/dashboards/FacultyDashboard';
import { StudentDashboard } from './pages/dashboards/StudentDashboard';
import { ParentDashboard } from './pages/dashboards/ParentDashboard';
import { DataUpload } from './pages/dashboards/DataUpload';
import { PLTimetable } from './pages/dashboards/PLTimetable';
import { TakeAttendance } from './pages/dashboards/TakeAttendance';


// Create TanStack Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Root Redirect handler (Protected) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<RootRedirect />} />
            
            {/* Common protected views like Settings */}
            <Route
              path="/settings"
              element={
                <DashboardLayout>
                  <Settings />
                </DashboardLayout>
              }
            />
          </Route>

          {/* Admin Protected Routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route
              path="/admin"
              element={
                <DashboardLayout>
                  <AdminDashboard />
                </DashboardLayout>
              }
            />
            <Route
              path="/upload"
              element={
                <DashboardLayout>
                  <DataUpload />
                </DashboardLayout>
              }
            />
          </Route>

          {/* Program Leader Protected Routes */}
          <Route element={<ProtectedRoute allowedRoles={['program_leader']} />}>
            <Route
              path="/pl"
              element={
                <DashboardLayout>
                  <ProgramLeaderDashboard />
                </DashboardLayout>
              }
            />
            <Route
              path="/pl/timetable"
              element={
                <DashboardLayout>
                  <PLTimetable />
                </DashboardLayout>
              }
            />
          </Route>

          {/* Faculty Protected Routes */}
          <Route element={<ProtectedRoute allowedRoles={['faculty']} />}>
            <Route
              path="/faculty"
              element={
                <DashboardLayout>
                  <FacultyDashboard />
                </DashboardLayout>
              }
            />
            <Route
              path="/attendance"
              element={
                <DashboardLayout>
                  <TakeAttendance />
                </DashboardLayout>
              }
            />
          </Route>

          {/* Student Protected Routes */}
          <Route element={<ProtectedRoute allowedRoles={['student']} />}>
            <Route
              path="/student"
              element={
                <DashboardLayout>
                  <StudentDashboard />
                </DashboardLayout>
              }
            />
            <Route
              path="/my-attendance"
              element={
                <DashboardLayout>
                  <ComingSoon title="My Attendance" />
                </DashboardLayout>
              }
            />
          </Route>

          {/* Parent Protected Routes */}
          <Route element={<ProtectedRoute allowedRoles={['parent']} />}>
            <Route
              path="/parent"
              element={
                <DashboardLayout>
                  <ParentDashboard />
                </DashboardLayout>
              }
            />
          </Route>

          {/* Fallback Route */}
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
