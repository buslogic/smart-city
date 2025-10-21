import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';

@Injectable()
export class WaterMeterCalculationService {
  constructor(private readonly prismaLegacy: PrismaLegacyService) {}

  private async getCampaignIDByPeriod(year: number, month: number) {
    const query = `
      SELECT vc.status, vc.id
      FROM vodovod_campaign vc
      WHERE vc.godina = ? AND vc.mesec = ?
      LIMIT 1
    `;

    const result: any[] = await this.prismaLegacy.$queryRawUnsafe(
      query,
      year,
      month
    );

    if (!result || result.length === 0) {
      return null;
    }

    return {
      campaign_id: result[0].id,
      status: result[0].status,
    };
  }

  private async getCalculationsByCampaignID(campaignID: number) {
    const query = `
      SELECT *
      FROM vodovod_calculations
      WHERE campaign_id = ?
    `;

    const result: any[] = await this.prismaLegacy.$queryRawUnsafe(
      query,
      campaignID
    );

    return result && result.length > 0 ? result[0] : null;
  }

  private async createCalculation(campaign_id: number) {
    const query = `
      INSERT INTO vodovod_calculations (campaign_id, status)
      VALUES (?, 1)
    `;

    await this.prismaLegacy.$executeRawUnsafe(query, campaign_id);

    return this.getCalculationsByCampaignID(campaign_id);
  }

  private async getWMReadingsByCalculationID(campaignID: number) {
    const query = `
      SELECT
        vr.id, vr.pocetno_stanje, vr.zavrsno_stanje, vr.idmm, vr.idv, vr.datum,
        vc.sifra_potrosaca, vc.naziv_potrosaca, vc.ulica_naselje, vc.kupac,
        vua.id AS user_account_id,
        CONCAT(vreaders.first_name, ' ', vreaders.last_name) AS citac,
        vwmr.meter_reading AS status
      FROM vodovod_sub_campaign vsc
      INNER JOIN vodovod_readings vr ON vr.pod_kampanja_id = vsc.id
      INNER JOIN vodovod_water_meter_readings vwmr ON vwmr.id = vr.status_id
      LEFT JOIN vodovod_consumers vc ON vc.idmm = vr.idmm
      LEFT JOIN crm_contacts cc ON cc.sifra_potrosaca = vc.sifra_potrosaca
      LEFT JOIN crm_accounts ca ON ca.sifra_potrosaca = vc.sifra_potrosaca
      LEFT JOIN vodovod_user_accounts vua ON
        vua.crm_contact_id = cc.id OR vua.crm_account_id = ca.id
      LEFT JOIN vodovod_readers vreaders ON vreaders.id = vr.citac_id
      WHERE vsc.kampanja_id = ?
    `;

    const results: any[] = await this.prismaLegacy.$queryRawUnsafe(
      query,
      campaignID
    );

    // Process rows - add subsidies and restructure data
    const rows = results.map((row) => {
      const user_account_id = row.user_account_id ?? null;

      // TODO: Implement subsidies fetching when SubsidiesService is available
      const subsidies = [];

      const data = {
        subsidies,
        user_account_id: row.user_account_id,
        sifra_potrosaca: row.sifra_potrosaca,
        naziv_potrosaca: row.naziv_potrosaca,
        kupac: row.kupac,
        ulica_naselje: row.ulica_naselje,
      };

      return {
        id: Number(row.id),
        pocetno_stanje: Number(row.pocetno_stanje),
        zavrsno_stanje: Number(row.zavrsno_stanje),
        idmm: Number(row.idmm),
        idv: String(row.idv),
        datum: row.datum ? new Date(row.datum).toISOString() : null,
        citac: String(row.citac || ''),
        status: String(row.status || ''),
        data,
      };
    });

    return rows;
  }

  async getRows(year: number, month: number) {
    const res = await this.getCampaignIDByPeriod(year, month);

    if (!res) {
      throw new NotFoundException('Nije pronadjena kampanja za ovaj period');
    }

    const campaign_id = res.campaign_id;
    let obracun = await this.getCalculationsByCampaignID(campaign_id);

    if (!obracun) {
      obracun = await this.createCalculation(campaign_id);
    }

    const rows = await this.getWMReadingsByCalculationID(campaign_id);

    return {
      readings: rows,
      calculations: obracun,
    };
  }
}
