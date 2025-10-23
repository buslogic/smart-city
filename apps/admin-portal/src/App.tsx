// Trigger deploy - migration 20251022214407 applied
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import srRS from 'antd/locale/sr_RS';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import 'dayjs/locale/sr';
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
import GpsLagTransfer from './pages/transport/vehicles/GpsLagTransfer';
import CentralPoints from './pages/transport/administration/CentralPoints';
import StopsSync from './pages/transport/administration/StopsSync';
import PriceListGroups from './pages/transport/administration/PriceListGroups';
import Lines from './pages/transport/administration/Lines';
import LinesAdministration from './pages/transport/administration/LinesAdministration';
import Variations from './pages/transport/administration/Variations';
import TimetableDates from './pages/transport/administration/TimetableDates';
import TimetableSync from './pages/transport/administration/TimetableSync';
import TurnusiSync from './pages/transport/administration/TurnusiSync';
import Turnusi from './pages/transport/administration/Turnusi';
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
import Schedule from './pages/transport/planning/Schedule';
import SchedulePrint from './pages/transport/planning/SchedulePrint';
import TurnusDefaults from './pages/transport/planning/TurnusDefaults';
import LinkedTurnusi from './pages/transport/planning/LinkedTurnusi';
import MigrationPage from './pages/migration/MigrationPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import WaterMeterTypesPage from './pages/water-meter-types/WaterMeterTypesPage';

// Vodovod pages
import WaterSystemCitiesPage from './pages/WaterSystemCitiesPage';
import WaterSystemStreetsPage from './pages/WaterSystemStreetsPage';
import WaterSystemZonesPage from './pages/WaterSystemZonesPage';
import WaterSystemRegionPage from './pages/WaterSystemRegionPage';
import WaterSystemRegionsPage from './pages/WaterSystemRegionsPage';
import WaterMeterPage from './pages/water-meter/WaterMeterPage';
import WaterMeterManufacturersPage from './pages/WaterMeterManufacturersPage';
import WaterMeterAvailabilityPage from './pages/WaterMeterAvailabilityPage';
import ReplacementWaterMetersPage from './pages/ReplacementWaterMetersPage';
import WaterMeterRemarksPage from './pages/WaterMeterRemarksPage';
import ReviewModifiedWaterMetersPage from './pages/ReviewModifiedWaterMetersPage';
import MeasuringPointsPage from './pages/MeasuringPointsPage';
import MeasuringPointsByAddressPage from './pages/MeasuringPointsByAddressPage';
import MeasuringPointsConsumptionPage from './pages/MeasuringPointsConsumptionPage';
import ReadingsPage from './pages/ReadingsPage';
import ReadingListsPage from './pages/ReadingListsPage';
import ReadingListsDataEntryPage from './pages/ReadingListsDataEntryPage';
import ReadingListsPrintPage from './pages/ReadingListsPrintPage';
import ReadingAnomaliesPage from './pages/ReadingAnomaliesPage';
import WaterReadersPage from './pages/WaterReadersPage';
import WaterServicesPage from './pages/WaterServicesPage';
import ManageWaterServicesPage from './pages/ManageWaterServicesPage';
import WaterServicesPricelistPage from './pages/WaterServicesPricelistPage';
import WaterServicePricelistHistoryPage from './pages/WaterServicePricelistHistoryPage';
import WaterServicesReviewPage from './pages/WaterServicesReviewPage';
import WaterMeterCalculationPage from './pages/WaterMeterCalculationPage';
import BillingCampaignPage from './pages/BillingCampaignPage';
import CampaignPage from './pages/CampaignPage';
import SubCampaignPage from './pages/SubCampaignPage';
import InputCalculationStatePage from './pages/InputCalculationStatePage';
import PaymentsPage from './pages/PaymentsPage';
import PaymentsByPaymentMethodPage from './pages/PaymentsByPaymentMethodPage';
import CashRegisterPage from './pages/CashRegisterPage';
import CashiersPage from './pages/CashiersPage';
import CashiersSessionPage from './pages/CashiersSessionPage';
import CashRegisterReportPage from './pages/CashRegisterReportPage';
import FiscalDevicePage from './pages/FiscalDevicePage';
import SubsidiesPage from './pages/SubsidiesPage';
import SubsidiesUserAssignmentPage from './pages/SubsidiesUserAssignmentPage';
import UserAccountPage from './pages/user-account/UserAccountPage';
import HouseCouncilPage from './pages/HouseCouncilPage';
import ComplaintPage from './pages/ComplaintPage';
import ComplaintsByAssignePage from './pages/ComplaintsByAssignePage';
import ComplaintPrioritiesPage from './pages/ComplaintPrioritiesPage';
import WaterSupplyNotesPage from './pages/WaterSupplyNotesPage';
import NoteCategoriesPage from './pages/NoteCategoriesPage';

