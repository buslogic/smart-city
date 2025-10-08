import React, { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Switch, App } from 'antd';
import {
  CentralPoint,
  UpdateCentralPointDto,
  centralPointsService,
} from '../../../../services/centralPoints.service';

interface EditCentralPointModalProps {
  open: boolean;
  centralPoint: CentralPoint | null;
  onClose: () => void;
  onSuccess: () => void;
}

const EditCentralPointModal: React.FC<EditCentralPointModalProps> = ({
  open,
  centralPoint,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = React.useState(false);

  useEffect(() => {
    if (open && centralPoint) {
      form.setFieldsValue({
        name: centralPoint.name,
        address: centralPoint.address,
        zip: centralPoint.zip,
        city: centralPoint.city,
        phone1: centralPoint.phone1,
        phone2: centralPoint.phone2,
        email: centralPoint.email,
        boss: centralPoint.boss,
        bossPhone: centralPoint.bossPhone,
        bossEmail: centralPoint.bossEmail,
        mainStationUid: centralPoint.mainStationUid,
        longitude: centralPoint.longitude,
        latitude: centralPoint.latitude,
        comment: centralPoint.comment,
        owes: centralPoint.owes,
        expects: centralPoint.expects,
        saldo: centralPoint.saldo,
        active: centralPoint.active,
        legacyTicketingId: centralPoint.legacyTicketingId,
        legacyCityId: centralPoint.legacyCityId,
      });
    }
  }, [open, centralPoint, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const updateData: UpdateCentralPointDto = {
        ...values,
        changedBy: 'admin', // TODO: Get from auth context
      };

      await centralPointsService.update(centralPoint!.id, updateData);
      message.success('Centralna tačka uspešno ažurirana');
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Greška pri ažuriranju:', error);
      if (error.response) {
        message.error(error.response.data?.message || 'Greška pri ažuriranju');
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
      title={`Izmena centralne tačke: ${centralPoint?.name || ''}`}
      open={open}
      onOk={handleSubmit}
      onCancel={handleClose}
      confirmLoading={loading}
      width={800}
      okText="Sačuvaj"
      cancelText="Otkaži"
    >
      <Form
        form={form}
        layout="vertical"
        autoComplete="off"
      >
        {/* Osnovne informacije */}
        <h3>Osnovne informacije</h3>
        <Form.Item
          label="Naziv"
          name="name"
          rules={[{ required: true, message: 'Unesite naziv' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="Adresa"
          name="address"
          rules={[{ required: true, message: 'Unesite adresu' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="Poštanski broj"
          name="zip"
          rules={[{ required: true, message: 'Unesite poštanski broj' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="Grad"
          name="city"
          rules={[{ required: true, message: 'Unesite grad' }]}
        >
          <Input />
        </Form.Item>

        {/* Kontakt informacije */}
        <h3 className="mt-4">Kontakt informacije</h3>
        <Form.Item
          label="Telefon 1"
          name="phone1"
          rules={[{ required: true, message: 'Unesite telefon' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="Telefon 2"
          name="phone2"
          rules={[{ required: true, message: 'Unesite telefon' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="Email"
          name="email"
          rules={[
            { required: true, message: 'Unesite email' },
            { type: 'email', message: 'Unesite ispravan email' },
          ]}
        >
          <Input />
        </Form.Item>

        {/* Boss informacije */}
        <h3 className="mt-4">Šef informacije</h3>
        <Form.Item
          label="Ime šefa"
          name="boss"
          rules={[{ required: true, message: 'Unesite ime šefa' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="Telefon šefa"
          name="bossPhone"
          rules={[{ required: true, message: 'Unesite telefon šefa' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="Email šefa"
          name="bossEmail"
          rules={[
            { required: true, message: 'Unesite email šefa' },
            { type: 'email', message: 'Unesite ispravan email' },
          ]}
        >
          <Input />
        </Form.Item>

        {/* Geografija */}
        <h3 className="mt-4">Geografske informacije</h3>
        <Form.Item
          label="Main Station UID"
          name="mainStationUid"
          rules={[{ required: true, message: 'Unesite Main Station UID' }]}
        >
          <Input maxLength={6} />
        </Form.Item>

        <Form.Item
          label="Geografska dužina"
          name="longitude"
          rules={[{ required: true, message: 'Unesite geografsku dužinu' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="Geografska širina"
          name="latitude"
          rules={[{ required: true, message: 'Unesite geografsku širinu' }]}
        >
          <Input />
        </Form.Item>

        {/* Finansije */}
        <h3 className="mt-4">Finansijske informacije</h3>
        <Form.Item
          label="Duguje"
          name="owes"
          rules={[{ required: true, message: 'Unesite iznos' }]}
        >
          <InputNumber style={{ width: '100%' }} min={0} />
        </Form.Item>

        <Form.Item
          label="Očekuje"
          name="expects"
          rules={[{ required: true, message: 'Unesite iznos' }]}
        >
          <InputNumber style={{ width: '100%' }} min={0} />
        </Form.Item>

        <Form.Item
          label="Saldo"
          name="saldo"
          rules={[{ required: true, message: 'Unesite saldo' }]}
        >
          <InputNumber style={{ width: '100%' }} />
        </Form.Item>

        {/* Komentar */}
        <Form.Item
          label="Komentar"
          name="comment"
          rules={[{ required: true, message: 'Unesite komentar' }]}
        >
          <Input.TextArea rows={3} />
        </Form.Item>

        {/* Legacy sync tracking */}
        <h3 className="mt-4">Legacy Sinhronizacija</h3>
        <Form.Item
          label="Legacy Tiketing ID"
          name="legacyTicketingId"
          tooltip="ID iz Tiketing servera (automatski setovan pri sinhronizaciji)"
        >
          <InputNumber style={{ width: '100%' }} disabled />
        </Form.Item>

        <Form.Item
          label="Legacy Gradski ID"
          name="legacyCityId"
          tooltip="ID iz Gradskog servera - ručno setovati za povezivanje sa Gradskim serverom"
        >
          <InputNumber style={{ width: '100%' }} min={1} />
        </Form.Item>

        {/* Status */}
        <Form.Item
          label="Aktivna"
          name="active"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditCentralPointModal;
