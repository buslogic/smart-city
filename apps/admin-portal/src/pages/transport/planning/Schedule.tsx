import React, { useState, useEffect } from 'react';
import { Card, Typography, Tabs, message, Modal, Input, Button } from 'antd';
import { CalendarOutlined, DeleteOutlined, ExclamationCircleOutlined, UserOutlined } from '@ant-design/icons';
import Select from 'react-select';
import {
  planningService,
  Line,
  Turnus,
  Driver,
  Schedule as ScheduleType,
} from '../../../services/planning.service';
import { DriverSelectionModal } from './components/DriverSelectionModal';
import { MonthlyScheduleForm } from './components/MonthlyScheduleForm';

const { Title } = Typography;

// Helper funkcija za natural sort (numeričko sortiranje stringova sa brojevima)
const naturalSort = (a: string, b: string): number => {
  const regex = /(\d+)|(\D+)/g;
  const aParts = a.match(regex) || [];
  const bParts = b.match(regex) || [];

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || '';
    const bPart = bParts[i] || '';

    // Ako su oba dela brojevi, uporedi numerički
    if (!isNaN(Number(aPart)) && !isNaN(Number(bPart))) {
      const diff = Number(aPart) - Number(bPart);
      if (diff !== 0) return diff;
    } else {
      // Inače uporedi kao stringove
      if (aPart !== bPart) return aPart.localeCompare(bPart);
    }
  }

  return 0;
};