function App() {
  return (
    <ConfigProvider locale={srRS}>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="sr">
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
              element={
                <PermissionGuard
                  permissions={[
                    'settings.company_info:read',
                    'legacy_databases:read',
                    'legacy_tables:read',
                    'settings.email_templates:view',
                  ]}
                >
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
              path="transport/vehicles/gps-lag-transfer"
              element={
                <PermissionGuard permissions={['vehicles.gps.lag:view']}>
                  <GpsLagTransfer />
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
              path="transport/administration/central-points"
              element={
                <PermissionGuard
                  permissions={[
                    'transport.administration.central_points:view',
                    'transport.administration.central_points.main:view',
                    'transport.administration.central_points.ticketing:view',
                    'transport.administration.central_points.city:view'
                  ]}
                >
                  <CentralPoints />
                </PermissionGuard>
              }
            />

            <Route
              path="transport/administration/stops-sync"
              element={
                <PermissionGuard
                  permissions={[
                    'transport.administration.stops_sync:view',
                    'transport.administration.stops_sync.main:view',
                    'transport.administration.stops_sync.ticketing:view',
                    'transport.administration.stops_sync.city:view'
                  ]}
                >
                  <StopsSync />
                </PermissionGuard>
              }
            />

            <Route
              path="transport/administration/price-list-groups"
              element={
                <PermissionGuard
                  permissions={[
                    'transport.administration.price_list_groups:view',
                    'transport.administration.price_list_groups.main:view',
                    'transport.administration.price_list_groups.ticketing:view',
                    'transport.administration.price_list_groups.city:view'
                  ]}
                >
                  <PriceListGroups />
                </PermissionGuard>
              }
            />

            <Route
              path="transport/administration/lines"
              element={
                <PermissionGuard
                  permissions={[
                    'transport.administration.lines:view',
                    'transport.administration.lines.main:view',
                    'transport.administration.lines.ticketing:view',
                    'transport.administration.lines.city:view'
                  ]}
                >
                  <Lines />
                </PermissionGuard>
              }
            />

            <Route
              path="transport/administration/lines-admin"
              element={
                <PermissionGuard permissions={['transport.administration.lines_admin:view']}>
                  <LinesAdministration />
                </PermissionGuard>
              }
            />

            <Route
              path="transport/administration/variations"
              element={
                <PermissionGuard
                  permissions={[
                    'transport.administration.variations:view',
                    'transport.administration.variations.main:view',
                    'transport.administration.variations.ticketing:view',
                    'transport.administration.variations.city:view'
                  ]}
                >
                  <Variations />
                </PermissionGuard>
              }
            />

            <Route
              path="transport/administration/timetable-dates"
              element={
                <PermissionGuard
                  permissions={[
                    'transport.administration.timetable_dates:view',
                    'transport.administration.timetable_dates.main:view',
                    'transport.administration.timetable_dates.ticketing:view',
                    'transport.administration.timetable_dates.city:view'
                  ]}
                >
                  <TimetableDates />
                </PermissionGuard>
              }
            />

            <Route
              path="transport/administration/timetable-sync"
              element={
                <PermissionGuard
                  permissions={[
                    'transport.administration.timetable_sync:view',
                    'transport.administration.timetable_sync.main:view',
                    'transport.administration.timetable_sync.ticketing:view',
                    'transport.administration.timetable_sync.city:view',
                  ]}
                >
                  <TimetableSync />
                </PermissionGuard>
              }
            />

            <Route
              path="transport/administration/turnusi-groups-sync"
              element={
                <PermissionGuard
                  permissions={[
                    'transport.administration.turnusi_sync:view',
                    'transport.administration.turnusi_sync.main:view',
                    'transport.administration.turnusi_sync.ticketing:view',
                    'transport.administration.turnusi_sync.city:view',
                  ]}
                >
                  <TurnusiSync />
                </PermissionGuard>
              }
            />

            <Route
              path="transport/administration/turnusi"
              element={
                <PermissionGuard
                  permissions={[
                    'transport.administration.turnusi:view',
                    'transport.administration.turnusi.main:view',
                    'transport.administration.turnusi.ticketing:view',
                    'transport.administration.turnusi.city:view',
                  ]}
                >
                  <Turnusi />
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
              path="transport/planning/schedule"
              element={
                <PermissionGuard permissions={['transport.planning.schedule:view']}>
                  <Schedule />
                </PermissionGuard>
              }
            />

            <Route
              path="transport/planning/schedule-print"
              element={
                <PermissionGuard permissions={['transport.planning.schedule_print:view']}>
                  <SchedulePrint />
                </PermissionGuard>
              }
            />

            <Route
              path="transport/planning/turnus-defaults"
              element={
                <PermissionGuard permissions={['transport.planning.turnus_defaults:view']}>
                  <TurnusDefaults />
                </PermissionGuard>
              }
            />

            <Route
              path="transport/planning/linked-turnusi"
              element={
                <PermissionGuard permissions={['transport.planning.linked_turnusi:view']}>
                  <LinkedTurnusi />
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

            {/* Vodovod routes */}
            {/* Vodovodni sistem */}
            <Route path="vodovod/water-system-regions" element={<PermissionGuard permissions={['water-system-regions:read']}><WaterSystemRegionsPage title="Rejoni" /></PermissionGuard>} />
            <Route path="vodovod/water-system-regions-all" element={<PermissionGuard permissions={['water-system-regions:read']}><WaterSystemRegionsPage title="Rejoni" /></PermissionGuard>} />
            <Route path="vodovod/water-system-cities" element={<PermissionGuard permissions={['water_system.cities:view']}><WaterSystemCitiesPage title="Naselja" /></PermissionGuard>} />
            <Route path="vodovod/water-system-zones" element={<PermissionGuard permissions={['water_system_zones:view']}><WaterSystemZonesPage title="Zone" /></PermissionGuard>} />
            <Route path="vodovod/water-system-streets" element={<PermissionGuard permissions={['water_system_streets:read']}><WaterSystemStreetsPage title="Ulice" /></PermissionGuard>} />
            <Route path="vodovod/water-system-streets-all" element={<PermissionGuard permissions={['water_system_streets:read']}><WaterSystemStreetsPage title="Ulice" /></PermissionGuard>} />

            {/* Vodomeri */}
            <Route path="vodovod/water-meters" element={<PermissionGuard permissions={['water_meters:view']}><WaterMeterPage title="Pregled" /></PermissionGuard>} />
            <Route path="vodovod/water-meter-types" element={<PermissionGuard permissions={['water_meter_types:view']}><WaterMeterTypesPage title="Tip vodomera" /></PermissionGuard>} />
            <Route path="vodovod/water-meter-manufacturers" element={<PermissionGuard permissions={['water_meter_manufacturers:view']}><WaterMeterManufacturersPage title="Proizvođači vodomera" /></PermissionGuard>} />
            <Route path="vodovod/water-meter-availability" element={<PermissionGuard permissions={['water_meter_availability:view']}><WaterMeterAvailabilityPage title="Raspoloživost vodomera" /></PermissionGuard>} />
            <Route path="vodovod/replacement-water-meters" element={<PermissionGuard permissions={['water_meter_replacement:view']}><ReplacementWaterMetersPage title="Zamenski vodomeri" /></PermissionGuard>} />
            <Route path="vodovod/water-meter-remarks" element={<PermissionGuard permissions={['water_meter_remarks:view']}><WaterMeterRemarksPage title="Napomene" /></PermissionGuard>} />
            <Route path="vodovod/review-modified-water-meters" element={<PermissionGuard permissions={['water_meter_review:view']}><ReviewModifiedWaterMetersPage title="Pregled zamenjenih vodomera" /></PermissionGuard>} />

            {/* Merna mesta */}
            <Route path="vodovod/measuring-points" element={<PermissionGuard permissions={['measuring_points:view']}><MeasuringPointsPage title="Pregled mernih mesta" /></PermissionGuard>} />
            <Route path="vodovod/merna-mesta" element={<PermissionGuard permissions={['measuring_points:view']}><MeasuringPointsPage title="Pregled mernih mesta" /></PermissionGuard>} />
            <Route path="vodovod/measuring-points-by-address" element={<PermissionGuard permissions={['measuring_points_by_address:view']}><MeasuringPointsByAddressPage title="Merna mesta po adresi" /></PermissionGuard>} />
            <Route path="vodovod/measuring-points-consumption" element={<PermissionGuard permissions={['measuring_points_consumption:view']}><MeasuringPointsConsumptionPage title="Potrošnja" /></PermissionGuard>} />
            <Route path="vodovod/house-council" element={<PermissionGuard permissions={['house_council:view']}><HouseCouncilPage title="Kućni saveti" /></PermissionGuard>} />

            {/* Očitavanja */}
            <Route path="vodovod/readings" element={<PermissionGuard permissions={['readings:view']}><ReadingsPage title="Očitavanja" /></PermissionGuard>} />
            <Route path="vodovod/reading-lists" element={<PermissionGuard permissions={['reading_lists:view']}><ReadingListsPage title="Čitačke liste" /></PermissionGuard>} />
            <Route path="vodovod/reading-lists-print" element={<PermissionGuard permissions={['reading_lists_print:view']}><ReadingListsPrintPage title="Štampa čitačkih listi" /></PermissionGuard>} />
            <Route path="vodovod/reading-anomalies" element={<PermissionGuard permissions={['reading_anomalies:view']}><ReadingAnomaliesPage title="Anomalije" /></PermissionGuard>} />
            <Route path="vodovod/water-readers" element={<PermissionGuard permissions={['water_readers:view']}><WaterReadersPage title="Čitači" /></PermissionGuard>} />

            {/* Kampanje */}
            <Route path="vodovod/campaigns" element={<PermissionGuard permissions={['campaign:view']}><CampaignPage title="Kampanje" /></PermissionGuard>} />
            <Route path="vodovod/sub-campaigns" element={<PermissionGuard permissions={['sub_campaign:view']}><SubCampaignPage title="Pod kampanje" /></PermissionGuard>} />

            {/* Usluge */}
            <Route path="vodovod/water-services" element={<PermissionGuard permissions={['water_services:view']}><WaterServicesPage title="Usluge" /></PermissionGuard>} />
            <Route path="vodovod/manage-water-services" element={<PermissionGuard permissions={['water_services_manage:view']}><ManageWaterServicesPage title="Dodeljivanje usluga" /></PermissionGuard>} />
            <Route path="vodovod/water-services-pricelist" element={<PermissionGuard permissions={['water_services_pricelist:view']}><WaterServicesPricelistPage title="Cenovnik usluga" /></PermissionGuard>} />
            <Route path="vodovod/water-service-pricelist-history" element={<PermissionGuard permissions={['water_service_pricelist_history:view']}><WaterServicePricelistHistoryPage title="Pregled istorije cenovnika" /></PermissionGuard>} />
            <Route path="vodovod/water-services-review" element={<PermissionGuard permissions={['water_services_review:view']}><WaterServicesReviewPage title="Pregled usluga po mernom mestu" /></PermissionGuard>} />

            {/* Obračun */}
            <Route path="vodovod/water-meter-calculation" element={<PermissionGuard permissions={['water_meter_calculation:view']}><WaterMeterCalculationPage title="Obračuni" /></PermissionGuard>} />
            <Route path="vodovod/water-meter-calculations" element={<PermissionGuard permissions={['water_meter_calculation:view']}><WaterMeterCalculationPage title="Obračuni" /></PermissionGuard>} />
            <Route path="vodovod/billing-campaigns" element={<PermissionGuard permissions={['billing_campaign:view']}><BillingCampaignPage title="Naplaćivanje kampanja" /></PermissionGuard>} />
            <Route path="vodovod/input-calculation-state" element={<PermissionGuard permissions={['input_calculation_state:view']}><InputCalculationStatePage title="Unos stanja za obračun" /></PermissionGuard>} />

            {/* Naplata */}
            <Route path="vodovod/payments" element={<PermissionGuard permissions={['payments:view']}><PaymentsPage title="Uplate" /></PermissionGuard>} />
            <Route path="vodovod/payments-by-method" element={<PermissionGuard permissions={['payments_by_method:view']}><PaymentsByPaymentMethodPage title="Pregled uplata po metodi plaćanja" /></PermissionGuard>} />
            <Route path="vodovod/cash-register" element={<PermissionGuard permissions={['cash_register:view']}><CashRegisterPage title="Blagajna" /></PermissionGuard>} />
            <Route path="vodovod/cashiers" element={<PermissionGuard permissions={['cashiers:view']}><CashiersPage title="Blagajnik" /></PermissionGuard>} />
            <Route path="vodovod/cashiers-session" element={<PermissionGuard permissions={['cashiers_session:view']}><CashiersSessionPage title="Smene" /></PermissionGuard>} />
            <Route path="vodovod/cash-register-report" element={<PermissionGuard permissions={['cash_register_report:view']}><CashRegisterReportPage title="Dnevni promet po blagajni/blagajniku" /></PermissionGuard>} />
            <Route path="vodovod/fiscal-device" element={<PermissionGuard permissions={['fiscal_device:view']}><FiscalDevicePage title="Blagajna" /></PermissionGuard>} />

            {/* Subvencije */}
            <Route path="vodovod/subsidies" element={<PermissionGuard permissions={['subsidies:view']}><SubsidiesPage title="Administracija subvencija" /></PermissionGuard>} />
            <Route path="vodovod/subsidies-user-assignment" element={<PermissionGuard permissions={['subsidies_assignment:view']}><SubsidiesUserAssignmentPage title="Dodeljivanje subvencija korisniku" /></PermissionGuard>} />

            {/* Korisnički nalozi */}
            <Route path="vodovod/user-accounts" element={<PermissionGuard permissions={['user_accounts:view']}><UserAccountPage title="Korisnici" /></PermissionGuard>} />

            {/* Reklamacije */}
            <Route path="vodovod/complaints" element={<PermissionGuard permissions={['complaints:view']}><ComplaintPage title="Reklamacije i zahtevi" /></PermissionGuard>} />
            <Route path="vodovod/complaints-by-assignee" element={<PermissionGuard permissions={['vodovod.complaints_by_assignee:view']}><ComplaintsByAssignePage title="Reklamacije za odgovorno lice" /></PermissionGuard>} />
            <Route path="vodovod/complaint-priorities" element={<PermissionGuard permissions={['complaint_priorities:view']}><ComplaintPrioritiesPage title="Prioriteti" /></PermissionGuard>} />

            {/* Beleške */}
            <Route path="vodovod/water-supply-notes" element={<PermissionGuard permissions={['water_supply_notes:view']}><WaterSupplyNotesPage title="Beleške" /></PermissionGuard>} />
            <Route path="vodovod/note-categories" element={<PermissionGuard permissions={['note_categories:view']}><NoteCategoriesPage title="Kategorije beleški" /></PermissionGuard>} />
          </Route>
        </Routes>
      </Router>
        </AntApp>
      </LocalizationProvider>
    </ConfigProvider>
  );
}

export default App
