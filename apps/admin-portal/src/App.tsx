import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import srRS from 'antd/locale/sr_RS';
import { AuthGuard } from './components/guards/AuthGuard';
import { PermissionGuard } from './components/guards/PermissionGuard';
import ModernMenu from './components/layout/ModernMenu';
import { LoginPage } from './pages/LoginPage';
import UserAdministration from './pages/users/UserAdministration';
import RolesPermissions from './pages/users/RolesPermissions';
import UserGroups from './pages/users/UserGroups';
import GeneralSettings from './pages/settings/GeneralSettings';
import ApiKeys from './pages/settings/ApiKeys';
import Vehicles from './pages/transport/Vehicles';
import VehicleSync from './pages/transport/VehicleSync';
import MapVehiclesModern from './pages/transport/dispatcher/MapVehiclesModern';
import VehicleAnalytics from './pages/transport/dispatcher/VehicleAnalytics';
import GpsSync from './pages/transport/dispatcher/GpsSync';
import GpsSyncDashboard from './pages/transport/dispatcher/GpsSyncDashboard';
import DriverCard from './pages/transport/dispatcher/DriverCard';
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
      <AntApp>
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
                <ModernMenu />
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
                <PermissionGuard permissions={['users.administration:view']}>
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
              path="users/groups"
              element={
                <PermissionGuard permissions={['users.groups:view']}>
                  <UserGroups />
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
              element={<GeneralSettings />}
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
                  <MapVehiclesModern />
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
                <PermissionGuard permissions={['dispatcher.sync:view']}>
                  <GpsSync />
                </PermissionGuard>
              }
            />

            <Route
              path="transport/dispatcher/driver-card"
              element={
                <PermissionGuard permissions={['dispatcher.driver_card:view']}>
                  <DriverCard />
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
                <PermissionGuard permissions={['system:view']}>
                  <MigrationPage />
                </PermissionGuard>
              }
            />
          </Route>
        </Routes>
      </Router>
      </AntApp>
    </ConfigProvider>
  );
}

export default App