const Schedule: React.FC = () => {
  const [activeTab, setActiveTab] = useState('daily');

  // Form state
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedLine, setSelectedLine] = useState<Line | null>(null);
  const [selectedTurnus, setSelectedTurnus] = useState<Turnus | null>(null);
  const [selectedShift, setSelectedShift] = useState('');
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

  // Data state
  const [lines, setLines] = useState<Line[]>([]);
  const [turnusi, setTurnusi] = useState<Turnus[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [schedules, setSchedules] = useState<ScheduleType[]>([]);

  // Loading state
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<ScheduleType | null>(null);
  const [driverModalOpen, setDriverModalOpen] = useState(false);

  // Load initial data
  useEffect(() => {
    loadLines();
    loadDrivers();
  }, []);

  // Load schedules when date changes
  useEffect(() => {
    if (selectedDate) {
      loadSchedules(selectedDate);
    }
  }, [selectedDate]);

  // Load turnusi when line and date are selected
  useEffect(() => {
    if (selectedLine && selectedDate) {
      loadTurnusi(selectedLine.value, selectedDate);
    }
  }, [selectedLine, selectedDate]);

  const loadLines = async () => {
    try {
      const data = await planningService.getLines();
      setLines(data);
    } catch (error) {
      message.error('Greška pri učitavanju linija');
    }
  };

  const loadTurnusi = async (lineNumber: string, date: string) => {
    try {
      setLoading(true);
      const data = await planningService.getTurnusi(lineNumber, date);

      // Sortiraj turnuse natural sortom (00018-1, 00018-2, ..., 00018-10)
      const sortedData = [...data].sort((a, b) => naturalSort(a.label, b.label));
      setTurnusi(sortedData);

      // Automatski postavi prvi nepopunjeni turnus
      if (sortedData.length > 0) {
        // Sačekaj da schedules bude učitan za ovaj datum
        const currentSchedules = await planningService.getSchedule(date);

        // Pronađi prvi turnus koji nema sve smene popunjene
        const firstUnfilledTurnus = sortedData.find((turnus) => {
          // Proveri po turnusName jer isti logički turnus može imati različite turnus_id
          // (npr. 219284 za neaktivne linije, 274206 za aktivne linije)
          const existingSchedulesForTurnus = currentSchedules.filter(
            (s) => s.turnusName === turnus.turnusName && s.lineNumber === lineNumber
          );

          // Ako turnus ima manje unetih smena nego što ima ukupno smena, nije popunjen
          return existingSchedulesForTurnus.length < turnus.shifts.length;
        });

        if (firstUnfilledTurnus) {
          setSelectedTurnus(firstUnfilledTurnus);

          // Pronađi prvu smenu koja nije uneta za ovaj turnus (po imenu)
          const existingSchedulesForTurnus = currentSchedules.filter(
            (s) => s.turnusName === firstUnfilledTurnus.turnusName && s.lineNumber === lineNumber
          );
          const filledShifts = existingSchedulesForTurnus.map((s) => s.shiftNumber);
          const firstUnfilledShift = firstUnfilledTurnus.shifts
            .sort((a, b) => a - b)
            .find((shift) => !filledShifts.includes(shift));

          if (firstUnfilledShift) {
            setSelectedShift(firstUnfilledShift.toString());
          }
        }
      }
    } catch (error) {
      message.error('Greška pri učitavanju turnusa');
    } finally {
      setLoading(false);
    }
  };

  const loadDrivers = async () => {
    try {
      const data = await planningService.getDrivers();
      setDrivers(data);
    } catch (error) {
      message.error('Greška pri učitavanju vozača');
    }
  };

  const loadSchedules = async (date: string) => {
    try {
      const data = await planningService.getSchedule(date);
      setSchedules(data);
    } catch (error) {
      message.error('Greška pri učitavanju rasporeda');
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
    // Reset dependent fields
    setSelectedTurnus(null);
    setSelectedShift('');
  };

  const handleLineChange = (option: Line | null) => {
    setSelectedLine(option);
    // Reset dependent fields
    setSelectedTurnus(null);
    setSelectedShift('');
    setSelectedDriver(null);
  };

  const handleTurnusChange = (option: Turnus | null) => {
    setSelectedTurnus(option);
    // Reset shift
    setSelectedShift('');
  };

  const handleDelete = (schedule: ScheduleType) => {
    setScheduleToDelete(schedule);
    setDeleteModalVisible(true);
  };

  const handleDeleteConfirm = async () => {
    if (!scheduleToDelete) return;

    try {
      await planningService.deleteSchedule(scheduleToDelete.id, scheduleToDelete.date);
      message.success('Raspored uspešno obrisan');
      setDeleteModalVisible(false);
      setScheduleToDelete(null);
      loadSchedules(selectedDate);
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Greška pri brisanju rasporeda');
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalVisible(false);
    setScheduleToDelete(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !selectedDate ||
      !selectedLine ||
      !selectedTurnus ||
      !selectedShift ||
      !selectedDriver
    ) {
      message.warning('Molimo popunite sva polja');
      return;
    }

    try {
      setSubmitting(true);
      await planningService.createSchedule({
        date: selectedDate,
        lineNumber: selectedLine.value,
        turnusId: selectedTurnus.value,
        shiftNumber: parseInt(selectedShift),
        driverId: selectedDriver.value,
      });

      message.success('Raspored uspešno dodat');

      // Smart form reset - zadrži liniju i turnus, predloži sledeću smenu
      const currentShift = parseInt(selectedShift);
      const availableShifts = selectedTurnus.shifts.sort((a, b) => a - b);
      const currentIndex = availableShifts.indexOf(currentShift);

      // Reload schedules da osvežimo tabelu
      await loadSchedules(selectedDate);

      // Proveri da li postoji sledeća smena u trenutnom turnusu
      if (currentIndex !== -1 && currentIndex < availableShifts.length - 1) {
        // Postoji sledeća smena - predloži je
        const nextShift = availableShifts[currentIndex + 1];
        setSelectedShift(nextShift.toString());
      } else {
        // Nema sledeće smene u trenutnom turnusu
        // Sada proveravamo koji je sledeći NEPOPUNJENI turnus
        const updatedSchedules = await planningService.getSchedule(selectedDate);

        // Pronađi prvi nepopunjeni turnus (preskače trenutni i sve popunjene)
        const currentTurnusIndex = turnusi.findIndex(t => t.value === selectedTurnus.value);
        const remainingTurnusi = turnusi.slice(currentTurnusIndex + 1);

        const firstUnfilledTurnus = remainingTurnusi.find((turnus) => {
          const existingSchedulesForTurnus = updatedSchedules.filter(
            (s) => s.turnusName === turnus.turnusName && s.lineNumber === selectedLine.value
          );
          return existingSchedulesForTurnus.length < turnus.shifts.length;
        });

        if (firstUnfilledTurnus) {
          // Postoji nepopunjeni turnus
          setSelectedTurnus(firstUnfilledTurnus);

          // Pronađi prvu nepopunjenu smenu
          const existingSchedulesForTurnus = updatedSchedules.filter(
            (s) => s.turnusName === firstUnfilledTurnus.turnusName && s.lineNumber === selectedLine.value
          );
          const filledShifts = existingSchedulesForTurnus.map((s) => s.shiftNumber);
          const firstUnfilledShift = firstUnfilledTurnus.shifts
            .sort((a, b) => a - b)
            .find((shift) => !filledShifts.includes(shift));

          if (firstUnfilledShift) {
            setSelectedShift(firstUnfilledShift.toString());
          }

          message.info(`Automatski prebačeno na ${firstUnfilledTurnus.label}`);
        } else {
          // Nema više nepopunjenih turnusa - resetuj
          setSelectedTurnus(null);
          setSelectedShift('');
          message.info('Završeno sa svim turnusima za ovu liniju');
        }
      }

      // Resetuj samo vozača
      setSelectedDriver(null);
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Greška pri dodavanju rasporeda');
    } finally {
      setSubmitting(false);
    }
  };

  const isFormValid =
    selectedDate &&
    selectedLine &&
    selectedTurnus &&
    selectedShift &&
    selectedDriver &&
    !submitting;

  // Helper funkcija za formatovanje vremena
  // Backend sada vraća kompletan formatiran string: "04:00 - 23:15 (19:15)"
  const formatTimeInfo = (startTime: any, duration: any) => {
    // Ako duration već ima formatiran string (sa " - "), direktno ga prikaži
    if (duration && typeof duration === 'string' && duration.includes(' - ')) {
      return duration;
    }

    // Fallback za stari format (ako još uvek postoji)
    if (!startTime || !duration) return '-';

    // MySQL TIME dolazi kao ISO string: "1970-01-01T04:00:00.000Z"
    // Parsiramo samo vreme iz ISO stringa
    const startDate = new Date(startTime);
    const durationDate = new Date(duration);

    const startH = startDate.getUTCHours();
    const startM = startDate.getUTCMinutes();
    const durH = durationDate.getUTCHours();
    const durM = durationDate.getUTCMinutes();

    // Formatuj start vreme
    const startFormatted = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;

    // Formatuj duration
    const durationFormatted = `${String(durH).padStart(2, '0')}:${String(durM).padStart(2, '0')}`;

    // Izračunaj krajnje vreme (start + duration)
    const totalMinutes = (startH * 60 + startM) + (durH * 60 + durM);
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;
    const endFormatted = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    return `${startFormatted} - ${endFormatted} (${durationFormatted})`;
  };

  const tabItems = [
    {
      key: 'daily',
      label: 'Dnevni',
      children: (
        <div className="p-4">
          {/* Date Filter */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Izaberite datum
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full max-w-xs"
            />
          </div>

          {selectedDate && (
            <>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Datum
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Linija
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Turaža
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Smena
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Vreme trajanja
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Broj polazaka
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Vozač
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Akcije
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {/* Form Row */}
                    <tr className="bg-blue-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600">
                          {new Date(selectedDate).toLocaleDateString('sr-RS')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Select
                          value={selectedLine}
                          onChange={handleLineChange}
                          options={lines}
                          className="react-select-container"
                          classNamePrefix="react-select"
                          placeholder="Izaberite liniju..."
                          isSearchable
                          isClearable
                        />
                      </td>
                      <td className="px-6 py-4">
                        <Select
                          value={selectedTurnus}
                          onChange={handleTurnusChange}
                          options={turnusi}
                          className="react-select-container"
                          classNamePrefix="react-select"
                          placeholder="Izaberite turaž u..."
                          isSearchable
                          isClearable
                          isDisabled={!selectedLine || !selectedDate || loading}
                          isLoading={loading}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={selectedShift}
                          onChange={(e) => setSelectedShift(e.target.value)}
                          disabled={!selectedTurnus}
                          className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          <option value="">Izaberite smenu</option>
                          {selectedTurnus?.shifts.map((shift) => (
                            <option key={shift} value={shift}>
                              {shift === 1 ? 'Prva smena' : shift === 2 ? 'Druga smena' : 'Treća smena'}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        {/* Prazna ćelija za kolonu Vreme trajanja */}
                      </td>
                      <td className="px-6 py-4">
                        {/* Prazna ćelija za kolonu Broj polazaka */}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Input
                            readOnly
                            value={selectedDriver?.fullName || ''}
                            placeholder="Kliknite da izaberete vozača"
                            onClick={() => {
                              if (selectedDate && selectedLine && selectedTurnus && selectedShift) {
                                setDriverModalOpen(true);
                              } else {
                                message.warning('Prvo izaberite datum, liniju, turaž i smenu');
                              }
                            }}
                            suffix={<UserOutlined />}
                            style={{ cursor: 'pointer', flex: 1 }}
                            className="cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!isFormValid}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                          >
                            Dodaj
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4"></td>
                    </tr>

                    {/* Data Rows */}
                    {schedules.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                          Nema rasporeda za odabrani datum
                        </td>
                      </tr>
                    ) : (
                      schedules.map((schedule) => (
                        <tr key={schedule.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(schedule.date).toLocaleDateString('sr-RS')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {schedule.lineNumber} - {schedule.lineName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {schedule.turnusName} ({schedule.turageNo}/{schedule.departureNoInTurage})
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {schedule.shiftNumber === 1
                              ? 'Prva smena'
                              : schedule.shiftNumber === 2
                              ? 'Druga smena'
                              : 'Treća smena'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatTimeInfo(schedule.turnusStartTime, schedule.turnusDuration)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {schedule.departuresCount}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {schedule.driverName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handleDelete(schedule)}
                              className="text-red-600 hover:text-red-900 transition-colors inline-flex items-center gap-1"
                              title="Obriši raspored"
                            >
                              <DeleteOutlined />
                              Obriši
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      ),
    },
    {
      key: 'weekly',
      label: 'Nedeljni',
      children: (
        <div className="p-4">
          <div className="text-gray-600">
            <p>Nedeljni raspored - pregled po nedeljama</p>
          </div>
        </div>
      ),
    },
    {
      key: 'monthly',
      label: 'Mesečni',
      children: <MonthlyScheduleForm />,
    },
  ];

  return (
    <div className="p-6">
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <CalendarOutlined className="text-2xl text-blue-500" />
          <Title level={2} className="mb-0">
            Raspored
          </Title>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          className="mt-4"
        />
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <ExclamationCircleOutlined className="text-red-500" />
            <span>Potvrda brisanja</span>
          </div>
        }
        open={deleteModalVisible}
        onOk={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        okText="Da, obriši"
        cancelText="Otkaži"
        okButtonProps={{ danger: true }}
      >
        {scheduleToDelete && (
          <p>
            Da li ste sigurni da želite da obrišete raspored za{' '}
            <strong>{scheduleToDelete.driverName}</strong> (
            {scheduleToDelete.lineNumber} -{' '}
            {scheduleToDelete.shiftNumber === 1
              ? 'Prva smena'
              : scheduleToDelete.shiftNumber === 2
              ? 'Druga smena'
              : 'Treća smena'}
            )?
          </p>
        )}
      </Modal>

      {/* Driver Selection Modal */}
      <DriverSelectionModal
        open={driverModalOpen}
        onClose={() => setDriverModalOpen(false)}
        onSelectDriver={(driver) => {
          setSelectedDriver({
            id: driver.id,
            firstName: driver.firstName,
            lastName: driver.lastName,
            fullName: driver.fullName,
            label: driver.fullName,
            value: driver.id,
          });
          setDriverModalOpen(false);
        }}
        date={selectedDate}
        lineNumber={selectedLine?.value || ''}
        turnusId={selectedTurnus?.value || 0}
        shiftNumber={parseInt(selectedShift) || 0}
      />
    </div>
  );
};

export default Schedule;
