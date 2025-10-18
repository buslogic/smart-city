import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { GetDriversAvailabilityDto } from './dto/get-drivers-availability.dto';

@Injectable()
export class PlanningService {
  constructor(private prisma: PrismaService) {}

  /**
   * Dobavi sve linije za dropdown
   * Vraća samo aktivne linije koje zadovoljavaju uslove grupe važenja cenovnika
   */
  async getLines() {
    // Primeni iste filtere kao u getTurnusiByLineAndDate - proveri status i grupu važenja cenovnika
    // GROUP BY samo po line_number_for_display da eliminišemo duplikate (različiti smerovi, varijante)
    const lines = await this.prisma.$queryRaw<
      Array<{
        line_number_for_display: string;
        line_title: string;
      }>
    >`
      SELECT
        l.line_number_for_display,
        MIN(l.line_title) as line_title
      FROM \`lines\` l
      INNER JOIN price_table_groups ptg ON l.date_valid_from = ptg.date_valid_from
      WHERE l.status = 'A'
        AND ptg.status = 'A'
        AND ptg.synchro_status = 'A'
      GROUP BY l.line_number_for_display
      ORDER BY
        CAST(l.line_number_for_display AS UNSIGNED),
        l.line_number_for_display
    `;

    return lines.map((line, index) => ({
      id: index.toString(),
      lineNumberForDisplay: line.line_number_for_display,
      lineTitle: line.line_title,
      label: `${line.line_number_for_display} - ${line.line_title}`,
      value: line.line_number_for_display,
    }));
  }

  /**
   * Dobavi turnuse po liniji i datumu (dan u nedelji)
   */
  async getTurnusiByLineAndDate(lineNumber: string, date: string) {
    // Izračunaj dan u nedelji iz datuma
    const dayName = this.getDayNameFromDate(date);

    // Prvo naći liniju po line_number_for_display da dobijemo pravi line_number
    const line = await this.prisma.line.findFirst({
      where: { lineNumberForDisplay: lineNumber },
      select: { lineNumber: true },
    });

    if (!line || !line.lineNumber) {
      return [];
    }

    // Query za dobijanje turnusa koji saobraćaju tog dana na toj liniji
    // Koristi line.lineNumber (ne lineNumberForDisplay) za povezivanje sa changes_codes_tours
    // Filtrira samo turnuse koji pripadaju linijama sa aktivnim date_valid_from
    // Dodatno filtrira po aktivnim varijacijama cena za odabrani datum
    const turnusi = await this.prisma.$queryRaw<
      Array<{
        turnus_id: number;
        turnus_name: string;
        shift_number: number;
      }>
    >`
      SELECT DISTINCT
        cct.turnus_id,
        cct.turnus_name,
        cct.shift_number
      FROM changes_codes_tours cct
      INNER JOIN turnus_days td ON cct.turnus_id = td.turnus_id
      INNER JOIN \`lines\` l ON cct.line_no = l.line_number
      LEFT JOIN price_variations pv ON l.price_variation_id = pv.id
      INNER JOIN price_table_groups ptg ON l.date_valid_from = ptg.date_valid_from
      WHERE l.line_number_for_display = ${lineNumber}
        AND l.status = 'A'
        AND ptg.status = 'A'
        AND ptg.synchro_status = 'A'
        AND td.dayname = ${dayName}
        AND (
          l.price_variation_id = 0
          OR pv.id IS NULL
          OR DATE(${date}) BETWEEN DATE(pv.datetime_from) AND DATE(pv.datetime_to)
        )
      ORDER BY
        CAST(SUBSTRING_INDEX(cct.turnus_name, '-', -1) AS UNSIGNED),
        cct.shift_number
    `;

    // Grupiši po turnusName (ne turnusId!) jer isti turnus ima više ID-eva
    const groupedTurnusi = turnusi.reduce((acc, curr) => {
      const turnusId = Number(curr.turnus_id);
      const shiftNumber = Number(curr.shift_number);

      // Pronađi po imenu, ne po ID-u!
      const existingTurnus = acc.find((t) => t.turnusName === curr.turnus_name);

      if (existingTurnus) {
        // Dodaj ID ako već ne postoji
        if (!existingTurnus.turnusIds.includes(turnusId)) {
          existingTurnus.turnusIds.push(turnusId);
        }
        // Dodaj smenu ako već ne postoji
        if (!existingTurnus.shifts.includes(shiftNumber)) {
          existingTurnus.shifts.push(shiftNumber);
        }
      } else {
        acc.push({
          turnusId, // Prvu vrednost kao glavni ID (za kompatibilnost)
          turnusIds: [turnusId], // Lista svih ID-eva za ovaj turnus
          turnusName: curr.turnus_name,
          shifts: [shiftNumber],
          label: curr.turnus_name,
          value: turnusId, // Prvu vrednost kao value
        });
      }

      return acc;
    }, [] as Array<{
      turnusId: number;
      turnusIds: number[];
      turnusName: string;
      shifts: number[];
      label: string;
      value: number
    }>);

    return groupedTurnusi;
  }

