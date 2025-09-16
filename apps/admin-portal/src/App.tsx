import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import srRS from 'antd/locale/sr_RS';
import { AuthGuard } from './components/guards/AuthGuard';
import { PermissionGuard } from './components/guards/PermissionGuard';
import ModernMenuV1 from './components/layout/ModernMenuV1';
import { LoginPage } from './pages/LoginPage';
import UserAdministration from './pages/users/UserAdministration';
import RolesPermissions from './pages/users/RolesPermissions';
import GeneralSettings from './pages/settings/GeneralSettings';
import ApiKeys from './pages/settings/ApiKeys';
import Vehicles from './pages/transport/Vehicles';
import VehicleSync from './pages/transport/VehicleSync';
import MapVehicles from './pages/transport/dispatcher/MapVehicles';
import VehicleAnalytics from './pages/transport/dispatcher/VehicleAnalytics';
import GpsSync from './pages/transport/dispatcher/GpsSync';
import GpsSyncDashboard from './pages/transport/dispatcher/GpsSyncDashboard';
import AggressiveDriving from './pages/transport/safety/AggressiveDriving';
import MonthlyReport from './pages/transport/safety/MonthlyReport';
import DataRecreation from './pages/transport/safety/DataRecreation';
import { LegacySyncPage } from './pages/legacy-sync/LegacySyncPage';
import Profile from './pages/users/Profile';
import ChangePassword from './pages/users/ChangePassword';
import DashboardPage from './pages/dashboard/DashboardPage';
import TimescaleDB from './pages/transport/maintenance/TimescaleDB';
import MigrationPage from './pages/migration/MigrationPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';

function App() {
  return (
    <ConfigProvider locale={srRS}>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          
          {/* Protected routes */}
          <Route 
            path="/" 
            element={
              <AuthGuard>
                <ModernMenuV1 />
              </AuthGuard>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            
            <Route 
              path="dashboard" 
              element={
                <PermissionGuard permissions={['dashboard:view']}>
                  <DashboardPage />
                </PermissionGuard>
              } 
            />
            
            <Route 
              path="users/administration" 
              element={
                <PermissionGuard permissions={['users:view']}>
                  <UserAdministration />
                </PermissionGuard>
              } 
            />
            
            <Route 
              path="users/roles-permissions" 
              element={
                <PermissionGuard permissions={['roles:view']}>
                  <RolesPermissions />
                </PermissionGuard>
              } 
            />
            
            <Route
              path="users/profile"
              element={<Profile />}
            />

            <Route
              path="users/change-password"
              element={<ChangePassword />}
            />
            
            <Route 
              path="settings/general" 
              element={
                <PermissionGuard permissions={['settings.general:view']}>
                  <GeneralSettings />
                </PermissionGuard>
              } 
            />
            
            <Route 
              path="settings/api-keys" 
              element={
                <PermissionGuard permissions={['api_keys:view']}>
                  <ApiKeys />
                </PermissionGuard>
              } 
            />
            
            <Route 
              path="transport/vehicles" 
              element={
                <PermissionGuard permissions={['vehicles:read']}>
                  <Vehicles />
                </PermissionGuard>
              } 
            />
            
            <Route 
              path="transport/vehicle-sync" 
              element={
                <PermissionGuard permissions={['vehicles.sync:view']}>
                  <VehicleSync />
                </PermissionGuard>
              } 
            />
            
            <Route 
              path="transport/gps-buffer-status" 
              element={
                <PermissionGuard permissions={['dispatcher:sync_gps']}>
                  <GpsSyncDashboard />
                </PermissionGuard>
              } 
            />
            
            <Route 
              path="transport/dispatcher/map-vehicles" 
              element={
                <PermissionGuard permissions={['dispatcher:view_map']}>
                  <MapVehicles />
                </PermissionGuard>
              } 
            />
            
            <Route 
              path="transport/dispatcher/analytics" 
              element={
                <PermissionGuard permissions={['dispatcher:view_analytics']}>
                  <VehicleAnalytics />
                </PermissionGuard>
              } 
            />
            
            <Route 
              path="transport/dispatcher/gps-sync" 
              element={
                <PermissionGuard permissions={['dispatcher:sync_gps']}>
                  <GpsSync />
                </PermissionGuard>
              } 
            />

            <Route 
              path="transport/dispatcher/gps-sync-dashboard" 
              element={
                <PermissionGuard permissions={['dispatcher:view_sync_dashboard']}>
                  <GpsSyncDashboard />
                </PermissionGuard>
              } 
            />

            <Route 
              path="transport/legacy-sync" 
              element={
                <PermissionGuard permissions={['legacy.sync:view']}>
                  <LegacySyncPage />
                </PermissionGuard>
              } 
            />
            
            <Route 
              path="transport/safety/aggressive-driving" 
              element={
                <PermissionGuard permissions={['safety.aggressive.driving:view']}>
                  <AggressiveDriving />
                </PermissionGuard>
              } 
            />
            
            <Route 
              path="transport/safety/monthly-report" 
              element={
                <PermissionGuard permissions={['safety.reports:view']}>
                  <MonthlyReport />
                </PermissionGuard>
              } 
            />

            <Route 
              path="transport/safety/data-recreation" 
              element={
                <PermissionGuard permissions={['safety.data.recreation:view']}>
                  <DataRecreation />
                </PermissionGuard>
              } 
            />
            
            <Route
              path="transport/maintenance/timescaledb"
              element={
                <PermissionGuard permissions={['maintenance.timescaledb:view']}>
                  <TimescaleDB />
                </PermissionGuard>
              }
            />

            <Route
              path="migration"
              element={
                <PermissionGuard permissions={['system.manage']}>
                  <MigrationPage />
                </PermissionGuard>
              }
            />
          </Route>
        </Routes>
      </Router>
    </ConfigProvider>
  );
}

export default App
