import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardLayout } from './layouts/DashboardLayout';
import { ComingSoon } from './pages/ComingSoon';

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

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route
              path="/"
              element={
                <DashboardLayout>
                  <Dashboard />
                </DashboardLayout>
              }
            />
            <Route
              path="/attendance"
              element={
                <DashboardLayout>
                  <ComingSoon title="Attendance" />
                </DashboardLayout>
              }
            />
            <Route
              path="/students"
              element={
                <DashboardLayout>
                  <ComingSoon title="Students" />
                </DashboardLayout>
              }
            />
            <Route
              path="/reports"
              element={
                <DashboardLayout>
                  <ComingSoon title="Reports" />
                </DashboardLayout>
              }
            />
            <Route
              path="/settings"
              element={
                <DashboardLayout>
                  <ComingSoon title="Settings" />
                </DashboardLayout>
              }
            />
          </Route>

          {/* Fallback Route */}
          <Route path="*" element={<Login />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
