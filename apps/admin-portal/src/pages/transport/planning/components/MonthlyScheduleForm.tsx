import React, { useState, useEffect } from 'react';
import { DatePicker, Checkbox, Input, message, Spin } from 'antd';
import { UserOutlined, LoadingOutlined, DeleteOutlined } from '@ant-design/icons';
import Select from 'react-select';
import dayjs, { Dayjs } from 'dayjs';
import {
  planningService,
  Line,
  Turnus,
  Driver,
  Schedule,
  CreateMonthlyScheduleDto,
  MonthlyScheduleResult,
  TurageOption,
} from '../../../../services/planning.service';
import { ConflictResolutionModal } from './ConflictResolutionModal';
import { ProgressModal } from './ProgressModal';
import { DeleteScheduleModal } from './DeleteScheduleModal';
import { DriverSelectionModal } from './DriverSelectionModal';

const { Group: CheckboxGroup } = Checkbox;

interface ProgressData {
  current: number;
  total: number;
  status: 'processing' | 'success' | 'error';
  results: Array<{
    date: string;
    status: 'success' | 'error';
    departuresCount?: number;
    error?: string;
  }>;
}

export const MonthlyScheduleForm: React.FC = () => {
  // Form state
  const [selectedMonth, setSelectedMonth] = useState<Dayjs | null>(null);
  const [selectedLine, setSelectedLine] = useState<Line | null>(null);
  const [selectedTurnus, setSelectedTurnus] = useState<Turnus | null>(null);
  const [selectedShift, setSelectedShift] = useState('');
  const [includedDaysOfWeek, setIncludedDaysOfWeek] = useState<number[]>([]); // Default: Ništa čekirano
  const [excludedDaysOfWeek, setExcludedDaysOfWeek] = useState<number[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

  // Broj Turaže za Subotu i Nedelju
  const [saturdayTurageNo, setSaturdayTurageNo] = useState<TurageOption | null>(null);
  const [sundayTurageNo, setSundayTurageNo] = useState<TurageOption | null>(null);

  // Opcije za Broj Turaže dropdown-e
  const [saturdayTurageOptions, setSaturdayTurageOptions] = useState<TurageOption[]>([]);
  const [sundayTurageOptions, setSundayTurageOptions] = useState<TurageOption[]>([]);
  const [loadingSaturdayTurage, setLoadingSaturdayTurage] = useState(false);
  const [loadingSundayTurage, setLoadingSundayTurage] = useState(false);

  // Data state
  const [lines, setLines] = useState<Line[]>([]);
  const [turnusi, setTurnusi] = useState<Turnus[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  // Monthly schedules state
  const [monthlySchedules, setMonthlySchedules] = useState<Schedule[]>([]);
  const [filteredSchedules, setFilteredSchedules] = useState<Schedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);

  // Filter state
  const [filterTurnus, setFilterTurnus] = useState<string>('');
  const [filterDriver, setFilterDriver] = useState<number | null>(null);
  const [filterDate, setFilterDate] = useState<string>('');
  const [uniqueTurnusi, setUniqueTurnusi] = useState<string[]>([]);
  const [uniqueDrivers, setUniqueDrivers] = useState<Array<{ id: number; name: string }>>([]);
  const [uniqueDates, setUniqueDates] = useState<string[]>([]);

  // Loading state
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Modal state
  const [conflictModalVisible, setConflictModalVisible] = useState(false);
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [driverModalOpen, setDriverModalOpen] = useState(false);
  const [conflictData, setConflictData] = useState<{
    conflictDates: string[];
    totalDays: number;
  } | null>(null);
  const [progressData, setProgressData] = useState<ProgressData>({
    current: 0,
    total: 0,
    status: 'processing',
    results: [],
  });
  const [scheduleToDelete, setScheduleToDelete] = useState<Schedule | null>(null);

  // EventSource za SSE
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  // Weekday options (1 = Monday, ..., 6 = Saturday, 0 = Sunday)
  // Redosled: Ponedeljak → Nedelja
  const weekdayOptions = [
    { label: 'Ponedeljak', value: 1 },
    { label: 'Utorak', value: 2 },
    { label: 'Sreda', value: 3 },
    { label: 'Četvrtak', value: 4 },
    { label: 'Petak', value: 5 },
    { label: 'Subota', value: 6 },
    { label: 'Nedelja', value: 0 },
  ];

  /**
   * Helper funkcija za pronalaženje prvog ponedeljka u odabranom mesecu
   * @param month - Dayjs objekat koji predstavlja mesec
   * @returns YYYY-MM-DD string prvog ponedeljka u mesecu
   */
  const getFirstMondayOfMonth = (month: Dayjs): string => {
    const firstDayOfMonth = month.startOf('month');
    const dayOfWeek = firstDayOfMonth.day(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    // Konverzija u ISO format (1 = Monday, 7 = Sunday)
    const isoWeekday = dayOfWeek === 0 ? 7 : dayOfWeek;

    // Ako je prvi dan meseca ponedeljak, vrati ga
    if (isoWeekday === 1) {
      return firstDayOfMonth.format('YYYY-MM-DD');
    }

    // Inače, dodaj dane da dođeš do sledećeg ponedeljka
    // Ako je utorak (2), dodaj 6 dana; ako je sreda (3), dodaj 5 dana, itd.
    const daysUntilMonday = 8 - isoWeekday;
    const firstMonday = firstDayOfMonth.add(daysUntilMonday, 'day');
    return firstMonday.format('YYYY-MM-DD');
  };

  // Load initial data
  useEffect(() => {
    loadLines();
    loadDrivers();
  }, []);

  // Load turnusi when line and month are selected
  useEffect(() => {
    if (selectedLine && selectedMonth) {
      // Za turnuse koristimo prvi dan u mesecu kao referentni datum
      const firstDayOfMonth = selectedMonth.startOf('month').format('YYYY-MM-DD');
      loadTurnusi(selectedLine.value, firstDayOfMonth);
    }
  }, [selectedLine, selectedMonth]);

  // Load monthly schedules when month and line are selected
  useEffect(() => {
    if (selectedMonth && selectedLine) {
      loadMonthlySchedules();
    } else {
      // Reset schedules ako nisu odabrani mesec i linija
      setMonthlySchedules([]);
      setFilteredSchedules([]);
      setUniqueTurnusi([]);
      setUniqueDrivers([]);
      setUniqueDates([]);
    }
  }, [selectedMonth, selectedLine]);

  // Apply filters when filterTurnus, filterDriver or filterDate changes
  useEffect(() => {
    applyFilters();
  }, [monthlySchedules, filterTurnus, filterDriver, filterDate]);

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [eventSource]);

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
      setTurnusi(data);
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

  const loadMonthlySchedules = async () => {
    if (!selectedMonth || !selectedLine) return;

    try {
      setLoadingSchedules(true);
      const month = selectedMonth.month() + 1; // dayjs.month() vraća 0-11
      const year = selectedMonth.year();
      const data = await planningService.getMonthlySchedules(month, year, selectedLine.value);

      setMonthlySchedules(data);

      // Ekstraktuj jedinstvene turaže, vozače i datume za filter dropdown-e
      extractUniqueTurnusi(data);
      extractUniqueDrivers(data);
      extractUniqueDates(data);

      // Resetuj filtere
      setFilterTurnus('');
      setFilterDriver(null);
      setFilterDate('');
    } catch (error) {
      message.error('Greška pri učitavanju mesečnih rasporeda');
      setMonthlySchedules([]);
      setFilteredSchedules([]);
    } finally {
      setLoadingSchedules(false);
    }
  };

  const extractUniqueTurnusi = (schedules: Schedule[]) => {
    const turnusiSet = new Set<string>();
    schedules.forEach((schedule) => {
      if (schedule.turnusName) {
        turnusiSet.add(schedule.turnusName);
      }
    });
    const sorted = Array.from(turnusiSet).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
    setUniqueTurnusi(sorted);
  };

  const extractUniqueDrivers = (schedules: Schedule[]) => {
    const driversMap = new Map<number, string>();
    schedules.forEach((schedule) => {
      if (!driversMap.has(schedule.driverId)) {
        driversMap.set(schedule.driverId, schedule.driverName);
      }
    });
    const sorted = Array.from(driversMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    setUniqueDrivers(sorted);
  };

  const extractUniqueDates = (schedules: Schedule[]) => {
    const datesSet = new Set<string>();
    schedules.forEach((schedule) => {
      if (schedule.date) {
        datesSet.add(schedule.date);
      }
    });
    // Sortiraj datume hronološki
    const sorted = Array.from(datesSet).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    setUniqueDates(sorted);
  };

  const applyFilters = () => {
    let filtered = [...monthlySchedules];

    // Filter po datumu
    if (filterDate) {
      filtered = filtered.filter((schedule) => schedule.date === filterDate);
    }

    // Filter po turaži
    if (filterTurnus) {
      filtered = filtered.filter((schedule) => schedule.turnusName === filterTurnus);
    }

    // Filter po vozaču
    if (filterDriver !== null) {
      filtered = filtered.filter((schedule) => schedule.driverId === filterDriver);
    }

    setFilteredSchedules(filtered);
  };

  const handleClearFilters = () => {
    setFilterDate('');
    setFilterTurnus('');
    setFilterDriver(null);
  };

  const loadSaturdayTurageOptions = async () => {
    if (!selectedLine || !selectedTurnus || !selectedShift) {
      return;
    }

    try {
      setLoadingSaturdayTurage(true);
      const options = await planningService.getTurageOptions({
        lineNumber: selectedLine.value,
        turnusName: selectedTurnus.turnusName,
        shiftNumber: parseInt(selectedShift),
        dayOfWeek: 'Subota',
      });
      setSaturdayTurageOptions(options);
    } catch (error: any) {
      message.error('Greška pri učitavanju turaža za Subotu');
      setSaturdayTurageOptions([]);
    } finally {
      setLoadingSaturdayTurage(false);
    }
  };

  const loadSundayTurageOptions = async () => {
    if (!selectedLine || !selectedTurnus || !selectedShift) {
      return;
    }

    try {
      setLoadingSundayTurage(true);
      const options = await planningService.getTurageOptions({
        lineNumber: selectedLine.value,
        turnusName: selectedTurnus.turnusName,
        shiftNumber: parseInt(selectedShift),
        dayOfWeek: 'Nedelja',
      });
      setSundayTurageOptions(options);
    } catch (error: any) {
      message.error('Greška pri učitavanju turaža za Nedelju');
      setSundayTurageOptions([]);
    } finally {
      setLoadingSundayTurage(false);
    }
  };

  const handleDeleteMonthlySchedule = async (id: number, startDate: string) => {
    try {
      await planningService.deleteSchedule(id, startDate);
      message.success('Raspored uspešno obrisan');
      // Reload mesečnih rasporeda
      await loadMonthlySchedules();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Greška pri brisanju rasporeda');
    }
  };

  const handleDeleteConfirm = async (scope: 'day' | 'month') => {
    if (!scheduleToDelete || !selectedMonth) return;

    try {
      if (scope === 'day') {
        // Brisanje samo za jedan dan
        const result = await planningService.deleteSchedule(
          scheduleToDelete.id,
          scheduleToDelete.date
        );
        message.success(result.message);
      } else {
        // Brisanje za ceo mesec
        const month = selectedMonth.month() + 1;
        const year = selectedMonth.year();
        const result = await planningService.deleteMonthlySchedule(
          scheduleToDelete.id,
          scheduleToDelete.date,
          month,
          year,
          scheduleToDelete.lineNumber,
          scheduleToDelete.turnusName,
          scheduleToDelete.shiftNumber
        );
        message.success(result.message);
      }

      // Zatvori modal i reload rasporeda
      setDeleteModalVisible(false);
      setScheduleToDelete(null);
      await loadMonthlySchedules();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Greška pri brisanju rasporeda');
    }
  };

  const handleMonthChange = (date: Dayjs | null) => {
    setSelectedMonth(date);
    // Reset dependent fields
    setSelectedTurnus(null);
    setSelectedShift('');
  };

  const handleLineChange = (option: Line | null) => {
    setSelectedLine(option);
    // Reset dependent fields
    setSelectedTurnus(null);
    setSelectedShift('');
  };

  const handleTurnusChange = (option: Turnus | null) => {
    setSelectedTurnus(option);
    // Reset shift
    setSelectedShift('');
  };

  const handleWeekdayChange = (checkedValues: any[]) => {
    setExcludedDaysOfWeek(checkedValues as number[]);
  };

  const handleIncludedDaysChange = (checkedValues: any[]) => {
    const values = checkedValues as number[];
    const previousValues = includedDaysOfWeek;

    // Pronađi koji checkbox je upravo kliknut
    const addedDay = values.find((v) => !previousValues.includes(v));
    const removedDay = previousValues.find((v) => !values.includes(v));

    if (addedDay !== undefined) {
      // ČEKIRANJE logika

      // Proveri da li neki radni dan već postoji u prethodnim vrednostima
      const hasAnyWeekday = previousValues.some((day) => day >= 1 && day <= 5);

      // Ako je čekiran bilo koji radni dan (1-5) I prethodno NIJE bilo radnih dana → čekira sve radne dane
      if (addedDay >= 1 && addedDay <= 5 && !hasAnyWeekday) {
        // Proveri da li su već čekirani Subota (6) ili Nedelja (0)
        const hasSaturday = previousValues.includes(6);
        const hasSunday = previousValues.includes(0);

        // Dodaj sve radne dane (1-5)
        const newValues = [1, 2, 3, 4, 5];

        // Zadrži Subotu/Nedelju ako su već bili čekirani
        if (hasSaturday) newValues.push(6);
        if (hasSunday) newValues.push(0);

        setIncludedDaysOfWeek(newValues);
      }
      // Ako je čekiran radni dan ALI već postoje neki radni dani → dodaj samo taj dan
      else if (addedDay >= 1 && addedDay <= 5 && hasAnyWeekday) {
        setIncludedDaysOfWeek([...previousValues, addedDay]);
      }
      // Ako je čekirana samo Subota (6) → čekira se samo Subota
      else if (addedDay === 6) {
        setIncludedDaysOfWeek([...previousValues, 6]);
      }
      // Ako je čekirana samo Nedelja (0) → čekira se samo Nedelja
      else if (addedDay === 0) {
        setIncludedDaysOfWeek([...previousValues, 0]);
      }
    } else if (removedDay !== undefined) {
      // DEČEKIRANJE logika - uklanja se samo taj dan (BEZ auto-logike)
      setIncludedDaysOfWeek(values);
    }
  };

  // Pojedinačni checkbox handler za custom rendering
  const handleDayCheckboxChange = (day: number, checked: boolean) => {
    const previousValues = includedDaysOfWeek;

    if (checked) {
      // ČEKIRANJE logika
      const hasAnyWeekday = previousValues.some((d) => d >= 1 && d <= 5);

      if (day >= 1 && day <= 5 && !hasAnyWeekday) {
        // Čekiran prvi radni dan → čekira sve radne dane
        const hasSaturday = previousValues.includes(6);
        const hasSunday = previousValues.includes(0);
        const newValues = [1, 2, 3, 4, 5];
        if (hasSaturday) newValues.push(6);
        if (hasSunday) newValues.push(0);
        setIncludedDaysOfWeek(newValues);
      } else {
        // Dodaj samo taj dan
        setIncludedDaysOfWeek([...previousValues, day]);
      }
    } else {
      // DEČEKIRANJE - ukloni samo taj dan
      setIncludedDaysOfWeek(previousValues.filter((d) => d !== day));
    }
  };

  const startMonthlyScheduleStream = (conflictResolution?: 'skip' | 'overwrite') => {
    if (!selectedMonth || !selectedLine || !selectedTurnus || !selectedShift || !selectedDriver) {
      message.warning('Molimo popunite sva obavezna polja');
      return;
    }

    // Zatvori prethodni EventSource ako postoji
    if (eventSource) {
      eventSource.close();
    }

    const dto: CreateMonthlyScheduleDto = {
      month: selectedMonth.month() + 1,
      year: selectedMonth.year(),
      lineNumber: selectedLine.value,
      turnusName: selectedTurnus.turnusName,
      shiftNumber: parseInt(selectedShift),
      includedDaysOfWeek,
      excludedDaysOfWeek,
      driverId: selectedDriver.value,
      conflictResolution,
      saturdayTurnusName: saturdayTurageNo?.value,
      sundayTurnusName: sundayTurageNo?.value,
    };

    // Inicijalizuj progress state i otvori modal
    setProgressData({
      current: 0,
      total: 0,
      status: 'processing',
      results: [],
    });
    setProgressModalVisible(true);

    const source = planningService.createMonthlyScheduleStream(
      dto,
      // onProgress
      (data) => {
        setProgressData({
          current: data.current,
          total: data.total,
          status: data.status,
          results: data.results,
        });
      },
      // onComplete
      (data) => {
        if (data.type === 'conflict') {
          // Zatvorimo progress modal i pokažimo conflict modal
          setProgressModalVisible(false);
          setConflictData({
            conflictDates: data.conflict.conflictDates,
            totalDays: data.totalDays,
          });
          setConflictModalVisible(true);
          setSubmitting(false);
        } else {
          // Complete - ažuriraj finalni progress state
          setProgressData({
            current: data.processedDays,
            total: data.totalDays,
            status: data.errorCount > 0 ? 'error' : 'success',
            results: data.results,
          });
          setSubmitting(false);

          // ✅ Poruke su uklonjene - prikazaće se u handleProgressClose() nakon smart reseta
          // Modal ostaje otvoren da korisnik vidi rezultate
          // handleProgressClose() će se pozvati kada korisnik klikne "U redu"
        }
      },
      // onError
      (error) => {
        message.error('Greška pri kreiranju mesečnog rasporeda');
        setSubmitting(false);
        setProgressModalVisible(false);
      }
    );

    setEventSource(source);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedMonth || !selectedLine || !selectedTurnus || !selectedShift || !selectedDriver) {
      message.warning('Molimo popunite sva obavezna polja');
      return;
    }

    setSubmitting(true);
    startMonthlyScheduleStream();
  };

  const handleConflictOverwrite = () => {
    setConflictModalVisible(false);
    setSubmitting(true);
    startMonthlyScheduleStream('overwrite');
  };

  const handleConflictSkip = () => {
    setConflictModalVisible(false);
    setSubmitting(true);
    startMonthlyScheduleStream('skip');
  };

  const handleConflictCancel = () => {
    setConflictModalVisible(false);
    setSubmitting(false);
  };

  /**
   * Helper funkcija za kompletni reset forme
   */
  const resetForm = () => {
    setSelectedMonth(null);
    setSelectedLine(null);
    setSelectedTurnus(null);
    setSelectedShift('');
    setIncludedDaysOfWeek([]);
    setExcludedDaysOfWeek([]);
    setSaturdayTurageNo(null);
    setSundayTurageNo(null);
    setSaturdayTurageOptions([]);
    setSundayTurageOptions([]);
    setSelectedDriver(null);
  };

  /**
   * Pronađi sledeći nepopunjeni turnus i smenu za PRVI dan odabranog meseca
   * (ista logika kao u Dnevnom tabu, ali za prvi dan meseca)
   */
  const findNextUnfilledTurnusForFirstDay = async (
    currentTurnusIndex: number
  ): Promise<{ turnus: Turnus | null; shift: string | null }> => {
    if (!selectedMonth || !selectedLine) {
      return { turnus: null, shift: null };
    }

    // Kreiraj datum za prvi dan meseca
    const firstDayOfMonth = selectedMonth.startOf('month').format('YYYY-MM-DD');

    // Učitaj trenutne raspore za prvi dan meseca
    const schedulesForFirstDay = await planningService.getSchedule(firstDayOfMonth);

    // Turnusi nakon trenutnog
    const remainingTurnusi = turnusi.slice(currentTurnusIndex + 1);

    // Pronađi prvi nepopunjeni turnus (za prvi dan)
    const firstUnfilledTurnus = remainingTurnusi.find((turnus) => {
      const existingSchedulesForTurnus = schedulesForFirstDay.filter(
        (s) => s.turnusName === turnus.turnusName && s.lineNumber === selectedLine.value
      );
      return existingSchedulesForTurnus.length < turnus.shifts.length;
    });

    if (!firstUnfilledTurnus) {
      return { turnus: null, shift: null };
    }

    // Pronađi prvu nepopunjenu smenu za taj turnus (za prvi dan)
    const existingSchedulesForTurnus = schedulesForFirstDay.filter(
      (s) => s.turnusName === firstUnfilledTurnus.turnusName && s.lineNumber === selectedLine.value
    );
    const filledShifts = existingSchedulesForTurnus.map((s) => s.shiftNumber);
    const firstUnfilledShift = firstUnfilledTurnus.shifts
      .sort((a, b) => a - b)
      .find((shift) => !filledShifts.includes(shift));

    return {
      turnus: firstUnfilledTurnus,
      shift: firstUnfilledShift ? firstUnfilledShift.toString() : null,
    };
  };

  const handleProgressClose = async () => {
    setProgressModalVisible(false);

    // Zatvori EventSource ako je još otvoren
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
    }

    // Reload mesečnih rasporeda da prikaže nove unose
    if (selectedMonth && selectedLine) {
      await loadMonthlySchedules();
    }

    // ✅ SMART FORM RESET - zadrži mesec i liniju, pomeri turnus i smenu
    // (ista logika kao u Dnevnom tabu, ali za prvi dan meseca)

    if (!selectedTurnus || !selectedLine || !selectedMonth) {
      // Ako nema kompletnih podataka, obični reset
      resetForm();
      return;
    }

    // 1. Proveri da li postoji sledeća smena u trenutnom turnusu (za prvi dan)
    const currentShift = parseInt(selectedShift);
    const availableShifts = selectedTurnus.shifts.sort((a, b) => a - b);
    const currentIndex = availableShifts.indexOf(currentShift);

    if (currentIndex !== -1 && currentIndex < availableShifts.length - 1) {
      // ✅ Postoji sledeća smena - predloži je
      const nextShift = availableShifts[currentIndex + 1];
      setSelectedShift(nextShift.toString());
      setSelectedDriver(null); // Resetuj samo vozača
      setSaturdayTurageNo(null);
      setSundayTurageNo(null);
      message.info(`Automatski prebačeno na smenu ${nextShift}`);
      return;
    }

    // 2. Nema sledeće smene - pronađi sledeći nepopunjeni turnus (za prvi dan)
    const currentTurnusIndex = turnusi.findIndex((t) => t.value === selectedTurnus.value);
    const nextTurnusData = await findNextUnfilledTurnusForFirstDay(currentTurnusIndex);

    if (nextTurnusData.turnus && nextTurnusData.shift) {
      // ✅ Postoji nepopunjeni turnus - prebaci na njega
      setSelectedTurnus(nextTurnusData.turnus);
      setSelectedShift(nextTurnusData.shift);
      setSelectedDriver(null); // Resetuj samo vozača
      setSaturdayTurageNo(null);
      setSundayTurageNo(null);
      message.info(`Automatski prebačeno na ${nextTurnusData.turnus.label}`);
    } else {
      // ❌ Nema više nepopunjenih turnusa - potpuni reset
      resetForm();
      message.success('Svi turnusi su popunjeni za prvi dan meseca');
    }
  };

  const isFormValid =
    selectedMonth &&
    selectedLine &&
    selectedTurnus &&
    selectedShift &&
    includedDaysOfWeek.length > 0 &&
    selectedDriver &&
    !submitting;

  return (
    <div className="p-4">
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {/* Grid sa 4 kolone za glavna polja */}
          <div className="grid grid-cols-4 gap-4">
          {/* Month/Year Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Mesec i godina <span className="text-red-500">*</span>
            </label>
            <DatePicker
              value={selectedMonth}
              onChange={handleMonthChange}
              picker="month"
              format="MMMM YYYY"
              placeholder="Izaberite mesec..."
              size="middle"
              className="w-full"
            />
          </div>

          {/* Line Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Linija <span className="text-red-500">*</span>
            </label>
            <Select
              value={selectedLine}
              onChange={handleLineChange}
              options={lines}
              className="react-select-container"
              classNamePrefix="react-select"
              placeholder="Izaberite liniju..."
              isSearchable
              isClearable
              isDisabled={!selectedMonth}
            />
          </div>

          {/* Turnus Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Turaža <span className="text-red-500">*</span>
            </label>
            <Select
              value={selectedTurnus}
              onChange={handleTurnusChange}
              options={turnusi}
              className="react-select-container"
              classNamePrefix="react-select"
              placeholder="Izaberite turaž u..."
              isSearchable
              isClearable
              isDisabled={!selectedLine || !selectedMonth || loading}
              isLoading={loading}
            />
          </div>

          {/* Shift Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Smena <span className="text-red-500">*</span>
            </label>
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
          </div>
          </div>

          {/* Included Days of Week */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Dani u nedelji (za planiranje) <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap items-center gap-4">
              {weekdayOptions.map((option) => (
                <div key={option.value} className="flex items-center gap-3">
                  <Checkbox
                    checked={includedDaysOfWeek.includes(option.value)}
                    onChange={(e) => handleDayCheckboxChange(option.value, e.target.checked)}
                  >
                    {option.label}
                  </Checkbox>
                  {(option.value === 6 || option.value === 0) && (
                    <Select
                      value={option.value === 6 ? saturdayTurageNo : sundayTurageNo}
                      onChange={(selected) => {
                        if (option.value === 6) {
                          setSaturdayTurageNo(selected);
                        } else {
                          setSundayTurageNo(selected);
                        }
                      }}
                      options={option.value === 6 ? saturdayTurageOptions : sundayTurageOptions}
                      onFocus={option.value === 6 ? loadSaturdayTurageOptions : loadSundayTurageOptions}
                      className="react-select-container"
                      classNamePrefix="react-select"
                      placeholder="Izaberite turažu..."
                      isSearchable
                      isClearable
                      isLoading={option.value === 6 ? loadingSaturdayTurage : loadingSundayTurage}
                      isDisabled={!selectedLine || !selectedTurnus || !selectedShift}
                      noOptionsMessage={() => 'Nema dostupnih turaža'}
                      styles={{
                        container: (base) => ({
                          ...base,
                          width: '250px',
                        }),
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Excluded Days of Week + Driver Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Isključi specifične dane (opciono)
            </label>
            <div className="flex items-center gap-4 flex-wrap">
              <CheckboxGroup
                options={weekdayOptions}
                value={excludedDaysOfWeek}
                onChange={handleWeekdayChange}
                className="flex flex-wrap gap-4"
              />
              <button
                type="button"
                onClick={() => {
                  if (selectedMonth && selectedLine && selectedTurnus && selectedShift) {
                    setDriverModalOpen(true);
                  } else {
                    message.warning('Prvo izaberite mesec, liniju, turnus i smenu');
                  }
                }}
                disabled={!selectedMonth || !selectedLine || !selectedTurnus || !selectedShift}
                className="ml-8 bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-1.5 px-4 rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <UserOutlined />
                Odaberite vozača
              </button>
              {selectedDriver && (
                <span className="ml-4 text-sm font-medium text-gray-700">
                  {selectedDriver.fullName}
                </span>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={!isFormValid}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {submitting && <Spin indicator={<LoadingOutlined style={{ fontSize: 16, color: 'white' }} spin />} />}
              {submitting ? 'Kreiranje rasporeda...' : 'Kreiraj mesečni raspored'}
            </button>
          </div>
        </div>
      </form>

      {/* TABELA ISPLANIRANIH TURAŽA */}
      {selectedMonth && selectedLine && (
        <div className="mt-8 border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              Isplanirani rasporedi za {selectedMonth.format('MMMM YYYY')} - Linija {selectedLine.value}
            </h3>
            {loadingSchedules && (
              <Spin indicator={<LoadingOutlined style={{ fontSize: 20 }} spin />} />
            )}
          </div>

          {/* FILTERI */}
          {monthlySchedules.length > 0 && (
            <div className="mb-4 flex gap-4 items-center flex-wrap">
              <div className="flex-1 min-w-[200px] max-w-xs">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filter po datumu
                </label>
                <select
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
                >
                  <option value="">Svi dani</option>
                  {uniqueDates.map((date) => (
                    <option key={date} value={date}>
                      {new Date(date).toLocaleDateString('sr-RS', {
                        weekday: 'short',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[200px] max-w-xs">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filter po turaži
                </label>
                <select
                  value={filterTurnus}
                  onChange={(e) => setFilterTurnus(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
                >
                  <option value="">Sve turaže</option>
                  {uniqueTurnusi.map((turnus) => (
                    <option key={turnus} value={turnus}>
                      {turnus}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[200px] max-w-xs">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filter po vozaču
                </label>
                <select
                  value={filterDriver || ''}
                  onChange={(e) => setFilterDriver(e.target.value ? parseInt(e.target.value) : null)}
                  className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
                >
                  <option value="">Svi vozači</option>
                  {uniqueDrivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-md transition-colors"
                >
                  Obriši filtere
                </button>
              </div>

              <div className="flex items-end ml-auto">
                <span className="text-sm text-gray-600">
                  Prikazano: <strong>{filteredSchedules.length}</strong> od{' '}
                  <strong>{monthlySchedules.length}</strong> rasporeda
                </span>
              </div>
            </div>
          )}

          {/* TABELA */}
          <div className="overflow-x-auto">
            {loadingSchedules ? (
              <div className="flex justify-center items-center py-12">
                <Spin size="large" />
              </div>
            ) : filteredSchedules.length === 0 ? (
              <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-md">
                {monthlySchedules.length === 0
                  ? 'Nema isplaniranih rasporeda za odabrani mesec i liniju'
                  : 'Nema rasporeda koji odgovaraju odabranim filterima'}
              </div>
            ) : (
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
                  {filteredSchedules.map((schedule) => (
                    <tr key={`${schedule.id}-${schedule.date}`} className="hover:bg-gray-50">
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
                        {schedule.turnusDuration}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {schedule.departuresCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {schedule.driverName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => {
                            setScheduleToDelete(schedule);
                            setDeleteModalVisible(true);
                          }}
                          className="text-red-600 hover:text-red-900 transition-colors inline-flex items-center gap-1"
                          title="Obriši raspored"
                        >
                          <DeleteOutlined />
                          Obriši
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Conflict Resolution Modal */}
      {conflictData && (
        <ConflictResolutionModal
          visible={conflictModalVisible}
          conflictDates={conflictData.conflictDates}
          totalDays={conflictData.totalDays}
          driverName={selectedDriver?.fullName}
          onOverwrite={handleConflictOverwrite}
          onSkip={handleConflictSkip}
          onCancel={handleConflictCancel}
        />
      )}

      {/* Progress Modal */}
      <ProgressModal
        visible={progressModalVisible}
        progress={progressData}
        onClose={handleProgressClose}
      />

      {/* Delete Schedule Modal */}
      <DeleteScheduleModal
        visible={deleteModalVisible}
        schedule={scheduleToDelete}
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setDeleteModalVisible(false);
          setScheduleToDelete(null);
        }}
      />

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
        date={selectedMonth ? getFirstMondayOfMonth(selectedMonth) : ''}
        lineNumber={selectedLine?.value || ''}
        turnusId={selectedTurnus?.value || 0}
        shiftNumber={parseInt(selectedShift) || 0}
      />
    </div>
  );
};
