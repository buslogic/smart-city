import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLinkedTurnusDto } from './dto/create-linked-turnus.dto';
import { UpdateLinkedTurnusDto } from './dto/update-linked-turnus.dto';
import { QueryLinkedTurnusDto } from './dto/query-linked-turnus.dto';

@Injectable()
export class LinkedTurnusiService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateLinkedTurnusDto, userId: number) {
    // Validacija: Turnus ne može biti povezan sam sa sobom
    if (
      dto.lineNumber1 === dto.lineNumber2 &&
      dto.turnusName1 === dto.turnusName2
    ) {
      throw new BadRequestException(
        'Turnus ne može biti povezan sam sa sobom',
      );
    }

    // Prvo naći line_number iz line_number_for_display za obe linije
    const line1 = await this.prisma.line.findFirst({
      where: { lineNumberForDisplay: dto.lineNumber1 },
      select: { lineNumber: true },
    });

    if (!line1) {
      throw new NotFoundException(`Linija ${dto.lineNumber1} ne postoji`);
    }

    const line2 = await this.prisma.line.findFirst({
      where: { lineNumberForDisplay: dto.lineNumber2 },
      select: { lineNumber: true },
    });

    if (!line2) {
      throw new NotFoundException(`Linija ${dto.lineNumber2} ne postoji`);
    }

    // Proveri da li oba turnusa postoje u changes_codes_tours
    // Koristimo turnusName jer jedan turnus može imati više ID-eva
    const turnus1Exists = await this.prisma.changesCodesTours.findFirst({
      where: {
        lineNo: line1.lineNumber,
        turnusName: dto.turnusName1,
      },
    });

    if (!turnus1Exists) {
      throw new NotFoundException(
        `Turnus ${dto.turnusName1} na liniji ${dto.lineNumber1} ne postoji`,
      );
    }

    const turnus2Exists = await this.prisma.changesCodesTours.findFirst({
      where: {
        lineNo: line2.lineNumber,
        turnusName: dto.turnusName2,
      },
    });

    if (!turnus2Exists) {
      throw new NotFoundException(
        `Turnus ${dto.turnusName2} na liniji ${dto.lineNumber2} ne postoji`,
      );
    }

    // Proveri da li već postoji ista veza (u bilo kom smeru)
    // Koristimo turnusName i shiftNumber jer su to pravi jedinstveni identifikatori
    const existingLink = await this.prisma.turnusLinked.findFirst({
      where: {
        OR: [
          {
            lineNumber1: dto.lineNumber1,
            turnusName1: dto.turnusName1,
            shiftNumber1: dto.shiftNumber1,
            lineNumber2: dto.lineNumber2,
            turnusName2: dto.turnusName2,
            shiftNumber2: dto.shiftNumber2,
          },
          {
            lineNumber1: dto.lineNumber2,
            turnusName1: dto.turnusName2,
            shiftNumber1: dto.shiftNumber2,
            lineNumber2: dto.lineNumber1,
            turnusName2: dto.turnusName1,
            shiftNumber2: dto.shiftNumber1,
          },
        ],
      },
    });

    if (existingLink) {
      throw new ConflictException(
        'Ova veza između turnusa već postoji',
      );
    }

    // Postavi default vrednosti za validne dane (radni dani)
    const validMonday = dto.validMonday ?? true;
    const validTuesday = dto.validTuesday ?? true;
    const validWednesday = dto.validWednesday ?? true;
    const validThursday = dto.validThursday ?? true;
    const validFriday = dto.validFriday ?? true;
    const validSaturday = dto.validSaturday ?? false;
    const validSunday = dto.validSunday ?? false;

    // Validacija: Barem jedan dan mora biti selektovan
    if (
      !validMonday &&
      !validTuesday &&
      !validWednesday &&
      !validThursday &&
      !validFriday &&
      !validSaturday &&
      !validSunday
    ) {
      throw new BadRequestException(
        'Barem jedan dan mora biti selektovan za povezani turnus',
      );
    }

