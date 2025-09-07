import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import srRS from 'antd/locale/sr_RS';
import { AuthGuard } from './components/guards/AuthGuard';
import { PermissionGuard } from './components/guards/PermissionGuard';
import MainLayout from './components/layout/MainLayout';
import MainLayoutEnhanced from './components/layout/MainLayoutEnhanced';
import MainLayoutV3 from './components/layout/MainLayoutV3';
import ModernMenuV1 from './components/layout/ModernMenuV1';
import { LoginPage } from './pages/LoginPage';
import UserAdministration from './pages/users/UserAdministration';
import RolesPermissions from './pages/users/RolesPermissions';
import GeneralSettings from './pages/settings/GeneralSettings';
import Vehicles from './pages/transport/Vehicles';
import VehicleSync from './pages/transport/VehicleSync';
import MapVehicles from './pages/transport/dispatcher/MapVehicles';
import VehicleAnalytics from './pages/transport/dispatcher/VehicleAnalytics';
import GpsSync from './pages/transport/dispatcher/GpsSync';
import GpsSyncDashboard from './pages/transport/dispatcher/GpsSyncDashboard';
import AggressiveDriving from './pages/transport/safety/AggressiveDriving';
import MonthlyReport from './pages/transport/safety/MonthlyReport';
import { LegacySyncPage } from './pages/legacy-sync/LegacySyncPage';
import Profile from './pages/users/Profile';
import DashboardPage from './pages/dashboard/DashboardPage';

function App() {
  return (
    <ConfigProvider locale={srRS}>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          
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
                <PermissionGuard permissions={['dashboard.view']}>
                  <DashboardPage />
                </PermissionGuard>
              } 
            />
            
            <Route 
              path="users/administration" 
              element={
                <PermissionGuard permissions={['users:read']}>
                  <UserAdministration />
                </PermissionGuard>
              } 
            />
            
            <Route 
              path="users/roles-permissions" 
              element={
                <PermissionGuard permissions={['roles:read']}>
                  <RolesPermissions />
                </PermissionGuard>
              } 
            />
            
            <Route 
              path="users/profile" 
              element={<Profile />} 
            />
            
            <Route 
              path="settings/general" 
              element={
                <PermissionGuard permissions={['settings:general:read']}>
                  <GeneralSettings />
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
                <PermissionGuard permissions={['vehicles:sync']}>
                  <VehicleSync />
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
                <PermissionGuard permissions={['legacy_sync.view']}>
                  <LegacySyncPage />
                </PermissionGuard>
              } 
            />
            
            <Route 
              path="transport/safety/aggressive-driving" 
              element={
                <PermissionGuard permissions={['safety:view_aggressive']}>
                  <AggressiveDriving />
                </PermissionGuard>
              } 
            />
            
            <Route 
              path="transport/safety/monthly-report" 
              element={
                <PermissionGuard permissions={['safety:view_report']}>
                  <MonthlyReport />
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
