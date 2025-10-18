/**
 * Fullscreen modal za izbor vozača sa sistemom filtera
 */

import React, { useEffect, useState, useMemo } from 'react';
import { Modal, Spin, Alert, Typography, Input, Button, Space as AntSpace } from 'antd';
import { SearchOutlined, TeamOutlined } from '@ant-design/icons';
import { DriverFilters } from './DriverFilters';
import { DriversList } from './DriversList';
import { useDriverFilters } from '../hooks/useDriverFilters';
import { Driver, RequestedShift } from '../filters/timeOverlapFilter';
import { planningService } from '../../../../services/planning.service';

const { Title, Text } = Typography;

interface DriverSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onSelectDriver: (driver: Driver) => void;
  date: string;
  lineNumber: string;
  turnusId: number;
  shiftNumber: number;
}

interface DriversAvailabilityResponse {
  drivers: Driver[];
  requestedShift: RequestedShift;
}

export const DriverSelectionModal: React.FC<DriverSelectionModalProps> = ({
  open,
  onClose,
  onSelectDriver,
  date,
  lineNumber,
  turnusId,
  shiftNumber,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [driversData, setDriversData] = useState<DriversAvailabilityResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAllDrivers, setShowAllDrivers] = useState(false);

  // Fetch drivers availability kada se modal otvori ili parametri promene
  useEffect(() => {
    if (!open) {
      // Resetuj state kada se modal zatvori
      setSearchTerm('');
      setShowAllDrivers(false);
      return;
    }

    const fetchDriversAvailability = async () => {
      setLoading(true);
      setError(null);

      try {
        // Inicijalno učitaj samo preporučene vozače (brže)
        const data = await planningService.getDriversAvailability({
          date,
          lineNumber,
          turnusId,
          shiftNumber,
          onlyRecommended: true,
        });

        setDriversData(data);
      } catch (err: any) {
        setError(
          err.response?.data?.message ||
            'Greška pri učitavanju dostupnosti vozača'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDriversAvailability();
  }, [open, date, lineNumber, turnusId, shiftNumber]);

  // Handler za učitavanje svih vozača
  const handleShowAllDrivers = async () => {
    setLoading(true);
    setError(null);

    try {
      // Učitaj SVE vozače (bez filtera)
      const data = await planningService.getDriversAvailability({
        date,
        lineNumber,
        turnusId,
        shiftNumber,
        onlyRecommended: false,
      });

      setDriversData(data);
      setShowAllDrivers(true);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'Greška pri učitavanju svih vozača'
      );
    } finally {
      setLoading(false);
    }
  };

  // Filtriraj vozače po search termu (frontend filtriranje)
  const searchedDrivers = useMemo(() => {
    const drivers = driversData?.drivers || [];

    // Primeni search term
    if (!searchTerm.trim()) {
      return drivers;
    }

    const lowerSearch = searchTerm.toLowerCase();
    return drivers.filter((driver) =>
      driver.fullName.toLowerCase().includes(lowerSearch)
    );
  }, [driversData?.drivers, searchTerm]);

  // Primeni filtere na listu vozača (posle pretrage)
  const { filters, toggleFilter, filteredDrivers } = useDriverFilters(
    searchedDrivers,
    driversData?.requestedShift || null
  );

  const handleSelectDriver = (driver: Driver) => {
    onSelectDriver(driver);
    onClose();
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="100%"
      style={{ top: 0, padding: 0 }}
      styles={{
        body: {
          height: '100vh',
          padding: 24,
          overflow: 'hidden',
        },
      }}
      destroyOnHidden
    >
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 8 }}>
          Izbor vozača
        </Title>
        {driversData?.requestedShift && (
          <Text type="secondary">
            Linija {driversData.requestedShift.lineNumber} •{' '}
            {driversData.requestedShift.turnusName} •{' '}
            Smena {driversData.requestedShift.shiftNumber} •{' '}
            {driversData.requestedShift.startTime} - {driversData.requestedShift.endTime}{' '}
            ({driversData.requestedShift.duration})
          </Text>
        )}
      </div>

      {/* Search bar i dugme za sve vozače */}
      {!loading && !error && driversData && (
        <div style={{ marginBottom: 16 }}>
          <AntSpace direction="horizontal" size="middle" style={{ width: '100%', flexWrap: 'wrap' }}>
            <Input
              placeholder="Pretraži vozače po imenu..."
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
              size="large"
              style={{ width: 400 }}
            />

            {!showAllDrivers && (
              <Button
                size="large"
                icon={<TeamOutlined />}
                onClick={handleShowAllDrivers}
              >
                Prikaži sve vozače
              </Button>
            )}
          </AntSpace>

          {searchTerm && (
            <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
              Pronađeno {searchedDrivers.length} vozača
            </Text>
          )}

          {!showAllDrivers && (
            <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
              Prikazano {searchedDrivers.length} preporučenih vozača
            </Text>
          )}

          {showAllDrivers && (
            <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
              Prikazano svih {driversData.drivers.length} vozača
            </Text>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">Učitavanje dostupnosti vozača...</Text>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <Alert
          message="Greška"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Main content */}
      {!loading && !error && driversData && (
        <div style={{ display: 'flex', height: 'calc(100vh - 150px)', gap: 24 }}>
          {/* Levi sidebar - Filteri */}
          <div
            style={{
              width: '25%',
              borderRight: '1px solid #f0f0f0',
              paddingRight: 24,
              overflowY: 'auto',
            }}
          >
            <DriverFilters filters={filters} onToggle={toggleFilter} />
          </div>

          {/* Desni deo - Liste vozača */}
          <div style={{ width: '75%', overflowY: 'hidden' }}>
            <DriversList
              freeDrivers={filteredDrivers.free}
              busyDrivers={filteredDrivers.busy}
              onSelect={handleSelectDriver}
            />
          </div>
        </div>
      )}
    </Modal>
  );
};
