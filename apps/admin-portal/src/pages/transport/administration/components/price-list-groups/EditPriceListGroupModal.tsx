import React, { useEffect } from 'react';
import { Modal, Form, Input, DatePicker, Select, App } from 'antd';
import dayjs from 'dayjs';
import {
  PriceListGroup,
  CreatePriceListGroupDto,
  UpdatePriceListGroupDto,
  priceListGroupsService,
} from '../../../../../services/priceListGroups.service';

interface EditPriceListGroupModalProps {
  open: boolean;
  priceListGroup: PriceListGroup | null;
  onClose: () => void;
  onSuccess: () => void;
}

const EditPriceListGroupModal: React.FC<EditPriceListGroupModalProps> = ({
  open,
  priceListGroup,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = React.useState(false);
  const isEditMode = !!priceListGroup;

  useEffect(() => {
    if (open) {
      if (priceListGroup) {
        // Edit mode - populate form with existing data
        form.setFieldsValue({
          name: priceListGroup.name,
          dateValidFrom: dayjs(priceListGroup.dateValidFrom),
          status: priceListGroup.status,
          synchroStatus: priceListGroup.synchroStatus,
          sendIncremental: priceListGroup.sendIncremental,
          changedBy: priceListGroup.changedBy,
          legacyCityId: priceListGroup.legacyCityId || undefined,
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
  }, [open, priceListGroup, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const formData = {
        ...values,
        dateValidFrom: values.dateValidFrom.format('YYYY-MM-DD'),
      };

      if (isEditMode) {
        // Update existing
        const updateData: UpdatePriceListGroupDto = formData;
        await priceListGroupsService.update(
          Number(priceListGroup!.id),
          updateData,
        );
        message.success('Grupa cenovnika uspešno ažurirana');
      } else {
        // Create new
        const createData: CreatePriceListGroupDto = formData;
        await priceListGroupsService.create(createData);
        message.success('Grupa cenovnika uspešno kreirana');
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
          ? `Izmena grupe cenovnika: ${priceListGroup?.name || ''}`
          : 'Kreiranje nove grupe cenovnika'
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
          <Input placeholder="Unesite naziv grupe cenovnika" />
        </Form.Item>

        <Form.Item
          label="Važi od"
          name="dateValidFrom"
          rules={[{ required: true, message: 'Datum važenja je obavezan' }]}
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

export default EditPriceListGroupModal;