    return this.prisma.turnusLinked.create({
      data: {
        lineNumber1: dto.lineNumber1,
        turnusId1: dto.turnusId1,
        turnusName1: dto.turnusName1,
        shiftNumber1: dto.shiftNumber1,
        lineNumber2: dto.lineNumber2,
        turnusId2: dto.turnusId2,
        turnusName2: dto.turnusName2,
        shiftNumber2: dto.shiftNumber2,
        description: dto.description,
        status: dto.status || 'ACTIVE',
        validMonday,
        validTuesday,
        validWednesday,
        validThursday,
        validFriday,
        validSaturday,
        validSunday,
        createdBy: userId,
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async findAll(query: QueryLinkedTurnusDto) {
    const where: any = {};

    // Filter po liniji (bilo koja od dve linije)
    if (query.lineNumber) {
      where.OR = [
        { lineNumber1: query.lineNumber },
        { lineNumber2: query.lineNumber },
      ];
    }

    // Filter po statusu
    if (query.status) {
      where.status = query.status;
    }

    return this.prisma.turnusLinked.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        updater: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number) {
    const linkedTurnus = await this.prisma.turnusLinked.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        updater: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!linkedTurnus) {
      throw new NotFoundException(
        `Povezani turnus sa ID ${id} nije pronađen`,
      );
    }

    return linkedTurnus;
  }

  async update(id: number, dto: UpdateLinkedTurnusDto, userId: number) {
    // Prvo proveri da li postoji
    await this.findOne(id);

    // Ako se menjaju podaci o turnusima ili linijama, validuj
    if (
      dto.lineNumber1 ||
      dto.turnusName1 ||
      dto.lineNumber2 ||
      dto.turnusName2
    ) {
      const current = await this.prisma.turnusLinked.findUnique({
        where: { id },
      });

      if (!current) {
        throw new NotFoundException(
          `Povezani turnus sa ID ${id} nije pronađen`,
        );
      }

      const newLine1 = dto.lineNumber1 || current.lineNumber1;
      const newTurnusName1 = dto.turnusName1 || current.turnusName1;
      const newShift1 = dto.shiftNumber1 ?? current.shiftNumber1;
      const newLine2 = dto.lineNumber2 || current.lineNumber2;
      const newTurnusName2 = dto.turnusName2 || current.turnusName2;
      const newShift2 = dto.shiftNumber2 ?? current.shiftNumber2;

      // Proveri da li se pokušava povezati sam sa sobom (ista linija + isti turnus + ista smena)
      if (newLine1 === newLine2 && newTurnusName1 === newTurnusName2 && newShift1 === newShift2) {
        throw new BadRequestException(
          'Turnus sa istom smenom ne može biti povezan sam sa sobom',
        );
      }
    }

    // Validacija validnih dana ako se menjaju
    if (
      dto.validMonday !== undefined ||
      dto.validTuesday !== undefined ||
      dto.validWednesday !== undefined ||
      dto.validThursday !== undefined ||
      dto.validFriday !== undefined ||
      dto.validSaturday !== undefined ||
      dto.validSunday !== undefined
    ) {
      const current = await this.prisma.turnusLinked.findUnique({
        where: { id },
      });

      if (!current) {
        throw new NotFoundException(
          `Povezani turnus sa ID ${id} nije pronađen`,
        );
      }

      // Proveri da li će barem jedan dan biti true posle update-a
      const validMonday = dto.validMonday ?? current.validMonday;
      const validTuesday = dto.validTuesday ?? current.validTuesday;
      const validWednesday = dto.validWednesday ?? current.validWednesday;
      const validThursday = dto.validThursday ?? current.validThursday;
      const validFriday = dto.validFriday ?? current.validFriday;
      const validSaturday = dto.validSaturday ?? current.validSaturday;
      const validSunday = dto.validSunday ?? current.validSunday;

      if (
        !validMonday &&
        !validTuesday &&
        !validWednesday &&
        !validThursday &&
        !validFriday &&
        !validSaturday &&
        !validSunday
      ) {
        throw new BadRequestException(
          'Barem jedan dan mora biti selektovan za povezani turnus',
        );
      }
    }

    return this.prisma.turnusLinked.update({
      where: { id },
      data: {
        ...dto,
        updatedBy: userId,
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        updater: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async remove(id: number) {
    // Prvo proveri da li postoji
    await this.findOne(id);

    await this.prisma.turnusLinked.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Povezani turnus uspešno obrisan',
    };
  }

  /**
   * Proverava da li je linked turnus validan za dati datum
   * @param linkedTurnus - Linked turnus objekat sa valid_* poljima
   * @param date - Datum za proveru (Date ili string)
   * @returns true ako je linked turnus validan za taj datum, inače false
   */
  isValidForDate(
    linkedTurnus: {
      validMonday: boolean;
      validTuesday: boolean;
      validWednesday: boolean;
      validThursday: boolean;
      validFriday: boolean;
      validSaturday: boolean;
      validSunday: boolean;
    },
    date: Date | string,
  ): boolean {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const dayOfWeek = dateObj.getDay(); // 0=Nedelja, 1=Ponedeljak, ..., 6=Subota

    const dayMap = [
      linkedTurnus.validSunday, // 0
      linkedTurnus.validMonday, // 1
      linkedTurnus.validTuesday, // 2
      linkedTurnus.validWednesday, // 3
      linkedTurnus.validThursday, // 4
      linkedTurnus.validFriday, // 5
      linkedTurnus.validSaturday, // 6
    ];

    return dayMap[dayOfWeek];
  }
}
