import React, { useEffect, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  Select,
  App,
  Tabs,
  Row,
  Col,
} from 'antd';
import { linesService, Line, CreateLineDto } from '../../../../../services/lines.service';

interface EditLineModalProps {
  open: boolean;
  line: Line | null;
  onClose: () => void;
  onSuccess: () => void;
}

const EditLineModal: React.FC<EditLineModalProps> = ({
  open,
  line,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();
  const isEdit = !!line;

  useEffect(() => {
    if (open) {
      if (line) {
        form.setFieldsValue({
          ...line,
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, line, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (isEdit) {
        await linesService.update(Number(line.id), values);
        message.success('Linija uspešno ažurirana');
      } else {
        await linesService.create(values as CreateLineDto);
        message.success('Linija uspešno kreirana');
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      if (error.errorFields) {
        message.error('Molimo popunite sva obavezna polja');
      } else {
        console.error('Greška pri čuvanju linije:', error);
        message.error(
          error.response?.data?.message || 'Greška pri čuvanju linije'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const tabItems = [
    {
      key: 'basic',
      label: 'Osnovni podaci',
      children: (
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="Broj linije"
              name="lineNumber"
              rules={[{ required: true, message: 'Unesite broj linije' }]}
            >
              <Input maxLength={5} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Stvarni broj linije"
              name="actualLineNumber"
              rules={[{ required: true, message: 'Unesite stvarni broj linije' }]}
            >
              <Input maxLength={10} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="Naziv linije"
              name="lineTitle"
              rules={[{ required: true, message: 'Unesite naziv linije' }]}
            >
              <Input maxLength={255} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="Naziv linije (povratak)"
              name="lineTitleReturn"
            >
              <Input maxLength={255} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Važi od"
              name="dateValidFrom"
              rules={[{ required: true, message: 'Unesite datum' }]}
            >
              <Input maxLength={30} placeholder="YYYY-MM-DD" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Cenovnik ID"
              name="priceTableIdent"
              rules={[{ required: true, message: 'Unesite cenovnik ID' }]}
            >
              <Input maxLength={64} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Sistem tip ID"
              name="systemTypesId"
              rules={[{ required: true, message: 'Unesite sistem tip ID' }]}
            >
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Kategorija linije ID"
              name="categoriesLineId"
              rules={[{ required: true, message: 'Unesite kategoriju linije ID' }]}
            >
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="Promenio"
              name="changedBy"
              rules={[{ required: true, message: 'Unesite ko je promenio' }]}
            >
              <Input maxLength={100} />
            </Form.Item>
          </Col>
        </Row>
      ),
    },
    {
      key: 'additional',
      label: 'Dodatni podaci',
      children: (
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="Broj stanica"
              name="numberOfStations"
            >
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Status"
              name="status"
            >
              <Select>
                <Select.Option value="A">Aktivna</Select.Option>
                <Select.Option value="N">Neaktivna</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Tip linije ID"
              name="lineTypeId"
            >
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Tip linije"
              name="lineType"
            >
              <Input maxLength={100} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Maksimalna brzina"
              name="maxSpeed"
            >
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Dozvoljeno vreme (min)"
              name="timeAllowed"
            >
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="Kružna ruta"
              name="circleRoute"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="Prikaži na webu"
              name="showOnWeb"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="Prikaži na Android"
              name="showOnAndroid"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Col>
        </Row>
      ),
    },
    {
      key: 'routing',
      label: 'Rute i destinacije',
      children: (
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              label="Ruta linije"
              name="lineRoute"
            >
              <Input.TextArea rows={3} maxLength={2000} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="Ruta linije 1"
              name="lineRoute1"
            >
              <Input.TextArea rows={3} maxLength={2000} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Do mesta"
              name="toPlace"
            >
              <Input maxLength={200} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Do mesta 2"
              name="toPlaceTwo"
            >
              <Input maxLength={200} />
            </Form.Item>
          </Col>
        </Row>
      ),
    },
  ];

  return (
    <Modal
      title={isEdit ? 'Izmeni liniju' : 'Dodaj novu liniju'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={900}
      okText={isEdit ? 'Sačuvaj' : 'Dodaj'}
      cancelText="Otkaži"
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          status: 'A',
          circleRoute: false,
          showOnWeb: false,
          showOnAndroid: true,
          numberOfStations: 0,
          lineTypeId: 0,
          systemTypesId: 0,
          categoriesLineId: 0,
        }}
      >
        <Tabs items={tabItems} />
      </Form>
    </Modal>
  );
};

export default EditLineModal;
