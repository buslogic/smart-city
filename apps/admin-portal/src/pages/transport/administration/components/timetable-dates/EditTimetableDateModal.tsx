import React, { useEffect } from 'react';
import { Modal, Form, Input, DatePicker, Select, App } from 'antd';
import dayjs from 'dayjs';
import {
  TimetableDate,
  CreateTimetableDateDto,
  UpdateTimetableDateDto,
  timetableDatesService,
} from '../../../../../services/timetableDates.service';

interface EditTimetableDateModalProps {
  open: boolean;
  timetableDate: TimetableDate | null;
  onClose: () => void;
  onSuccess: () => void;
}

const EditTimetableDateModal: React.FC<EditTimetableDateModalProps> = ({
  open,
  timetableDate,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = React.useState(false);
  const isEditMode = !!timetableDate;

  useEffect(() => {
    if (open) {
      if (timetableDate) {
        // Edit mode - populate form with existing data
        form.setFieldsValue({
          name: timetableDate.name,
          dateValidFrom: dayjs(timetableDate.dateValidFrom),
          status: timetableDate.status,
          synchroStatus: timetableDate.synchroStatus,
          sendIncremental: timetableDate.sendIncremental,
          changedBy: timetableDate.changedBy,
          legacyCityId: timetableDate.legacyCityId || undefined,
        });
      } else {
        // Create mode - set defaults
        form.setFieldsValue({
          status: 'N',
          synchroStatus: 'N',
          sendIncremental: '0',
          changedBy: 'admin', // TODO: Get from auth context
        });
      }
    }
  }, [open, timetableDate, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const formData = {
        ...values,
        dateValidFrom: values.dateValidFrom.format('YYYY-MM-DD'),
        dateValidTo: values.dateValidTo ? values.dateValidTo.format('YYYY-MM-DD') : undefined,
      };

      if (isEditMode) {
        // Update existing
        const updateData: UpdateTimetableDateDto = formData;
        await timetableDatesService.update(
          Number(timetableDate!.id),
          updateData,
        );
        message.success('Grupa za RedVoznje uspešno ažurirana');
      } else {
        // Create new
        const createData: CreateTimetableDateDto = formData;
        await timetableDatesService.create(createData);
        message.success('Grupa za RedVoznje uspešno kreirana');
      }

      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Greška:', error);
      if (error.response) {
        message.error(
          error.response.data?.message ||
            `Greška pri ${isEditMode ? 'ažuriranju' : 'kreiranju'}`,
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={
        isEditMode
          ? `Izmena grupe za RedVoznje: ${timetableDate?.name || ''}`
          : 'Kreiranje nove grupe za RedVoznje'
      }
      open={open}
      onOk={handleSubmit}
      onCancel={handleClose}
      confirmLoading={loading}
      width={600}
      okText="Sačuvaj"
      cancelText="Otkaži"
    >
      <Form form={form} layout="vertical" autoComplete="off">
        <Form.Item
          label="Naziv grupe"
          name="name"
          rules={[
            { required: true, message: 'Naziv grupe je obavezan' },
            { max: 100, message: 'Naziv može imati maksimalno 100 karaktera' },
          ]}
        >
          <Input placeholder="Unesite naziv grupe za RedVoznje" />
        </Form.Item>

        <Form.Item
          label="Važi od"
          name="dateValidFrom"
          rules={[{ required: true, message: 'Datum važenja je obavezan' }]}
        >
          <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
        </Form.Item>

        <Form.Item
          label="Važi do"
          name="dateValidTo"
          tooltip="Datum do kada red vožnje važi (opciono)"
        >
          <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
        </Form.Item>

        <Form.Item
          label="Status"
          name="status"
          rules={[{ required: true, message: 'Status je obavezan' }]}
        >
          <Select placeholder="Izaberite status">
            <Select.Option value="N">Neaktivna (N)</Select.Option>
            <Select.Option value="A">Aktivna (A)</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Synchro Status"
          name="synchroStatus"
          rules={[
            { required: true, message: 'Synchro status je obavezan' },
          ]}
        >
          <Select placeholder="Izaberite synchro status">
            <Select.Option value="N">Nesinhr onizovana (N)</Select.Option>
            <Select.Option value="A">Sinhronizovana (A)</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Send Incremental"
          name="sendIncremental"
          rules={[
            { required: true, message: 'Send incremental je obavezan' },
          ]}
        >
          <Select placeholder="Izaberite opciju">
            <Select.Option value="0">Ne (0)</Select.Option>
            <Select.Option value="1">Da (1)</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Promenio"
          name="changedBy"
          rules={[
            { required: true, message: 'Korisnik je obavezan' },
            { max: 100, message: 'Maksimalno 100 karaktera' },
          ]}
        >
          <Input placeholder="Korisničko ime" />
        </Form.Item>

        <Form.Item
          label="Gradski ID (Legacy)"
          name="legacyCityId"
          tooltip="ID iz gradskog servera (opciono)"
        >
          <Input placeholder="Unesite ID iz gradskog servera" type="number" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditTimetableDateModal;
