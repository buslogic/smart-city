import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import srRS from 'antd/locale/sr_RS';
import { AuthGuard } from './components/guards/AuthGuard';
import { PermissionGuard } from './components/guards/PermissionGuard';
import MainLayout from './components/layout/MainLayout';
import { LoginPage } from './pages/LoginPage';
import UserAdministration from './pages/users/UserAdministration';
import RolesPermissions from './pages/users/RolesPermissions';
import GeneralSettings from './pages/settings/GeneralSettings';
import Vehicles from './pages/transport/Vehicles';
import VehicleSync from './pages/transport/VehicleSync';
import MapVehicles from './pages/transport/dispatcher/MapVehicles';
import VehicleAnalytics from './pages/transport/dispatcher/VehicleAnalytics';

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
                <MainLayout />
              </AuthGuard>
            }
          >
            <Route index element={<Navigate to="/users/administration" replace />} />
            
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
          </Route>
        </Routes>
      </Router>
    </ConfigProvider>
  );
}

export default App
