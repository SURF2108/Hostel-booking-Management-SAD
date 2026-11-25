import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext.jsx';
import { AppLayout } from './layouts/AppLayout.jsx';
import { LoginPage, RegisterPage } from './pages/AuthPages.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { HostelsPage } from './pages/HostelsPage.jsx';
import { BookingsPage } from './pages/BookingsPage.jsx';
import { AllocationsPage } from './pages/AllocationsPage.jsx';
import { InventoryAdminPage } from './pages/InventoryAdminPage.jsx';
import { UsersAdminPage } from './pages/UsersAdminPage.jsx';
import { ComplaintsPage } from './pages/ComplaintsPage.jsx';
import { VisitorsPage } from './pages/VisitorsPage.jsx';
import { PaymentsPage } from './pages/PaymentsPage.jsx';
import { ReportsPage } from './pages/ReportsPage.jsx';
import { AuditLogsPage } from './pages/AuditLogsPage.jsx';
import { HistoryPage } from './pages/HistoryPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { PermissionDeniedState, SkeletonGrid } from './components/ui/DataStates.jsx';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <SkeletonGrid count={3} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RoleRoute({ allowedRoles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role)) {
    return <PermissionDeniedState role={user.role} />;
  }
  return children;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="hostels" element={<HostelsPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route
              path="allocations"
              element={
                <RoleRoute allowedRoles={['Warden', 'Administrator', 'HostelManagement']}>
                  <AllocationsPage />
                </RoleRoute>
              }
            />
            <Route
              path="admin/inventory"
              element={
                <RoleRoute allowedRoles={['Administrator']}>
                  <InventoryAdminPage />
                </RoleRoute>
              }
            />
            <Route
              path="admin/users"
              element={
                <RoleRoute allowedRoles={['Administrator']}>
                  <UsersAdminPage />
                </RoleRoute>
              }
            />
            <Route
              path="complaints"
              element={
                <RoleRoute
                  allowedRoles={['Student', 'Warden', 'Administrator', 'HostelManagement']}
                >
                  <ComplaintsPage />
                </RoleRoute>
              }
            />
            <Route
              path="visitors"
              element={
                <RoleRoute
                  allowedRoles={['Student', 'Warden', 'Administrator', 'HostelManagement']}
                >
                  <VisitorsPage />
                </RoleRoute>
              }
            />
            <Route
              path="payments"
              element={
                <RoleRoute allowedRoles={['AccountsPersonnel', 'Student', 'HostelManagement']}>
                  <PaymentsPage />
                </RoleRoute>
              }
            />
            <Route
              path="reports"
              element={
                <RoleRoute
                  allowedRoles={['Administrator', 'AccountsPersonnel', 'HostelManagement']}
                >
                  <ReportsPage />
                </RoleRoute>
              }
            />
            <Route
              path="audit-logs"
              element={
                <RoleRoute allowedRoles={['Administrator', 'HostelManagement']}>
                  <AuditLogsPage />
                </RoleRoute>
              }
            />
            <Route
              path="history"
              element={
                <RoleRoute allowedRoles={['Warden', 'Administrator', 'HostelManagement']}>
                  <HistoryPage />
                </RoleRoute>
              }
            />
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
