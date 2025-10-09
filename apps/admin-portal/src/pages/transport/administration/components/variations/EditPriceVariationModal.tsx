import React, { useEffect, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  App,
  Row,
  Col,
  DatePicker,
} from 'antd';
import dayjs from 'dayjs';
import { priceVariationsService, PriceVariation, CreatePriceVariationDto } from '../../../../../services/price-variations.service';

interface EditPriceVariationModalProps {
  open: boolean;
  variation: PriceVariation | null;
  onClose: () => void;
  onSuccess: () => void;
}

const EditPriceVariationModal: React.FC<EditPriceVariationModalProps> = ({
  open,
  variation,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();
  const isEdit = !!variation;

  useEffect(() => {
    if (open) {
      if (variation) {
        form.setFieldsValue({
          ...variation,
          datetimeFrom: variation.datetimeFrom ? dayjs(variation.datetimeFrom) : null,
          datetimeTo: variation.datetimeTo ? dayjs(variation.datetimeTo) : null,
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, variation, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // Convert dayjs to ISO string
      const payload = {
        ...values,
        datetimeFrom: values.datetimeFrom ? values.datetimeFrom.toISOString() : null,
        datetimeTo: values.datetimeTo ? values.datetimeTo.toISOString() : null,
      };

      if (isEdit) {
        await priceVariationsService.update(variation.id, payload);
        message.success('Varijacija uspešno ažurirana');
      } else {
        await priceVariationsService.create(payload as CreatePriceVariationDto);
        message.success('Varijacija uspešno kreirana');
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      if (error.errorFields) {
        message.error('Molimo popunite sva obavezna polja');
      } else {
        console.error('Greška pri čuvanju varijacije:', error);
        message.error(
          error.response?.data?.message || 'Greška pri čuvanju varijacije'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={isEdit ? 'Izmeni varijaciju' : 'Dodaj novu varijaciju'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={800}
      okText={isEdit ? 'Sačuvaj' : 'Dodaj'}
      cancelText="Otkaži"
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          mainBasicRoute: false,
          lineTypeId: 0,
        }}
      >
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              label="Naziv varijacije"
              name="variationName"
              rules={[{ required: true, message: 'Unesite naziv varijacije' }]}
            >
              <Input maxLength={250} />
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item
              label="Opis varijacije"
              name="variationDescription"
              rules={[{ required: true, message: 'Unesite opis varijacije' }]}
            >
              <Input.TextArea rows={3} maxLength={255} />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label="Tip linije ID"
              name="lineTypeId"
              rules={[{ required: true, message: 'Unesite tip linije ID' }]}
            >
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label="GTFS Route Settings ID"
              name="gtfsRouteSettingsId"
            >
              <Input maxLength={250} />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label="Smer"
              name="direction"
            >
              <Input maxLength={10} />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label="Glavna osnovna ruta"
              name="mainBasicRoute"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label="Datum/vreme od"
              name="datetimeFrom"
            >
              <DatePicker
                style={{ width: '100%' }}
                showTime
                format="YYYY-MM-DD HH:mm:ss"
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label="Datum/vreme do"
              name="datetimeTo"
            >
              <DatePicker
                style={{ width: '100%' }}
                showTime
                format="YYYY-MM-DD HH:mm:ss"
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

export default EditPriceVariationModal;
