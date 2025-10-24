import { Injectable, NotFoundException, ConflictException, MessageEvent, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import {
  CreateMonthlyScheduleDto,
  ConflictResolution,
} from './dto/create-monthly-schedule.dto';
import { GetDriversAvailabilityDto } from './dto/get-drivers-availability.dto';
import { DriverReportDto } from './dto/monthly-driver-report.dto';
import { Observable } from 'rxjs';
import { LinkedTurnusiService } from '../linked-turnusi/linked-turnusi.service';

@Injectable()
export class PlanningService {
  private readonly logger = new Logger(PlanningService.name);

  constructor(
    private prisma: PrismaService,
    private linkedTurnusiService: LinkedTurnusiService,
  ) {}

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
    // VAŽNO: Filtrira samo turnuse koji su važeći za odabrani datum (turnus_groups_assign)
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
      INNER JOIN turnus_groups_assign tga ON cct.turnus_id = tga.turnus_id
      INNER JOIN \`lines\` l ON cct.line_no = l.line_number
      LEFT JOIN price_variations pv ON l.price_variation_id = pv.id
      INNER JOIN price_table_groups ptg ON l.date_valid_from = ptg.date_valid_from
      WHERE l.line_number_for_display = ${lineNumber}
        AND l.status = 'A'
        AND ptg.status = 'A'
        AND ptg.synchro_status = 'A'
        AND td.dayname = ${dayName}
        AND DATE(${date}) BETWEEN tga.date_from AND tga.date_to
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
  async createSchedule(dto: CreateScheduleDto, userId: number, skipLinkedCheck = false) {
    // 🔗 PROVERA LINKED TURNUSA (samo ako nije rekurzivni poziv)
    if (!skipLinkedCheck) {
      const turnusInfo = await this.prisma.changesCodesTours.findFirst({
        where: { turnusId: dto.turnusId },
        select: { turnusName: true },
      });

      if (turnusInfo) {
        const linkedInfo = await this.getLinkedTurnusInfo(
          dto.lineNumber,
          turnusInfo.turnusName,
          dto.shiftNumber,
          dto.date,
        );

        if (linkedInfo.hasLink && linkedInfo.linkedTurnus && linkedInfo.chronologicalOrder) {
          // Proveri da li linked turnus već ima raspored
          const existingSchedules = await this.getSchedulesByDate(dto.date);
          const linkedSchedule = existingSchedules.find(
            (s) =>
              s.turnusName === linkedInfo.linkedTurnus!.turnusName &&
              s.lineNumber === linkedInfo.linkedTurnus!.lineNumber &&
              s.shiftNumber === linkedInfo.linkedTurnus!.shiftNumber,
          );

          // Ako linked turnus već ima raspored sa DRUGIM vozačem - blokiraj
          if (linkedSchedule && linkedSchedule.driverId !== dto.driverId) {
            throw new ConflictException(
              `Linked turnus ${linkedInfo.linkedTurnus.turnusName} je već isplaniran za vozača ${linkedSchedule.driverName}. ` +
                `Moguće je isplanirati oba turnusa samo sa istim vozačem.`,
            );
          }

          // Ako linked turnus još nije isplaniran, kreiraj oba u hronološkom redosledu
          if (!linkedSchedule) {
            const firstTurnus = linkedInfo.chronologicalOrder.first;
            const secondTurnus = linkedInfo.chronologicalOrder.second;

            // Kreiraj prvi turnus
            const firstDto: CreateScheduleDto = {
              date: dto.date,
              lineNumber: firstTurnus.lineNumber,
              turnusId: firstTurnus.turnusId,
              shiftNumber: firstTurnus.shiftNumber,
              driverId: dto.driverId,
            };

            // Kreiraj drugi turnus
            const secondDto: CreateScheduleDto = {
              date: dto.date,
              lineNumber: secondTurnus.lineNumber,
              turnusId: secondTurnus.turnusId,
              shiftNumber: secondTurnus.shiftNumber,
              driverId: dto.driverId,
            };

            // Pozovi createSchedule za oba turnusa (sa skipLinkedCheck = true da se spreči rekurzija)
            const firstResult = await this.createSchedule(firstDto, userId, true);
            const secondResult = await this.createSchedule(secondDto, userId, true);

            // Vrati kombinovani rezultat
            return {
              ...firstResult,
              linkedTurnus: secondResult,
              message: `Uspešno kreirani linked turnusi: ${firstTurnus.turnusName} i ${secondTurnus.turnusName}`,
            };
          }
        }
      }
    }

    // Dobavi dodatne informacije za popunjavanje date_travel_order
    const line = await this.prisma.line.findFirst({
      where: { lineNumberForDisplay: dto.lineNumber },
    });

    if (!line) {
      throw new NotFoundException(`Linija ${dto.lineNumber} nije pronađena`);
    }

    // Prvo pronađi ime turnusa po turnusId
    const turnusInfo = await this.prisma.changesCodesTours.findFirst({
      where: { turnusId: Number(dto.turnusId) }, // Konvertuj BigInt u Number za Prisma
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
    // VAŽNO: Filtrira samo turnuse koji su važeći za odabrani datum (turnus_groups_assign)
    const latestTurnusId = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT cct.turnus_id, MAX(cct.change_time) as max_change_time
       FROM changes_codes_tours cct
       INNER JOIN turnus_days td ON cct.turnus_id = td.turnus_id
       INNER JOIN turnus_groups_assign tga ON cct.turnus_id = tga.turnus_id
       INNER JOIN \`lines\` l ON cct.line_no = l.line_number
       WHERE cct.turnus_name = '${turnusInfo.turnusName}'
         AND cct.shift_number = ${dto.shiftNumber}
         AND cct.direction = 0
         AND td.dayname = '${dayName}'
         AND l.status = 'A'
         AND DATE('${dto.date}') BETWEEN tga.date_from AND tga.date_to
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
    // VAŽNO: Filtrira samo turnuse koji su važeći za odabrani datum (turnus_groups_assign)
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
      INNER JOIN turnus_groups_assign tga ON cct.turnus_id = tga.turnus_id
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
        AND DATE(${dto.date}) BETWEEN tga.date_from AND tga.date_to
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

    // PRVO: Kreiraj zapise u date_shedule tabeli i dobij ID-eve
    // Ovo mora biti PRE kreiranja date_travel_order zapisa jer sheduleId mora da pokazuje na date_shedule.id
    const dateSheduleIds = await this.syncToLegacySchedule({
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

    // DRUGO: Kreiraj zapise u date_travel_order sa pravim sheduleId
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
          sheduleId: dateSheduleIds[i], // Koristi pravi ID iz date_shedule tabele
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
   * Dobavi rasporede za ceo mesec i liniju
   * Agregira rasporede za sve dane u mesecu za odabranu liniju
   */
  async getMonthlySchedulesByLine(query: {
    month: number;
    year: number;
    lineNumber: string;
  }) {
    // Generiši sve datume u mesecu
    const allDates = this.getAllDatesInMonth(query.month, query.year);

    // Za svaki datum dobavi rasporede
    const allSchedules: Awaited<ReturnType<typeof this.getSchedulesByDate>> = [];

    for (const date of allDates) {
      const formattedDate = this.formatDateForQuery(date);
      const schedulesForDate = await this.getSchedulesByDate(formattedDate);

      // Filtriraj samo rasporede za odabranu liniju
      const filteredSchedules = schedulesForDate.filter(
        (schedule) => schedule.lineNumber === query.lineNumber
      );

      allSchedules.push(...filteredSchedules);
    }

    // Sortiraj po datumu, zatim po turnusu, zatim po smeni
    return allSchedules.sort((a, b) => {
      // 1. Prvo po datumu
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare !== 0) return dateCompare;

      // 2. Zatim po nazivu turaže (natural sort)
      const turnusCompare = a.turnusName.localeCompare(b.turnusName, undefined, { numeric: true });
      if (turnusCompare !== 0) return turnusCompare;

      // 3. Na kraju po smeni
      return a.shiftNumber - b.shiftNumber;
    });
  }

  /**
   * Dobavi dostupne turaže za odabranu liniju, smenu i dan
   * Vraća SVE turaže koje saobraćaju na toj liniji, imaju odabranu smenu i saobraćaju tog dana
   * Npr. za liniju 18, smena 1, Subota → vraća: 00018-1, 00018-8, 00018-12
   * Koristi se za dropdown u Mesečnom tab-u (Subota/Nedelja)
   */
  async getTurageOptions(dto: {
    lineNumber: string;
    turnusName: string;
    shiftNumber: number;
    dayOfWeek: 'Subota' | 'Nedelja';
  }) {
    const { lineNumber, shiftNumber, dayOfWeek } = dto;

    // Dobavi liniju da bi dobio line_number (ne lineNumberForDisplay!)
    const lines = await this.prisma.line.findMany({
      where: {
        lineNumberForDisplay: lineNumber,
        status: 'A',
      },
    });

    if (lines.length === 0) {
      throw new NotFoundException(`Linija ${lineNumber} nije pronađena`);
    }

    const lineNumbers = lines.map((line) => line.lineNumber);

    // Query za dobijanje svih turaža za odabranu liniju, smenu i dan
    const turageOptions = await this.prisma.$queryRaw<
      Array<{
        turnus_name: string;
        departure_count: number;
      }>
    >`
      SELECT DISTINCT
        cct.turnus_name,
        COUNT(*) as departure_count
      FROM changes_codes_tours cct
      INNER JOIN turnus_days td ON cct.turnus_id = td.turnus_id
      INNER JOIN \`lines\` l ON cct.line_no = l.line_number
      WHERE l.line_number IN (${Prisma.join(lineNumbers)})
        AND td.dayname = ${dayOfWeek}
        AND cct.shift_number = ${shiftNumber}
        AND l.status = 'A'
        AND cct.direction = 0
      GROUP BY cct.turnus_name
      ORDER BY cct.turnus_name ASC
    `;

    // Formatiranje za react-select
    return turageOptions.map((option) => ({
      value: option.turnus_name,
      label: `${option.turnus_name} (${option.departure_count} polazaka)`,
    }));
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
   * Obriši raspored za ceo mesec - briše SVE polaske za turnus/smenu u celom mesecu
   */
  async deleteMonthlySchedule(params: {
    id: number;
    startDate: Date;
    month: number;
    year: number;
    lineNumber: string;
    turnusName: string;
    shiftNumber: number;
  }) {
    // Generiši sve datume u mesecu
    const allDates = this.getAllDatesInMonth(params.month, params.year);

    let totalDeletedCount = 0;
    let daysDeleted = 0;

    // Za svaki datum u mesecu obriši rasporede
    for (const date of allDates) {
      try {
        const formattedDate = this.formatDateForQuery(date);
        const dateForQuery = new Date(formattedDate);

        // Pronađi rasporede za taj datum, liniju, turnus i smenu
        const schedulesForDate = await this.prisma.dateTravelOrder.findMany({
          where: {
            startDate: dateForQuery,
            lineNo: params.lineNumber,
            comment: {
              contains: `Turnus: ${params.turnusName}, Smena: ${params.shiftNumber}`,
            },
          },
        });

        // Ako postoje rasporedi za taj datum
        if (schedulesForDate.length > 0) {
          // Uzmi driverId iz prvog rasporeda
          const driverId = schedulesForDate[0].driverId;

          // Obriši SVE polaske za taj datum
          const deleteResult = await this.prisma.dateTravelOrder.deleteMany({
            where: {
              startDate: dateForQuery,
              lineNo: params.lineNumber,
              driverId,
              comment: {
                contains: `Turnus: ${params.turnusName}, Smena: ${params.shiftNumber}`,
              },
            },
          });

          totalDeletedCount += deleteResult.count;
          daysDeleted++;

          // Obriši i iz legacy date_shedule tabele
          await this.deleteFromLegacySchedule({
            lineNo: params.lineNumber,
            startDate: dateForQuery,
            driverId,
            turnusName: params.turnusName,
            shiftNumber: params.shiftNumber,
          });
        }
      } catch (error) {
        this.logger.error(
          `Greška pri brisanju rasporeda za datum ${date.toISOString()}:`,
          error,
        );
        // Nastavi sa sledećim datumom
      }
    }

    return {
      success: true,
      message: `Mesečni raspored uspešno obrisan (obrisano ${totalDeletedCount} polazaka za ${daysDeleted} dana)`,
      deletedCount: totalDeletedCount,
      daysDeleted,
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
   * @returns Niz ID-eva kreiranih zapisa u date_shedule tabeli
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
  }): Promise<number[]> {
    const createdIds: number[] = [];

    try {
      // Za SVAKI polazak kreiraj zapis u date_shedule
      for (let i = 0; i < data.departures.length; i++) {
        const departure = data.departures[i];

        // Izračunaj end_time (direktno koristi Date objekte iz MySQL-a)
        const startTime = departure.start_time;
        const duration = departure.duration;
        const endTime = new Date(startTime);
        endTime.setUTCHours(
          startTime.getUTCHours() + duration.getUTCHours(),
          startTime.getUTCMinutes() + duration.getUTCMinutes(),
          startTime.getUTCSeconds() + duration.getUTCSeconds()
        );

        // Kreiraj zapis koristeći Prisma - direktno koristi Date objekte bez konverzije
        const createdSchedule = await this.prisma.dateShedule.create({
          data: {
            lineNo: data.lineNo,
            lineName: data.lineName,
            startDate: data.startDate,
            startTime: startTime,
            endTime: endTime,
            endDate: data.startDate,
            startStation: data.startStation,
            endStation: data.endStation,
            ttStartDate: data.startDate,
            ttStartTime: startTime,
            user1IdPlanned: data.driverLegacyId || 0,
            user1IdRealised: 0,
            user2IdPlanned: 0,
            user2IdRealised: 0,
            user3IdPlanned: 0,
            user3IdRealised: 0,
            tourId: data.turnusId,
            turnusDepartureNo: departure.departure_number,
            direction: departure.direction,
            rideType: 0,
            kmPred: 0,
            plannedBy: 0,
            departureStatus: 0,
            busOperator: '',
            busNumber: 0,
            busGarageNo: '',
            rBusGarageNo: '',
            busRegistration: '',
            rBusRegistration: '',
            peron: '',
            rPeron: '',
            assignedPersons: data.driverName,
            rAssignedPersons: '',
            rUserIds: '',
            userIds: '',
            busReg2: '',
            busGar2: '',
            status: 1,
            modified: 0,
            departureOpenTime: new Date('1970-01-01T00:00:00.000Z'),
            departureCloseTime: new Date('1970-01-01T00:00:00.000Z'),
            lastStationUpdateTime: new Date('1970-01-01T00:00:00.000Z'),
            firstStationTime: new Date('1970-01-01T00:00:00.000Z'),
            lastStationTime: new Date('1970-01-01T00:00:00.000Z'),
          },
        });

        createdIds.push(createdSchedule.id);
      }

      return createdIds;
    } catch (error) {
      // Ne blokiraj glavni proces ako sync ne uspe
      console.error('❌ Greška pri sinhronizaciji u date_shedule:', error.message);
      console.error('  Glavni proces planiranja nastavlja, ali sheduleId će biti 0');

      // Vrati niz nula da označimo da nisu kreirani pravi ID-evi
      return new Array(data.departures.length).fill(0);
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

      // Prvo dobavi turnus_id da izbegneš LIMIT u subquery-ju
      const turnusResult = await this.prisma.$queryRawUnsafe<Array<{ turnus_id: number }>>(`
        SELECT turnus_id
        FROM changes_codes_tours
        WHERE turnus_name = '${data.turnusName.replace(/'/g, "''")}'
          AND shift_number = ${data.shiftNumber}
        LIMIT 1
      `);

      if (turnusResult && turnusResult.length > 0) {
        const turnusId = turnusResult[0].turnus_id;

        await this.prisma.$executeRawUnsafe(`
          DELETE FROM date_shedule
          WHERE line_no = '${data.lineNo}'
            AND start_date = '${dateStr}'
            AND user_1_id_planned = ${driver?.legacyId || 0}
            AND tour_id = ${turnusId}
        `);
      }
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

  /**
   * Helper: Generiši sve datume u mesecu
   */
  private getAllDatesInMonth(month: number, year: number): Date[] {
    const dates: Date[] = [];
    const daysInMonth = new Date(year, month, 0).getDate(); // 0 = poslednji dan prethodnog meseca

    for (let day = 1; day <= daysInMonth; day++) {
      dates.push(new Date(year, month - 1, day));
    }

    return dates;
  }

  /**
   * Helper: Filtriraj datume po includedDaysOfWeek
   * VAŽNO: Ne proverava turnus_days ovde, to se radi kasnije u async metodu
   */
  private filterDatesByDaysOfWeek(
    dates: Date[],
    includedDaysOfWeek: number[],
  ): Date[] {
    return dates.filter((date) => {
      const dayOfWeek = date.getDay(); // 0 = Nedelja, 1 = Ponedeljak, ..., 6 = Subota

      // Filtriraj samo po includedDaysOfWeek
      return includedDaysOfWeek.includes(dayOfWeek);
    });
  }

  /**
   * Helper: Proveri da li turnus saobraćaju na određeni dan u nedelji za dati datum
   */
  private async checkIfTurnusRunsOnDay(
    turnusName: string,
    date: Date,
  ): Promise<boolean> {
    const dayName = this.getDayNameFromDate(this.formatDateForQuery(date));

    // Proveri da li turnus saobraćaju tog dana u nedelji
    const turnusDaysCheck = await this.prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*) as count
      FROM changes_codes_tours cct
      INNER JOIN turnus_days td ON cct.turnus_id = td.turnus_id
      INNER JOIN turnus_groups_assign tga ON cct.turnus_id = tga.turnus_id
      WHERE cct.turnus_name = ${turnusName}
        AND td.dayname = ${dayName}
        AND DATE(${this.formatDateForQuery(date)}) BETWEEN tga.date_from AND tga.date_to
    `;

    return turnusDaysCheck[0]?.count > 0;
  }

  /**
   * Helper: Filtriraj datume po excludedDaysOfWeek (isključi specifične datume)
   * Ovo se primenjuje NAKON što su datumi već filtrirani po includedDaysOfWeek i turnus_days
   */
  private filterExcludedDates(
    dates: Date[],
    excludedDaysOfWeek: number[],
  ): Date[] {
    if (excludedDaysOfWeek.length === 0) {
      return dates;
    }

    return dates.filter((date) => {
      const dayOfWeek = date.getDay();
      // Isključi samo one datume čiji dan u nedelji je u excludedDaysOfWeek
      return !excludedDaysOfWeek.includes(dayOfWeek);
    });
  }

  /**
   * Helper: Proveri postojeće rasporede za vozača u datim datumima
   */
  private async checkExistingSchedules(
    dates: Date[],
    driverId: number,
  ): Promise<Date[]> {
    const existingDates: Date[] = [];

    for (const date of dates) {
      const formattedDate = this.formatDateForQuery(date);
      const existing = await this.prisma.dateTravelOrder.findFirst({
        where: {
          startDate: new Date(formattedDate),
          driverId,
        },
      });

      if (existing) {
        existingDates.push(date);
      }
    }

    return existingDates;
  }

  /**
   * Helper: Formatiraj datum za query (YYYY-MM-DD)
   */
  private formatDateForQuery(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Kreiraj mesečni raspored
   * Omogućava kreiranje rasporeda za ceo mesec sa isključivanjem specifičnih dana u nedelji
   */
  async createMonthlySchedule(
    dto: CreateMonthlyScheduleDto,
    userId: number,
  ) {
    // Validacija - proveri da li vozač postoji
    const driver = await this.prisma.user.findUnique({
      where: { id: dto.driverId },
      include: { userGroup: true },
    });

    if (!driver || !driver.userGroup?.driver) {
      throw new NotFoundException(
        `Vozač sa ID ${dto.driverId} nije pronađen`,
      );
    }

    // 1. Generiši sve datume u mesecu
    const allDates = this.getAllDatesInMonth(dto.month, dto.year);

    // 2. Filtriraj datume po includedDaysOfWeek (npr. samo Subote)
    const datesByDayOfWeek = this.filterDatesByDaysOfWeek(
      allDates,
      dto.includedDaysOfWeek,
    );

    if (datesByDayOfWeek.length === 0) {
      throw new NotFoundException(
        'Nema datuma koji odgovaraju odabranim danima u nedelji',
      );
    }

    // 3. Proveri za svaki datum da li turnus saobraćaju tog dana (turnus_days)
    const datesWhereTurnusRuns: Date[] = [];
    for (const date of datesByDayOfWeek) {
      const turnusRuns = await this.checkIfTurnusRunsOnDay(dto.turnusName, date);
      if (turnusRuns) {
        datesWhereTurnusRuns.push(date);
      }
    }

    if (datesWhereTurnusRuns.length === 0) {
      throw new NotFoundException(
        `Turnus ${dto.turnusName} ne saobraćaju ni jednog od odabranih dana u nedelji`,
      );
    }

    // 4. Primeni excludedDaysOfWeek (isključi specifične datume)
    const validDates = this.filterExcludedDates(
      datesWhereTurnusRuns,
      dto.excludedDaysOfWeek,
    );

    if (validDates.length === 0) {
      throw new NotFoundException(
        'Nema validnih dana za planiranje nakon isključivanja specifičnih dana',
      );
    }

    // 3. Proveri postojeće rasporede
    const existingDates = await this.checkExistingSchedules(
      validDates,
      dto.driverId,
    );

    // Ako ima duplikata i nema conflict resolution, vrati conflict info
    if (existingDates.length > 0 && !dto.conflictResolution) {
      return {
        conflict: {
          hasConflict: true,
          conflictDates: existingDates.map((d) => this.formatDateForQuery(d)),
          conflictCount: existingDates.length,
        },
        totalDays: validDates.length,
        message:
          'Vozač već ima raspored za neke datume. Molimo odaberite akciju: prepiši ili preskoči.',
      };
    }

    // 3.5. Pronađi turnusId na osnovu lineNumber, date i turnusName
    // Koristimo prvi dan meseca kao referentni datum
    const firstDayOfMonth = this.formatDateForQuery(validDates[0]);
    const turnusiForLine = await this.getTurnusiByLineAndDate(
      dto.lineNumber,
      firstDayOfMonth,
    );

    const matchingTurnus = turnusiForLine.find(
      (t) => t.turnusName === dto.turnusName,
    );

    if (!matchingTurnus) {
      throw new NotFoundException(
        `Turnus "${dto.turnusName}" nije pronađen za liniju ${dto.lineNumber}`,
      );
    }

    const turnusId = matchingTurnus.turnusId;

    // 4. Odluči koje datume da procesuješ
    let datesToProcess: Date[] = [];

    if (dto.conflictResolution === ConflictResolution.SKIP) {
      // Preskoči datume sa postojećim rasporedima
      datesToProcess = validDates.filter(
        (d) =>
          !existingDates.some(
            (ed) => this.formatDateForQuery(ed) === this.formatDateForQuery(d),
          ),
      );
    } else if (dto.conflictResolution === ConflictResolution.OVERWRITE) {
      // Prvo obriši postojeće rasporede za conflict datume
      for (const conflictDate of existingDates) {
        const formattedDate = this.formatDateForQuery(conflictDate);
        await this.prisma.dateTravelOrder.deleteMany({
          where: {
            startDate: new Date(formattedDate),
            driverId: dto.driverId,
          },
        });
      }
      datesToProcess = validDates;
    } else {
      // Nema conflict resolution i nema duplikata
      datesToProcess = validDates;
    }

    // 5. Kreiraj rasporede za sve datume
    const results: Array<{
      date: string;
      status: 'success' | 'error';
      departuresCount?: number;
      error?: string;
    }> = [];
    let successCount = 0;
    let errorCount = 0;

    for (const date of datesToProcess) {
      try {
        const formattedDate = this.formatDateForQuery(date);

        const result = await this.createSchedule(
          {
            date: formattedDate,
            lineNumber: dto.lineNumber,
            turnusId: turnusId,
            shiftNumber: dto.shiftNumber,
            driverId: dto.driverId,
          },
          userId,
        );

        results.push({
          date: formattedDate,
          status: 'success',
          departuresCount: result.departuresCount,
        });
        successCount++;
      } catch (error) {
        results.push({
          date: this.formatDateForQuery(date),
          status: 'error',
          error: error.message,
        });
        errorCount++;
      }
    }

    // 6. Vrati sumarni rezultat
    return {
      totalDays: validDates.length,
      processedDays: datesToProcess.length,
      successCount,
      skippedCount:
        dto.conflictResolution === ConflictResolution.SKIP
          ? existingDates.length
          : 0,
      errorCount,
      results,
      summary: {
        month: dto.month,
        year: dto.year,
        lineNumber: dto.lineNumber,
        turnusName: dto.turnusName,
        shiftNumber: dto.shiftNumber,
        driverName: `${driver.firstName} ${driver.lastName}`,
        excludedDaysOfWeek: dto.excludedDaysOfWeek,
      },
    };
  }

  /**
   * Kreiraj mesečni raspored sa real-time progress streaming (SSE)
   * Emituje progress event nakon obrade svakog dana
   */
  createMonthlyScheduleStream(
    dto: CreateMonthlyScheduleDto,
    userId: number,
  ): Observable<MessageEvent> {
    return new Observable((observer) => {
      (async () => {
        try {
          // Validacija - proveri da li vozač postoji
          const driver = await this.prisma.user.findUnique({
            where: { id: dto.driverId },
            include: { userGroup: true },
          });

          if (!driver || !driver.userGroup?.driver) {
            observer.error(
              new NotFoundException(
                `Vozač sa ID ${dto.driverId} nije pronađen`,
              ),
            );
            return;
          }

          // 1. Generiši sve datume u mesecu
          const allDates = this.getAllDatesInMonth(dto.month, dto.year);

          // 2. Filtriraj datume po includedDaysOfWeek (npr. samo Subote)
          const datesByDayOfWeek = this.filterDatesByDaysOfWeek(
            allDates,
            dto.includedDaysOfWeek,
          );

          if (datesByDayOfWeek.length === 0) {
            observer.error(
              new NotFoundException(
                'Nema datuma koji odgovaraju odabranim danima u nedelji',
              ),
            );
            return;
          }

          // 3. Proveri za svaki datum da li turnus saobraćaju tog dana (turnus_days)
          const datesWhereTurnusRuns: Date[] = [];
          for (const date of datesByDayOfWeek) {
            const turnusRuns = await this.checkIfTurnusRunsOnDay(dto.turnusName, date);
            if (turnusRuns) {
              datesWhereTurnusRuns.push(date);
            }
          }

          if (datesWhereTurnusRuns.length === 0) {
            observer.error(
              new NotFoundException(
                `Turnus ${dto.turnusName} ne saobraćaju ni jednog od odabranih dana u nedelji`,
              ),
            );
            return;
          }

          // 4. Primeni excludedDaysOfWeek (isključi specifične datume)
          const validDates = this.filterExcludedDates(
            datesWhereTurnusRuns,
            dto.excludedDaysOfWeek,
          );

          if (validDates.length === 0) {
            observer.error(
              new NotFoundException(
                'Nema validnih dana za planiranje nakon isključivanja specifičnih dana',
              ),
            );
            return;
          }

          // 3. Proveri postojeće rasporede
          const existingDates = await this.checkExistingSchedules(
            validDates,
            dto.driverId,
          );

          // Ako ima duplikata i nema conflict resolution, vrati conflict info
          if (existingDates.length > 0 && !dto.conflictResolution) {
            observer.next({
              data: {
                type: 'conflict',
                conflict: {
                  hasConflict: true,
                  conflictDates: existingDates.map((d) =>
                    this.formatDateForQuery(d),
                  ),
                  conflictCount: existingDates.length,
                },
                totalDays: validDates.length,
                message:
                  'Vozač već ima raspored za neke datume. Molimo odaberite akciju: prepiši ili preskoči.',
              },
            } as MessageEvent);
            observer.complete();
            return;
          }

          // 3.5. Pronađi turnusId
          const firstDayOfMonth = this.formatDateForQuery(validDates[0]);
          const turnusiForLine = await this.getTurnusiByLineAndDate(
            dto.lineNumber,
            firstDayOfMonth,
          );

          const matchingTurnus = turnusiForLine.find(
            (t) => t.turnusName === dto.turnusName,
          );

          if (!matchingTurnus) {
            observer.error(
              new NotFoundException(
                `Turnus "${dto.turnusName}" nije pronađen za liniju ${dto.lineNumber}`,
              ),
            );
            return;
          }

          const turnusId = matchingTurnus.turnusId;

          // 3.6. Pronađi turnusId za Subotu i Nedelju (ako su odabrani)
          let saturdayTurnusId: number | null = null;
          let sundayTurnusId: number | null = null;

          if (dto.saturdayTurnusName) {
            const saturdayTurnus = turnusiForLine.find(
              (t) => t.turnusName === dto.saturdayTurnusName,
            );

            if (!saturdayTurnus) {
              observer.error(
                new NotFoundException(
                  `Turnus za Subotu "${dto.saturdayTurnusName}" nije pronađen za liniju ${dto.lineNumber}`,
                ),
              );
              return;
            }

            saturdayTurnusId = saturdayTurnus.turnusId;

            // Validacija: proveri da li turnus saobraćaju Subotom
            const saturdayDate = validDates.find((d) => d.getDay() === 6);
            if (saturdayDate) {
              const runs = await this.checkIfTurnusRunsOnDay(
                dto.saturdayTurnusName,
                saturdayDate,
              );
              if (!runs) {
                observer.error(
                  new NotFoundException(
                    `Turnus za Subotu "${dto.saturdayTurnusName}" ne saobraća Subotom`,
                  ),
                );
                return;
              }
            }
          }

          if (dto.sundayTurnusName) {
            const sundayTurnus = turnusiForLine.find(
              (t) => t.turnusName === dto.sundayTurnusName,
            );

            if (!sundayTurnus) {
              observer.error(
                new NotFoundException(
                  `Turnus za Nedelju "${dto.sundayTurnusName}" nije pronađen za liniju ${dto.lineNumber}`,
                ),
              );
              return;
            }

            sundayTurnusId = sundayTurnus.turnusId;

            // Validacija: proveri da li turnus saobraćaju Nedeljom
            const sundayDate = validDates.find((d) => d.getDay() === 0);
            if (sundayDate) {
              const runs = await this.checkIfTurnusRunsOnDay(
                dto.sundayTurnusName,
                sundayDate,
              );
              if (!runs) {
                observer.error(
                  new NotFoundException(
                    `Turnus za Nedelju "${dto.sundayTurnusName}" ne saobraća Nedeljom`,
                  ),
                );
                return;
              }
            }
          }

          // 4. Odluči koje datume da procesuješ
          let datesToProcess: Date[] = [];

          if (dto.conflictResolution === ConflictResolution.SKIP) {
            datesToProcess = validDates.filter(
              (d) =>
                !existingDates.some(
                  (ed) =>
                    this.formatDateForQuery(ed) === this.formatDateForQuery(d),
                ),
            );
          } else if (dto.conflictResolution === ConflictResolution.OVERWRITE) {
            // Obriši postojeće rasporede
            for (const conflictDate of existingDates) {
              const formattedDate = this.formatDateForQuery(conflictDate);
              await this.prisma.dateTravelOrder.deleteMany({
                where: {
                  startDate: new Date(formattedDate),
                  driverId: dto.driverId,
                },
              });
            }
            datesToProcess = validDates;
          } else {
            datesToProcess = validDates;
          }

          // 5. Kreiraj rasporede sa streaming progress updates
          const results: Array<{
            date: string;
            status: 'success' | 'error';
            departuresCount?: number;
            error?: string;
          }> = [];
          let successCount = 0;
          let errorCount = 0;

          for (let i = 0; i < datesToProcess.length; i++) {
            const date = datesToProcess[i];
            try {
              const formattedDate = this.formatDateForQuery(date);

              // Odredi koji turnusId koristiti zavisno od dana u nedelji
              const dayOfWeek = date.getDay(); // 0=Nedelja, 6=Subota
              let turnusIdForDate = turnusId; // Default: globalni turnus

              if (dayOfWeek === 6 && saturdayTurnusId) {
                // Ako je Subota i odabran je poseban turnus za Subotu
                turnusIdForDate = saturdayTurnusId;
              } else if (dayOfWeek === 0 && sundayTurnusId) {
                // Ako je Nedelja i odabran je poseban turnus za Nedelju
                turnusIdForDate = sundayTurnusId;
              }

              const result = await this.createSchedule(
                {
                  date: formattedDate,
                  lineNumber: dto.lineNumber,
                  turnusId: turnusIdForDate,
                  shiftNumber: dto.shiftNumber,
                  driverId: dto.driverId,
                },
                userId,
              );

              results.push({
                date: formattedDate,
                status: 'success',
                departuresCount: result.departuresCount,
              });
              successCount++;
            } catch (error) {
              results.push({
                date: this.formatDateForQuery(date),
                status: 'error',
                error: error.message,
              });
              errorCount++;
            }

            // Emitiraj progress update nakon obrade svakog dana
            observer.next({
              data: {
                type: 'progress',
                current: i + 1,
                total: datesToProcess.length,
                status:
                  i + 1 === datesToProcess.length ? 'success' : 'processing',
                results: [...results], // Šalji sve rezultate do sada
              },
            } as MessageEvent);
          }

          // 6. Emitiraj finalni rezultat
          observer.next({
            data: {
              type: 'complete',
              totalDays: validDates.length,
              processedDays: datesToProcess.length,
              successCount,
              skippedCount:
                dto.conflictResolution === ConflictResolution.SKIP
                  ? existingDates.length
                  : 0,
              errorCount,
              results,
              summary: {
                month: dto.month,
                year: dto.year,
                lineNumber: dto.lineNumber,
                turnusName: dto.turnusName,
                shiftNumber: dto.shiftNumber,
                driverName: `${driver.firstName} ${driver.lastName}`,
                excludedDaysOfWeek: dto.excludedDaysOfWeek,
              },
            },
          } as MessageEvent);

          observer.complete();
        } catch (error) {
          observer.error(error);
        }
      })();
    });
  }

  /**
   * Dobavi mesečni izveštaj vozača
   * Vraća listu vozača sa turnusima, linijama, smenama i slobodnim danima
   */
  async getMonthlyDriverReport(
    month: number,
    year: number,
  ): Promise<DriverReportDto[]> {
    // Napravi datum raspon za odabrani mesec
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay
      .toString()
      .padStart(2, '0')}`;

    // Query za dobijanje svih rasporeda u mesecu sa grupisanjem po vozaču
    const rawData = await this.prisma.$queryRaw<
      Array<{
        driver_id: number;
        driver_name: string;
        line_no: string;
        comment: string;
        working_days: string; // '1,2,3,4,5' (dani u nedelji kada vozač radi)
      }>
    >`
      SELECT
        dto.driver_id,
        dto.driver_name,
        dto.line_no,
        MIN(dto.comment) as comment,
        GROUP_CONCAT(DISTINCT DAYOFWEEK(dto.start_date) ORDER BY DAYOFWEEK(dto.start_date)) as working_days
      FROM date_travel_order dto
      WHERE DATE(dto.start_date) >= ${startDate}
        AND DATE(dto.start_date) <= ${endDate}
        AND dto.driver_id > 0
      GROUP BY dto.driver_id, dto.driver_name, dto.line_no
      ORDER BY dto.driver_id
    `;

    // Transformiši podatke u DriverReportDto format
    const driverReports: DriverReportDto[] = rawData.map((data) => {
      // Parsiraj RADNO MESTO iz comment polja
      // Format comment: "Turnus: 00018-5, Smena: 1, Polazak: 1/6"
      const workPlace = this.parseWorkPlace(data.comment, data.line_no);

      // Izračunaj SLOBODNE DANE
      // working_days = '1,2,3,4,5' (dani kada radi)
      // Slobodni dani = svi dani (1-7) minus working_days
      const freeDays = this.calculateFreeDays(data.working_days);

      return {
        driverId: Number(data.driver_id), // Konvertuj BigInt u Number
        driverName: data.driver_name,
        workPlace,
        freeDays,
        maintenanceDate: undefined, // Za sada preskoči
      };
    });

    return driverReports;
  }

  /**
   * Parsiraj RADNO MESTO iz comment polja
   * Format: "Turnus: 00018-5, Smena: 1, Polazak: 1/6"
   * Return: "5-18 I" (turaža-linija smena)
   */
  private parseWorkPlace(comment: string, lineNo: string): string {
    // Regex za parsiranje turnusa i smene
    const turnusMatch = comment.match(/Turnus: (\d+)-(\d+)/);
    const smenaMatch = comment.match(/Smena: (\d+)/);

    if (!turnusMatch || !smenaMatch) {
      return `?-${lineNo} ?`; // Fallback ako parsiranje ne uspe
    }

    // 00018-5 → turaža = 5
    const turage = parseInt(turnusMatch[2]);
    // Smena: 1 → rimski I
    const smena = this.romanNumerals[parseInt(smenaMatch[1])] || '?';

    return `${turage}-${lineNo} ${smena}`;
  }

  /**
   * Izračunaj SLOBODNE DANE
   * working_days = '1,2,3,4,5' (MySQL DAYOFWEEK format - dani kada vozač radi)
   * Return: '67' (subota i nedelja su slobodni - ISO format)
   *
   * MySQL DAYOFWEEK: 1=Nedelja, 2=Ponedeljak, ..., 7=Subota
   * ISO format: 1=Ponedeljak, 2=Utorak, ..., 6=Subota, 7=Nedelja
   */
  private calculateFreeDays(workingDays: string): string {
    if (!workingDays) {
      return ''; // Ako nema podataka
    }

    // Konvertuj MySQL DAYOFWEEK format u ISO format
    const mysqlToIso = (mysqlDay: number): number => {
      // MySQL 1 (nedelja) → ISO 7
      // MySQL 2 (ponedeljak) → ISO 1
      // MySQL 3 (utorak) → ISO 2, itd.
      return mysqlDay === 1 ? 7 : mysqlDay - 1;
    };

    // Svi dani u nedelji (ISO format: 1-7)
    const allDaysISO = [1, 2, 3, 4, 5, 6, 7];

    // Dani kada vozač radi (MySQL format), konvertovani u ISO
    const workingMySQL = workingDays.split(',').map((d) => parseInt(d.trim()));
    const workingISO = workingMySQL.map(mysqlToIso);

    // Slobodni dani (ISO format) = razlika
    const freeDaysISO = allDaysISO.filter((day) => !workingISO.includes(day));

    // Sortiraj i vrati kao string "67" (bez razmaka ili zareza)
    return freeDaysISO.sort((a, b) => a - b).join('');
  }

  /**
   * Dobavi informacije o linkovanom turnusu
   * Proverava da li odabrani turnus ima linkovan par i vraća informacije o njima u hronološkom redosledu
   */
  async getLinkedTurnusInfo(
    lineNumber: string,
    turnusName: string,
    shiftNumber: number,
    date: string,
  ) {
    // 1. Dobavi sve linked turnuse za odabranu liniju
    const linkedTurnusi = await this.linkedTurnusiService.findAll({
      lineNumber,
      status: 'ACTIVE',
    });

    // 2. Pronađi da li odabrani turnus ima linked par (u bilo kom smeru)
    // VAŽNO: Provera uključuje i shiftNumber!
    const linkedPair = linkedTurnusi.find(
      (link) =>
        (link.lineNumber1 === lineNumber &&
         link.turnusName1 === turnusName &&
         link.shiftNumber1 === shiftNumber) ||
        (link.lineNumber2 === lineNumber &&
         link.turnusName2 === turnusName &&
         link.shiftNumber2 === shiftNumber),
    );

    if (!linkedPair) {
      return {
        hasLink: false,
      };
    }

    // 3. Odredi koji je prvi a koji drugi turnus u linked paru
    // VAŽNO: Provera uključuje i shiftNumber jer isti turnus može imati više linked parova sa različitim smenama!
    const isTurnusFirst =
      linkedPair.lineNumber1 === lineNumber &&
      linkedPair.turnusName1 === turnusName &&
      linkedPair.shiftNumber1 === shiftNumber;

    const selectedTurnusInfo = {
      lineNumber: isTurnusFirst
        ? linkedPair.lineNumber1
        : linkedPair.lineNumber2,
      turnusId: isTurnusFirst ? linkedPair.turnusId1 : linkedPair.turnusId2,
      turnusName: isTurnusFirst
        ? linkedPair.turnusName1
        : linkedPair.turnusName2,
      shiftNumber: isTurnusFirst ? linkedPair.shiftNumber1 : linkedPair.shiftNumber2,
    };

    const linkedTurnusInfo = {
      lineNumber: isTurnusFirst
        ? linkedPair.lineNumber2
        : linkedPair.lineNumber1,
      turnusId: isTurnusFirst ? linkedPair.turnusId2 : linkedPair.turnusId1,
      turnusName: isTurnusFirst
        ? linkedPair.turnusName2
        : linkedPair.turnusName1,
      shiftNumber: isTurnusFirst ? linkedPair.shiftNumber2 : linkedPair.shiftNumber1,
    };

    // 4. Dobavi start_time za oba turnusa iz changes_codes_tours
    const dayName = this.getDayNameFromDate(date);

    // VAŽNO: Linija može imati više varijanti (smerova), moramo uzeti SVE line_number vrednosti!
    const lines1 = await this.prisma.line.findMany({
      where: { lineNumberForDisplay: selectedTurnusInfo.lineNumber },
      select: { lineNumber: true },
    });
    const lineNumbers1 = lines1.map(l => l.lineNumber);

    const lines2 = await this.prisma.line.findMany({
      where: { lineNumberForDisplay: linkedTurnusInfo.lineNumber },
      select: { lineNumber: true },
    });
    const lineNumbers2 = lines2.map(l => l.lineNumber);

    if (lineNumbers1.length === 0 || lineNumbers2.length === 0) {
      return {
        hasLink: false,
      };
    }

    // Query za prvi turnus - koristi SVE varijante linije
    const turnus1StartTime = await this.prisma.$queryRaw<
      Array<{
        start_time: Date;
        turnus_id: number;
        turnus_name: string;
      }>
    >`
      SELECT cct.start_time, cct.turnus_id, cct.turnus_name
      FROM changes_codes_tours cct
      INNER JOIN turnus_days td ON cct.turnus_id = td.turnus_id
      WHERE cct.line_no IN (${Prisma.join(lineNumbers1)})
        AND cct.turnus_name = ${selectedTurnusInfo.turnusName}
        AND cct.shift_number = ${selectedTurnusInfo.shiftNumber}
        AND td.dayname = ${dayName}
      ORDER BY cct.start_time ASC
      LIMIT 1
    `;

    // Query za drugi turnus - koristi SVE varijante linije
    const turnus2StartTime = await this.prisma.$queryRaw<
      Array<{
        start_time: Date;
        turnus_id: number;
        turnus_name: string;
      }>
    >`
      SELECT cct.start_time, cct.turnus_id, cct.turnus_name
      FROM changes_codes_tours cct
      INNER JOIN turnus_days td ON cct.turnus_id = td.turnus_id
      WHERE cct.line_no IN (${Prisma.join(lineNumbers2)})
        AND cct.turnus_name = ${linkedTurnusInfo.turnusName}
        AND cct.shift_number = ${linkedTurnusInfo.shiftNumber}
        AND td.dayname = ${dayName}
      ORDER BY cct.start_time ASC
      LIMIT 1
    `;

    if (turnus1StartTime.length === 0 || turnus2StartTime.length === 0) {
      return {
        hasLink: false,
      };
    }

    // 5. Sortiraj hronološki po start_time (ne po redosledu u turnus_linked tabeli!)
    const turnusA = {
      lineNumber: selectedTurnusInfo.lineNumber,
      turnusId: Number(turnus1StartTime[0].turnus_id), // Konvertuj BigInt u Number
      turnusName: turnus1StartTime[0].turnus_name,
      shiftNumber: selectedTurnusInfo.shiftNumber,
      startTime: turnus1StartTime[0].start_time,
    };

    const turnusB = {
      lineNumber: linkedTurnusInfo.lineNumber,
      turnusId: Number(turnus2StartTime[0].turnus_id), // Konvertuj BigInt u Number
      turnusName: turnus2StartTime[0].turnus_name,
      shiftNumber: linkedTurnusInfo.shiftNumber,
      startTime: turnus2StartTime[0].start_time,
    };

    // Sort hronološki
    const sortedTurnusi =
      turnusA.startTime <= turnusB.startTime
        ? [turnusA, turnusB]
        : [turnusB, turnusA];

    // 6. Odredi koji je selected a koji linked
    const isSelectedFirst = sortedTurnusi[0].turnusName === turnusName;

    // Helper funkcija za formatiranje vremena
    const formatTime = (timeValue: Date | null) => {
      if (!timeValue) return '';
      const hours = String(timeValue.getUTCHours()).padStart(2, '0');
      const minutes = String(timeValue.getUTCMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    };

    return {
      hasLink: true,
      linkedTurnus: {
        lineNumber: linkedTurnusInfo.lineNumber,
        turnusId: Number(linkedTurnusInfo.turnusId), // Konvertuj BigInt u Number
        turnusName: linkedTurnusInfo.turnusName,
        shiftNumber: linkedTurnusInfo.shiftNumber,
        startTime: formatTime(
          isSelectedFirst
            ? sortedTurnusi[1].startTime
            : sortedTurnusi[0].startTime,
        ),
      },
      chronologicalOrder: {
        first: {
          lineNumber: sortedTurnusi[0].lineNumber,
          turnusId: Number(sortedTurnusi[0].turnusId), // Konvertuj BigInt u Number
          turnusName: sortedTurnusi[0].turnusName,
          shiftNumber: sortedTurnusi[0].shiftNumber,
          startTime: formatTime(sortedTurnusi[0].startTime),
        },
        second: {
          lineNumber: sortedTurnusi[1].lineNumber,
          turnusId: Number(sortedTurnusi[1].turnusId), // Konvertuj BigInt u Number
          turnusName: sortedTurnusi[1].turnusName,
          shiftNumber: sortedTurnusi[1].shiftNumber,
          startTime: formatTime(sortedTurnusi[1].startTime),
        },
      },
      isSelectedFirst,
    };
  }

  /**
   * Mapiranje brojeva smena na rimske brojeve
   */
  private romanNumerals: Record<number, string> = {
    1: 'I',
    2: 'II',
    3: 'III',
    4: 'IV',
  };
}