  /**
   * Dobavi sve vozače (users sa driver = true)
   */
  async getDrivers() {
    const drivers = await this.prisma.user.findMany({
      where: {
        userGroup: {
          driver: true,
        },
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return drivers.map((driver) => ({
      id: driver.id,
      firstName: driver.firstName,
      lastName: driver.lastName,
      fullName: `${driver.firstName} ${driver.lastName}`,
      label: `${driver.firstName} ${driver.lastName}`,
      value: driver.id,
    }));
  }

  /**
   * Dobavi dostupnost vozača za odabrani turnus/smenu
   * Vraća sve vozače sa njihovim već isplaniranim smenama za taj dan
   */
  async getDriversAvailability(dto: GetDriversAvailabilityDto) {
    const startDate = new Date(dto.date);
    const dayName = this.getDayNameFromDate(dto.date);

    // Pronađi ime turnusa
    const turnusInfo = await this.prisma.changesCodesTours.findFirst({
      where: { turnusId: dto.turnusId },
      select: { turnusName: true },
    });

    if (!turnusInfo) {
      throw new NotFoundException(`Turnus ${dto.turnusId} nije pronađen`);
    }

    // Ako je onlyRecommended=true, prvo dobavi defaults pa samo te vozače
    let driverIds: number[] | undefined;
    if (dto.onlyRecommended) {
      const recommendedDefaults = await this.prisma.turnusDefaultPerDriver.findMany({
        where: {
          turnusName: turnusInfo.turnusName,
          isActive: true,
          OR: [
            { shiftNumber: dto.shiftNumber, dayOfWeek: dayName as any },
            { shiftNumber: dto.shiftNumber, dayOfWeek: null },
            { shiftNumber: null, dayOfWeek: dayName as any },
            { shiftNumber: null, dayOfWeek: null },
          ],
        },
        select: { driverId: true },
        distinct: ['driverId'],
      });

      driverIds = recommendedDefaults.map(d => d.driverId);

      // Ako nema preporučenih, vrati praznu listu odmah
      if (driverIds.length === 0) {
        return {
          drivers: [],
          requestedShift: await this.getRequestedShiftInfo(dto, turnusInfo.turnusName, dayName),
        };
      }
    }

    // 1. Dobavi vozače (sve ili samo preporučene)
    const drivers = await this.prisma.user.findMany({
      where: {
        userGroup: {
          driver: true,
        },
        isActive: true,
        ...(driverIds ? { id: { in: driverIds } } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    // 2. Za svaki vozač dobavi sve već isplanirane smene za taj dan
    const driversWithSchedules = await Promise.all(
      drivers.map(async (driver) => {
        // Dobavi sve polaske za ovog vozača za taj dan
        const schedules = await this.prisma.dateTravelOrder.findMany({
          where: {
            startDate,
            driverId: driver.id,
          },
          orderBy: {
            startTime: 'asc',
          },
        });

        // Grupiši polaske po turnus/smena
        const groupedSchedules = new Map<string, typeof schedules>();
        for (const schedule of schedules) {
          const turnusName = this.extractTurnusNameFromComment(schedule.comment);
          const shiftNumber = this.extractShiftFromComment(schedule.comment);
          const groupKey = `${schedule.lineNo}_${turnusName}_${shiftNumber}`;

          if (!groupedSchedules.has(groupKey)) {
            groupedSchedules.set(groupKey, [schedule]);
          } else {
            groupedSchedules.get(groupKey)!.push(schedule);
          }
        }

        // Za svaku grupu izračunaj startTime i endTime
        const scheduledShifts = Array.from(groupedSchedules.entries()).map(
          ([groupKey, departures]) => {
            // Sortiraj polaske po vremenu
            const sortedDepartures = departures.sort((a, b) => {
              const timeA = new Date(a.startTime).getTime();
              const timeB = new Date(b.startTime).getTime();
              return timeA - timeB;
            });

            const firstDeparture = sortedDepartures[0];
            const lastDeparture = sortedDepartures[sortedDepartures.length - 1];
            const turnusName = this.extractTurnusNameFromComment(firstDeparture.comment);
            const shiftNumber = this.extractShiftFromComment(firstDeparture.comment);

            // Format vremena koristeći UTC metode (MySQL TIME polja dolaze kao UTC Date objekti)
            const formatTime = (timeValue: Date | null) => {
              if (!timeValue) return '00:00';
              return `${timeValue.getUTCHours().toString().padStart(2, '0')}:${timeValue.getUTCMinutes().toString().padStart(2, '0')}`;
            };

            const startTime = formatTime(firstDeparture.startTime);
            const endTime = formatTime(lastDeparture.endTime || lastDeparture.startTime);

            // Izračunaj trajanje u minutima
            const startMs = firstDeparture.startTime.getTime();
            const endMs = (lastDeparture.endTime || lastDeparture.startTime).getTime();
            let durationMinutes = Math.floor((endMs - startMs) / (1000 * 60));

            // Ako je negativan, dodaj 24h (prelazi preko ponoći)
            if (durationMinutes < 0) {
              durationMinutes += 24 * 60;
            }

            const hours = Math.floor(durationMinutes / 60);
            const minutes = durationMinutes % 60;
            const duration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

            return {
              turnusName,
              shiftNumber,
              lineNumber: firstDeparture.lineNo,
              startTime,
              endTime,
              duration,
            };
          }
        );

        return {
          id: driver.id,
          firstName: driver.firstName,
          lastName: driver.lastName,
          fullName: `${driver.firstName} ${driver.lastName}`,
          scheduledShifts,
        };
      })
    );

    // 3. Dobavi SVE defaults za ovaj turnus JEDNIM query-jem (optimizacija)
    const allDefaults = await this.prisma.turnusDefaultPerDriver.findMany({
      where: {
        turnusName: turnusInfo.turnusName,
        isActive: true,
        OR: [
          // Level 1: Match sa smenom i danom
          {
            shiftNumber: dto.shiftNumber,
            dayOfWeek: dayName as any,
          },
          // Level 2: Match samo sa smenom (bilo koji dan)
          {
            shiftNumber: dto.shiftNumber,
            dayOfWeek: null,
          },
          // Level 3: Match samo sa danom (bilo koja smena)
          {
            shiftNumber: null,
            dayOfWeek: dayName as any,
          },
          // Level 4: Match samo sa turnus name (fallback)
          {
            shiftNumber: null,
            dayOfWeek: null,
          },
        ],
      },
      orderBy: [
        { priority: 'asc' },        // Najspecifičniji prvi
        { confidenceScore: 'desc' }, // Veći confidence ako isti priority
        { usageCount: 'desc' },     // Više korišćenja
      ],
    });

    // Kreiraj Map za brzi lookup po driver_id
    const defaultsMap = new Map<number, typeof allDefaults[0]>();
    for (const def of allDefaults) {
      // Uzmi prvi (najbolji) default za svakog vozača
      if (!defaultsMap.has(def.driverId)) {
        defaultsMap.set(def.driverId, def);
      }
    }

    // 5. Dodaj default podatke svakom vozaču
    for (const driver of driversWithSchedules) {
      const bestMatch = defaultsMap.get(driver.id);

      (driver as any).turnusDefault = bestMatch ? {
        hasDefault: true,
        usageCount: bestMatch.usageCount,
        usagePercentage: Number(bestMatch.usagePercentage),
        confidenceScore: Number(bestMatch.confidenceScore),
        priority: bestMatch.priority,
        note: bestMatch.note,
      } : {
        hasDefault: false,
        usageCount: 0,
        usagePercentage: 0,
        confidenceScore: 0,
        priority: 999,
        note: null,
      };
    }

    // 6. Sortiraj vozače po confidenceScore DESC (vozači sa default-om prvi)
    driversWithSchedules.sort((a, b) => {
      const scoreA = (a as any).turnusDefault?.confidenceScore || 0;
      const scoreB = (b as any).turnusDefault?.confidenceScore || 0;
      return scoreB - scoreA;
    });

    // Dobavi informacije o traženoj smeni
    const requestedShift = await this.getRequestedShiftInfo(dto, turnusInfo.turnusName, dayName);

    return {
      drivers: driversWithSchedules,
      requestedShift,
    };
  }

  /**
   * Kreiraj novi raspored - upisuje SVE polaske za turnus/smenu u date_travel_order
   */
  async createSchedule(dto: CreateScheduleDto, userId: number) {
    // Dobavi dodatne informacije za popunjavanje date_travel_order
    const line = await this.prisma.line.findFirst({
      where: { lineNumberForDisplay: dto.lineNumber },
    });

    if (!line) {
      throw new NotFoundException(`Linija ${dto.lineNumber} nije pronađena`);
    }

    // Prvo pronađi ime turnusa po turnusId
    const turnusInfo = await this.prisma.changesCodesTours.findFirst({
      where: { turnusId: dto.turnusId },
      select: { turnusName: true },
    });

    if (!turnusInfo) {
      throw new NotFoundException(`Turnus ${dto.turnusId} nije pronađen`);
    }

    const driver = await this.prisma.user.findUnique({
      where: { id: dto.driverId },
    });

    if (!driver) {
      throw new NotFoundException(`Vozač sa ID ${dto.driverId} nije pronađen`);
    }

    // Konvertuj date string u Date objekat
    const startDate = new Date(dto.date);
    const dayName = this.getDayNameFromDate(dto.date);

    // Pronađi SVE aktivne line_number varijante za ovu lineNumberForDisplay
    const activeLines = await this.prisma.line.findMany({
      where: {
        lineNumberForDisplay: dto.lineNumber,
        status: 'A',
      },
      select: { lineNumber: true },
    });
    const activeLineNumbers = activeLines.map(l => l.lineNumber);

    if (activeLineNumbers.length === 0) {
      throw new NotFoundException(`Nema aktivnih varijanti za liniju ${dto.lineNumber}`);
    }

    // Pronađi turnus_id sa najnovijim MAX(change_time) koji TAKOĐE ima dan u turnus_days
    // KLJUČNO: Mora da JOIN-uje sa `lines` i filtrira status='A' da izbegne neaktivne linije!
    const latestTurnusId = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT cct.turnus_id, MAX(cct.change_time) as max_change_time
       FROM changes_codes_tours cct
       INNER JOIN turnus_days td ON cct.turnus_id = td.turnus_id
       INNER JOIN \`lines\` l ON cct.line_no = l.line_number
       WHERE cct.turnus_name = '${turnusInfo.turnusName}'
         AND cct.shift_number = ${dto.shiftNumber}
         AND cct.direction = 0
         AND td.dayname = '${dayName}'
         AND l.status = 'A'
       GROUP BY cct.turnus_id
       ORDER BY max_change_time DESC
       LIMIT 1`
    );

    // Ako nije pronađen najnoviji turnus_id, koristi originalni pristup
    if (!latestTurnusId || latestTurnusId.length === 0) {
      throw new NotFoundException(`Ne mogu da pronađem najnoviju verziju turnusa ${turnusInfo.turnusName}`);
    }

    const targetTurnusId = Number(latestTurnusId[0].turnus_id);

    // Dobavi SVE polaske za ovaj turnus/smenu sa ISTIM filterima kao u getTurnusiByLineAndDate
    // VAŽNO: Filterujemo samo direction=0 jer svaki polazak ima 2 reda (smer A i B)
    // VAŽNO: Koristi samo turnus_id sa najnovijim change_time (najsvežija verzija reda vožnje)
    const allDepartures = await this.prisma.$queryRaw<
      Array<{
        id: number;
        turnus_name: string;
        line_no: string;
        start_time: Date;
        duration: Date;
        direction: number;
        departure_number: number;
        departure_no_in_turage: number;
        turage_no: number;
        turnus_id: number;
        date_valid_from: string;
        active: number;
        change_code: number;
        line_type_id: number;
        legacy_ticketing_id: number | null;
      }>
    >`
      SELECT
        cct.id,
        cct.turnus_name,
        cct.line_no,
        cct.start_time,
        cct.duration,
        cct.direction,
        cct.departure_number,
        cct.departure_no_in_turage,
        cct.turage_no,
        cct.turnus_id,
        cct.active,
        cct.change_code,
        cct.line_type_id,
        l.date_valid_from,
        l.legacy_ticketing_id
      FROM changes_codes_tours cct
      INNER JOIN turnus_days td ON cct.turnus_id = td.turnus_id
      INNER JOIN \`lines\` l ON cct.line_no = l.line_number
      LEFT JOIN price_variations pv ON l.price_variation_id = pv.id
      INNER JOIN price_table_groups ptg ON l.date_valid_from = ptg.date_valid_from
      WHERE l.line_number_for_display = ${dto.lineNumber}
        AND l.status = 'A'
        AND ptg.status = 'A'
        AND ptg.synchro_status = 'A'
        AND cct.turnus_id = ${targetTurnusId}
        AND cct.shift_number = ${dto.shiftNumber}
        AND cct.direction = 0
        AND td.dayname = ${dayName}
        AND (
          l.price_variation_id = 0
          OR pv.id IS NULL
          OR DATE(${dto.date}) BETWEEN DATE(pv.datetime_from) AND DATE(pv.datetime_to)
        )
      ORDER BY cct.start_time ASC
    `;

    if (allDepartures.length === 0) {
      throw new NotFoundException(
        `Nema polazaka za turnus ${turnusInfo.turnusName}, smenu ${dto.shiftNumber} na dan ${dayName}`,
      );
    }

    // Dohvati imena početne i krajnje stanice iz prvog polaska (svi polaski su na istoj liniji)
    const firstDep = allDepartures[0];
    const stations = await this.getLineStations(
      firstDep.legacy_ticketing_id,
      firstDep.date_valid_from
    );

    // Kreiraj jedan zapis u date_travel_order ZA SVAKI POLAZAK
    const createdSchedules: Array<{ id: number }> = [];

    for (let i = 0; i < allDepartures.length; i++) {
      const departure = allDepartures[i];

      // Izračunaj end_time za ovaj polazak
      // VAŽNO: MySQL TIME polja vraćaju Date objekte u UTC, moramo koristiti UTC metode!
      const departureStartTime = new Date(departure.start_time);
      const departureDuration = new Date(departure.duration);
      const endTime = new Date(departureStartTime);
      endTime.setUTCHours(
        departureStartTime.getUTCHours() + departureDuration.getUTCHours(),
        departureStartTime.getUTCMinutes() + departureDuration.getUTCMinutes(),
        departureStartTime.getUTCSeconds() + departureDuration.getUTCSeconds()
      );

      const schedule = await this.prisma.dateTravelOrder.create({
        data: {
          lineType: line.lineType || 'gradska',
          startDate,
          driverId: dto.driverId,
          driverName: `${driver.firstName} ${driver.lastName}`,
          otherIds: 0,
          otherNames: '',
          otherIds2: 0,
          otherNames2: '',
          lineNo: dto.lineNumber,
          lineName: line.lineTitle,
          busName: '',
          noOfSeats: 0,
          garageNo: '',
          registNo: '',
          registArea: '',
          bpivDate: startDate,
          bpivNo: '',
          startTime: departure.start_time,
          endTime: endTime,
          endDate: startDate,
          endTimeFound: endTime,
          endTimeManual: endTime,
          endDateFound: startDate,
          orderNo: 0,
          issuedate: startDate,
          planned: 1,
          realised: 0,
          comment: `Turnus: ${departure.turnus_name}, Smena: ${dto.shiftNumber}, Polazak: ${i + 1}/${allDepartures.length}`,
          prepareTime: '00:00',
          lineTime: '00:00',
          lineKm: 0,
          speedLimit: 0,
          checkCash: 0,
          checkKm: 0,
          checkPrepare: 0,
          checkSpeed: 0,
          checkStart: 0,
          checkEnd: 0,
          checkStations: 0,
          checkRoute: 0,
          checkRpm: 0,
          checkAccBrk: 0,
          checkMud: 0,
          checkFuel: 0,
          checkFuelTime: new Date(),
          kmFound: 0,
          prepareFound: '00:00',
          speedPeakFound: 0,
          speedAverageFound: 0,
          speedDurationFound: '00:00',
          speedAllowedPeak: 0,
          speedAllowedDuration: '00:00',
          speedregPeakFound: 0,
          speedregAverageFound: 0,
          speedregDurationFound: '00:00',
          speedregAllowedPeak: 0,
          speedregAllowedDuration: '00:00',
          speedredPeakFound: 0,
          speedredAverageFound: 0,
          speedredDurationFound: '00:00',
          speedredAllowedPeak: 0,
          speedredAllowedDuration: '00:00',
          reductionRoadFound: 0,
          reductionKmFound: 0,
          tempAverageFound: 0,
          tempPeakFound: 0,
          oilAverageFound: 0,
          oilPeakFound: 0,
          startFound: departure.start_time,
          startDateFound: startDate,
          startDateManual: startDate,
          endDateManual: startDate,
          startManual: departure.start_time,
          startReason: 0,
          stationsFound: 0,
          cashComment: '',
          kmComment: '',
          prepareComment: '',
          speedComment: '',
          startComment: '',
          endComment: '',
          routeComment: '',
          gasFound: '',
          fiscInfo: '',
          tempComment: '',
          oilComment: '',
          editedBy: userId,
          beforeTime: '00:00',
          afterTime: '00:00',
          beforeTimeFound: '00:00:00',
          afterTimeFound: '00:00:00',
          sheduleId: dto.turnusId,
          prepareFlag: '',
          beforeFlag: '',
          durationFlag: '',
          afterFlag: '',
          rpmFound: '',
          accBrkFound: '',
          additOptFound: 0,
          fuelConsPrep: 0,
          fuelConsBefore: 0,
          fuelConsAfter: 0,
          fuelConsMain: 0,
          fuelConsStop: 0,
          speedBChk: 0,
          speedBVal: 0,
          rpmBChk: 0,
          rpmBVal: 0,
          accbrkBChk: 0,
          accbrkBVal: 0,
          allBChk: 0,
          allBVal: 0,
          modifiedBy: userId,
          modifiedDate: new Date(),
          createdBy: userId,
          createdDate: new Date(),
          realisedBy: 0,
          realisedDate: new Date(),
          canceledBy: 0,
          canceledDate: new Date(),
          likePlannedBy: 0,
          likePlannedDate: new Date(),
        },
      });

      createdSchedules.push({ id: schedule.id });
    }

    // Sinhronizuj sa legacy date_shedule tabelom
    await this.syncToLegacySchedule({
      lineNo: dto.lineNumber,
      lineName: line.lineTitle,
      startStation: stations.startStation,
      endStation: stations.endStation,
      startDate,
      driverId: dto.driverId,
      driverName: `${driver.firstName} ${driver.lastName}`,
      driverLegacyId: driver.legacyId,
      turnusId: dto.turnusId,
      turnusName: turnusInfo.turnusName,
      shiftNumber: dto.shiftNumber,
      departures: allDepartures.map(d => ({
        start_time: d.start_time,
        duration: d.duration,
        direction: d.direction,
        departure_number: d.departure_number,
      })),
    });

    // Vrati informacije o kreiranim zapisima
    const firstDeparture = allDepartures[0];
    const lastDeparture = allDepartures[allDepartures.length - 1];

    return {
      id: createdSchedules[0].id,
      date: dto.date,
      lineNumber: dto.lineNumber,
      lineName: line.lineTitle,
      turnusId: dto.turnusId,
      turnusName: turnusInfo.turnusName,
      shiftNumber: dto.shiftNumber,
      driverId: dto.driverId,
      driverName: `${driver.firstName} ${driver.lastName}`,
      departuresCount: allDepartures.length,
      firstDepartureTime: firstDeparture.start_time,
      lastDepartureTime: lastDeparture.start_time,
    };
  }

  /**
   * Dobavi rasporede za odabrani datum - GRUPISANE po turnus/smena
   * Sada pošto upisujemo SVE polaske, moramo da grupišemo po turnus/smena za prikaz
   */
  async getSchedulesByDate(date: string) {
    const startDate = new Date(date);

    const schedules = await this.prisma.dateTravelOrder.findMany({
      where: {
        startDate,
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    // Grupiši po turnus/smena kombinaciji
    type GroupedSchedule = {
      id: number;
      date: string;
      lineNumber: string;
      lineName: string;
      turnusId: number;
      turnusName: string;
      shiftNumber: number;
      driverId: number;
      driverName: string;
      departures: typeof schedules;
    };

    const groupedSchedules = new Map<string, GroupedSchedule>();

    for (const schedule of schedules) {
      const turnusName = this.extractTurnusNameFromComment(schedule.comment);
      const shiftNumber = this.extractShiftFromComment(schedule.comment);
      const groupKey = `${schedule.lineNo}_${turnusName}_${shiftNumber}_${schedule.driverId}`;

      if (!groupedSchedules.has(groupKey)) {
        // Ovo je prvi polazak za ovaj turnus/smenu, kreiraj grupu
        groupedSchedules.set(groupKey, {
          id: schedule.id,
          date: schedule.startDate.toISOString().split('T')[0],
          lineNumber: schedule.lineNo,
          lineName: schedule.lineName,
          turnusId: schedule.sheduleId,
          turnusName,
          shiftNumber,
          driverId: schedule.driverId,
          driverName: schedule.driverName,
          departures: [schedule],
        });
      } else {
        // Dodaj polazak u postojeću grupu
        const group = groupedSchedules.get(groupKey);
        if (group) {
          group.departures.push(schedule);
        }
      }
    }

    // Za svaku grupu izračunaj ukupno trajanje i dodatne informacije
    const schedulesWithDetails = await Promise.all(
      Array.from(groupedSchedules.values()).map(async (group) => {
        const dayName = this.getDayNameFromDate(group.date);

        // Pronađi SVE AKTIVNE line_number varijante za ovu lineNumberForDisplay
        const lines = await this.prisma.line.findMany({
          where: {
            lineNumberForDisplay: group.lineNumber,
            status: 'A',
          },
          select: { lineNumber: true },
        });
        const lineNumbers = lines.map(l => l.lineNumber);

        // Dobavi turage_no iz prvog polaska
        const turnusDetails = await this.prisma.changesCodesTours.findFirst({
          where: {
            turnusName: group.turnusName,
            shiftNumber: group.shiftNumber,
            lineNo: { in: lineNumbers },
          },
          select: {
            turageNo: true,
            departureNoInTurage: true,
          },
        });

        // Sortiraj polaske po vremenu
        group.departures.sort((a, b) => {
          const timeA = new Date(a.startTime).getTime();
          const timeB = new Date(b.startTime).getTime();
          return timeA - timeB;
        });

        // Izračunaj ukupno trajanje od prvog do poslednjeg polaska
        const firstDeparture = group.departures[0];
        const lastDeparture = group.departures[group.departures.length - 1];
        const departuresCount = group.departures.length;

        // Format vremena za prikaz (HH:MM) - MySQL TIME polja dolaze kao Date objekti
        // VAŽNO: MySQL TIME polja vraćaju Date objekte u UTC timezone-u!
        // Moramo koristiti getUTCHours/getUTCMinutes da izbegnemo timezone konverziju
        const formatTime = (timeValue: Date | string | null) => {
          if (!timeValue) return '00:00';

          // Ako je već Date objekat, uzmi sate i minute u UTC (bez timezone konverzije)
          const d = timeValue instanceof Date ? timeValue : new Date(timeValue);

          // Proveri da li je validan Date
          if (isNaN(d.getTime())) return '00:00';

          // Koristi getUTCHours/getUTCMinutes jer MySQL TIME polja dolaze kao UTC Date objekti
          return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
        };

        const firstTime = formatTime(firstDeparture.startTime);
        const lastEndTime = formatTime(lastDeparture.endTime || lastDeparture.startTime);

        // Izračunaj razliku u minutima između prvog i poslednjeg
        // MySQL TIME polja dolaze kao Date objekti sa datumom 1970-01-01
        const firstTimeMs = firstDeparture.startTime instanceof Date
          ? firstDeparture.startTime.getTime()
          : new Date(firstDeparture.startTime).getTime();
        const lastEndTimeMs = (lastDeparture.endTime || lastDeparture.startTime) instanceof Date
          ? (lastDeparture.endTime || lastDeparture.startTime).getTime()
          : new Date(lastDeparture.endTime || lastDeparture.startTime).getTime();

        let durationMinutes = Math.floor((lastEndTimeMs - firstTimeMs) / (1000 * 60));

        // Ako je durationMinutes negativan, znači da smena prelazi preko ponoći (npr. 18:19 → 02:00)
        // U tom slučaju dodaj 24h (1440 minuta)
        if (durationMinutes < 0) {
          durationMinutes += 24 * 60; // Dodaj 24 sata
        }

        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;
        const durationFormatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

        // Vratimo kompletan formatiran string za vreme trajanja
        // Format: "04:00 - 23:15 (19:15)"
        const timeDisplay = `${firstTime} - ${lastEndTime} (${durationFormatted})`;

        return {
          id: group.id,
          date: group.date,
          lineNumber: group.lineNumber,
          lineName: group.lineName,
          turnusId: group.turnusId,
          turnusName: group.turnusName,
          shiftNumber: group.shiftNumber,
          turageNo: turnusDetails?.turageNo || 0,
          departureNoInTurage: turnusDetails?.departureNoInTurage || 0,
          turnusStartTime: firstTime,  // Za eventualnu buduću upotrebu
          turnusDuration: timeDisplay,  // Kompletan formatiran string
          departuresCount,
          driverId: group.driverId,
          driverName: group.driverName,
          startTime: firstDeparture.startTime,
        };
      })
    );

    // Sortiraj po: 1) linija, 2) turaža (natural sort), 3) smena
    return schedulesWithDetails.sort((a, b) => {
      // 1. Prvo po broju linije
      const lineCompare = a.lineNumber.localeCompare(b.lineNumber, undefined, { numeric: true });
      if (lineCompare !== 0) return lineCompare;

      // 2. Zatim po nazivu turaže (natural sort)
      const turnusCompare = a.turnusName.localeCompare(b.turnusName, undefined, { numeric: true });
      if (turnusCompare !== 0) return turnusCompare;

      // 3. Na kraju po smeni
      return a.shiftNumber - b.shiftNumber;
    });
  }

  /**
   * Helper: Izračunaj ime dana u nedelji iz datuma
   */
  private getDayNameFromDate(dateString: string): string {
    const date = new Date(dateString);
    const dayIndex = date.getDay(); // 0 = Nedelja, 1 = Ponedeljak, ...

    const dayNames = [
      'Nedelja',
      'Ponedeljak',
      'Utorak',
      'Sreda',
      'Četvrtak',
      'Petak',
      'Subota',
    ];

    return dayNames[dayIndex];
  }

  /**
   * Obriši raspored - briše SVE polaske za turnus/smenu
   * Pošto sada upisujemo SVE polaske, moramo da obrišemo SVE polaske za taj turnus/smenu
   */
  async deleteSchedule(id: number, startDate: Date) {
    // Prvo pronađi jedan zapis da dobijemo informacije o turnus/smena/linija/vozač
    const schedule = await this.prisma.dateTravelOrder.findUnique({
      where: {
        id_startDate: {
          id,
          startDate,
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException(`Raspored sa ID ${id} nije pronađen`);
    }

    // Ekstraktuj turnus i smenu iz comment polja
    const turnusName = this.extractTurnusNameFromComment(schedule.comment);
    const shiftNumber = this.extractShiftFromComment(schedule.comment);

    // Obriši SVE polaske koji odgovaraju ovoj turnus/smena/linija/vozač kombinaciji
    const deleteResult = await this.prisma.dateTravelOrder.deleteMany({
      where: {
        startDate,
        lineNo: schedule.lineNo,
        driverId: schedule.driverId,
        comment: {
          contains: `Turnus: ${turnusName}, Smena: ${shiftNumber}`,
        },
      },
    });

    // Obriši i iz legacy date_shedule tabele
    await this.deleteFromLegacySchedule({
      lineNo: schedule.lineNo,
      startDate,
      driverId: schedule.driverId,
      turnusName,
      shiftNumber,
    });

    return {
      success: true,
      message: `Raspored uspešno obrisan (obrisano ${deleteResult.count} polazaka)`,
      deletedCount: deleteResult.count,
    };
  }

  /**
   * Helper: Ekstraktuj broj smene iz comment polja
   */
  private extractShiftFromComment(comment: string): number {
    const match = comment.match(/Smena: (\d+)/);
    return match ? parseInt(match[1]) : 1;
  }

  /**
   * Helper: Ekstraktuj ime turnusa iz comment polja
   */
  private extractTurnusNameFromComment(comment: string): string {
    const match = comment.match(/Turnus: ([^,]+)/);
    return match ? match[1].trim() : '';
  }

  /**
   * Sync raspored u legacy date_shedule tabelu
   * Upisuje SAMO planirane podatke (bez vozila i realizacije)
   */
  private async syncToLegacySchedule(data: {
    lineNo: string;
    lineName: string;
    startStation: string;
    endStation: string;
    startDate: Date;
    driverId: number;
    driverName: string;
    driverLegacyId: number | null;
    turnusId: number;
    turnusName: string;
    shiftNumber: number;
    departures: Array<{
      start_time: Date;
      duration: Date;
      direction: number;
      departure_number: number;
    }>;
  }) {
    try {
      // Za SVAKI polazak kreiraj zapis u date_shedule
      for (let i = 0; i < data.departures.length; i++) {
        const departure = data.departures[i];

        // Izračunaj end_time
        const startTime = new Date(departure.start_time);
        const duration = new Date(departure.duration);
        const endTime = new Date(startTime);
        endTime.setUTCHours(
          startTime.getUTCHours() + duration.getUTCHours(),
          startTime.getUTCMinutes() + duration.getUTCMinutes()
        );

        // Formatiraj datum za MySQL (YYYY-MM-DD)
        const dateStr = data.startDate.toISOString().split('T')[0];

        // Formatiraj vreme za MySQL (HH:MM:SS)
        const formatTime = (time: Date) => {
          const h = time.getUTCHours().toString().padStart(2, '0');
          const m = time.getUTCMinutes().toString().padStart(2, '0');
          const s = time.getUTCSeconds().toString().padStart(2, '0');
          return `${h}:${m}:${s}`;
        };

        const startTimeStr = formatTime(startTime);
        const endTimeStr = formatTime(endTime);

        // INSERT u date_shedule tabelu
        // Dodajemo SVA obavezna NOT NULL polja
        await this.prisma.$executeRawUnsafe(`
          INSERT INTO date_shedule (
            line_no, line_name,
            start_date, start_time, end_time, end_date,
            start_station, end_station,
            tt_start_date, tt_start_time,
            user_1_id_planned, user_1_id_realised,
            user_2_id_planned, user_2_id_realised,
            user_3_id_planned, user_3_id_realised,
            tour_id, turnus_departure_no,
            direction, ride_type, km_pred,
            planned_by, departure_status,
            bus_operator, bus_number,
            bus_garage_no, r_bus_garage_no,
            bus_registration, r_bus_registration,
            peron, r_peron,
            assigned_persons, r_assigned_persons,
            r_user_ids, user_ids,
            bus_reg_2, bus_gar_2,
            status, modified,
            departure_open_time, departure_close_time,
            last_station_update_time,
            first_station_time, last_station_time
          ) VALUES (
            '${data.lineNo}', '${data.lineName.replace(/'/g, "''")}',
            '${dateStr}', '${startTimeStr}', '${endTimeStr}', '${dateStr}',
            '${data.startStation.replace(/'/g, "''")}', '${data.endStation.replace(/'/g, "''")}',
            '${dateStr}', '${startTimeStr}',
            ${data.driverLegacyId || 0}, 0,
            0, 0,
            0, 0,
            ${data.turnusId}, ${departure.departure_number},
            ${departure.direction}, 0, 0,
            0, 0,
            '', 0,
            '', '',
            '', '',
            '', '',
            '${data.driverName.replace(/'/g, "''")}', '',
            '', '',
            '', '',
            1, 0,
            '1970-01-01 00:00:00', '1970-01-01 00:00:00',
            '1970-01-01 00:00:00',
            '1970-01-01 00:00:00', '1970-01-01 00:00:00'
          )
        `);
      }
    } catch (error) {
      // Ne blokiraj glavni proces ako sync ne uspe
      console.error('❌ Greška pri sinhronizaciji u date_shedule:', error.message);
      console.error('  Glavni proces planiranja nastavlja (upis u date_travel_order je uspeo)');
    }
  }

  /**
   * Obriši iz legacy date_shedule tabele
   */
  private async deleteFromLegacySchedule(data: {
    lineNo: string;
    startDate: Date;
    driverId: number;
    turnusName: string;
    shiftNumber: number;
  }) {
    try {
      const dateStr = data.startDate.toISOString().split('T')[0];

      // Prvo dobavi legacy_id vozača
      const driver = await this.prisma.user.findUnique({
        where: { id: data.driverId },
        select: { legacyId: true },
      });

      const result = await this.prisma.$executeRawUnsafe(`
        DELETE FROM date_shedule
        WHERE line_no = '${data.lineNo}'
          AND start_date = '${dateStr}'
          AND user_1_id_planned = ${driver?.legacyId || 0}
          AND tour_id IN (
            SELECT turnus_id
            FROM changes_codes_tours
            WHERE turnus_name = '${data.turnusName.replace(/'/g, "''")}'
              AND shift_number = ${data.shiftNumber}
            LIMIT 1
          )
      `);
    } catch (error) {
      // Ne blokiraj glavni proces ako sync ne uspe
      console.error('❌ Greška pri brisanju iz date_shedule:', error.message);
      console.error('  Glavni proces nastavlja (brisanje iz date_travel_order je uspelo)');
    }
  }

  /**
   * Dobavi imena početne i krajnje stanice za liniju
   */
  private async getLineStations(
    legacyTicketingId: number | null,
    dateValidFrom: string
  ): Promise<{ startStation: string; endStation: string }> {
    // Default vrednosti ako nešto ne uspe
    const defaultStations = { startStation: '', endStation: '' };

    if (!legacyTicketingId) {
      return defaultStations;
    }

    try {
      // Formatiraj datum u YYYY_MM_DD za ime tabele
      // dateValidFrom je string u formatu YYYY-MM-DD
      const dateStr = dateValidFrom.split('T')[0];
      const tableName = `price_lists_line_uids_${dateStr.replace(/-/g, '_')}`;

      // Proveri da li tabela postoji
      const tableExists = await this.checkIfTableExists(tableName);

      if (!tableExists) {
        return defaultStations;
      }

      // Dohvati početnu stanicu (MIN station_number)
      const startStationResult = await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT usil.station_name
        FROM ${tableName} plu
        LEFT JOIN unique_station_id_local usil ON usil.unique_id = plu.station_uid
        WHERE plu.price_tables_index_id = ?
          AND plu.active_flag = 1
        ORDER BY plu.station_number ASC
        LIMIT 1
        `,
        legacyTicketingId
      );

      // Dohvati krajnju stanicu (MAX station_number)
      const endStationResult = await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT usil.station_name
        FROM ${tableName} plu
        LEFT JOIN unique_station_id_local usil ON usil.unique_id = plu.station_uid
        WHERE plu.price_tables_index_id = ?
          AND plu.active_flag = 1
        ORDER BY plu.station_number DESC
        LIMIT 1
        `,
        legacyTicketingId
      );

      const startStation = startStationResult[0]?.station_name || '';
      const endStation = endStationResult[0]?.station_name || '';

      return { startStation, endStation };
    } catch (error) {
      console.error('❌ Greška pri dohvatanju imena stanica:', error.message);
      return defaultStations;
    }
  }

  /**
   * Helper metod za proveru postojanja tabele
   */
  private async checkIfTableExists(tableName: string): Promise<boolean> {
    const result = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ?
      `,
      tableName
    );
    return result[0].count > 0;
  }

  /**
   * Helper: Dobavi informacije o traženoj smeni (startTime, endTime, duration)
   */
  private async getRequestedShiftInfo(
    dto: GetDriversAvailabilityDto,
    turnusName: string,
    dayName: string
  ) {
    // Pronađi aktivne line_number varijante
    const activeLines = await this.prisma.line.findMany({
      where: {
        lineNumberForDisplay: dto.lineNumber,
        status: 'A',
      },
      select: { lineNumber: true },
    });

    const activeLineNumbers = activeLines.map(l => l.lineNumber);

    if (activeLineNumbers.length === 0) {
      throw new NotFoundException(`Nema aktivnih varijanti za liniju ${dto.lineNumber}`);
    }

    // Pronađi turnus_id sa najnovijim change_time
    const latestTurnusId = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT cct.turnus_id
       FROM changes_codes_tours cct
       INNER JOIN turnus_days td ON cct.turnus_id = td.turnus_id
       INNER JOIN \`lines\` l ON cct.line_no = l.line_number
       WHERE cct.turnus_name = '${turnusName}'
         AND cct.shift_number = ${dto.shiftNumber}
         AND cct.direction = 0
         AND td.dayname = '${dayName}'
         AND l.status = 'A'
       GROUP BY cct.turnus_id
       ORDER BY MAX(cct.change_time) DESC
       LIMIT 1`
    );

    if (!latestTurnusId || latestTurnusId.length === 0) {
      throw new NotFoundException(
        `Ne mogu da pronađem turnus ${turnusName}, smena ${dto.shiftNumber} za dan ${dayName}`
      );
    }

    const targetTurnusId = Number(latestTurnusId[0].turnus_id);

    // Dobavi polaske za traženi turnus/smenu
    const requestedDepartures = await this.prisma.$queryRaw<
      Array<{
        start_time: Date;
        duration: Date;
      }>
    >`
      SELECT cct.start_time, cct.duration
      FROM changes_codes_tours cct
      INNER JOIN turnus_days td ON cct.turnus_id = td.turnus_id
      INNER JOIN \`lines\` l ON cct.line_no = l.line_number
      WHERE cct.turnus_id = ${targetTurnusId}
        AND cct.shift_number = ${dto.shiftNumber}
        AND cct.direction = 0
        AND l.status = 'A'
      ORDER BY cct.start_time ASC
    `;

    if (requestedDepartures.length === 0) {
      throw new NotFoundException(
        `Nema polazaka za turnus ${turnusName}, smenu ${dto.shiftNumber}`
      );
    }

    // Izračunaj startTime, endTime i duration za traženi turnus
    const firstDep = requestedDepartures[0];
    const lastDep = requestedDepartures[requestedDepartures.length - 1];

    const formatTime = (timeValue: Date) => {
      return `${timeValue.getUTCHours().toString().padStart(2, '0')}:${timeValue.getUTCMinutes().toString().padStart(2, '0')}`;
    };

    // Izračunaj endTime za poslednji polazak
    const lastDepStart = new Date(lastDep.start_time);
    const lastDepDuration = new Date(lastDep.duration);
    const lastDepEnd = new Date(lastDepStart);
    lastDepEnd.setUTCHours(
      lastDepStart.getUTCHours() + lastDepDuration.getUTCHours(),
      lastDepStart.getUTCMinutes() + lastDepDuration.getUTCMinutes()
    );

    const requestedStartTime = formatTime(firstDep.start_time);
    const requestedEndTime = formatTime(lastDepEnd);

    // Izračunaj duration
    const startMs = firstDep.start_time.getTime();
    const endMs = lastDepEnd.getTime();
    let durationMinutes = Math.floor((endMs - startMs) / (1000 * 60));

    if (durationMinutes < 0) {
      durationMinutes += 24 * 60;
    }

    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    const requestedDuration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    return {
      startTime: requestedStartTime,
      endTime: requestedEndTime,
      duration: requestedDuration,
      turnusName,
      shiftNumber: dto.shiftNumber,
      lineNumber: dto.lineNumber,
    };
  }
}
