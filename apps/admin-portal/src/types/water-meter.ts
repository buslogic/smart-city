export type SelectOption = {
  label: string;
  value: number;
};

export type HistoryRow = {
  changeType: string;
  note: string;
  changeDate: string;
  changedBy: string;
};

export type WMManufacturer = {
  id: number;
  manufacturer: string;
};

export type WMAvailability = {
  id: number;
  availability: string;
};

// export type WaterMeterReadingDisplay = {};

export type WaterMeterReading = {
  id: number;
  meterReading: string;
  faulty: boolean;
  unreadable: boolean;
  notFoundOnSite: boolean;
  noMeter: boolean;
  negativeConsumption: boolean;
  transferToNextCl: boolean;
  billPrintout: boolean;
  note: string;
  user: string;
  canceled: boolean;
  priority: boolean;
  average: boolean;
  meterReadingOnly: boolean;
  disconnected: boolean;
  censusSelect: boolean;
};

export type WaterMeterRemark = {
  id?: number;
  meterReading: string;
  faulty: number;
  unreadable: number;
  notFoundOnSite: number;
  noMeter: number;
  negativeConsumption: number;
  transferToNextCl: number;
  billPrintout: number;
  note?: string;
  userAccount?: string;
  canceled: number;
  priority: number;
  average: number;
  meterReaderOnly: number;
  disconnected: number;
  censusSelect: number;
};

export type WMType = {
  id: number;
  type: string;
};

export type WaterMeter = {
  id: number;
  counter: number;
  idmm: number;
  idv: string;
  calibrated_from?: string | null;
  calibrated_to?: string | null;
  serial_number: string;
  manufacturer: string;
  manufacturer_id: string;
  availability: string;
  availability_id: string;
  type: string;
  type_id: string;
  module: string;
  zamenski_vodomer: boolean;
  old_idv: string;
};
