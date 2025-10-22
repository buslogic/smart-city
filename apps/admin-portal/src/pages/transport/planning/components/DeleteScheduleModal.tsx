import React, { useState } from 'react';
import { Modal, Radio } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { Schedule } from '../../../../services/planning.service';
import dayjs from 'dayjs';

interface DeleteScheduleModalProps {
  visible: boolean;
  schedule: Schedule | null;
  onConfirm: (scope: 'day' | 'month') => void;
  onCancel: () => void;
}

export const DeleteScheduleModal: React.FC<DeleteScheduleModalProps> = ({
  visible,
  schedule,
  onConfirm,
  onCancel,
}) => {
  const [deleteScope, setDeleteScope] = useState<'day' | 'month'>('day');

  if (!schedule) return null;

  const formattedDate = new Date(schedule.date).toLocaleDateString('sr-RS', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const monthName = dayjs(schedule.date).format('MMMM YYYY');
  const shiftName =
    schedule.shiftNumber === 1
      ? 'Prva smena'
      : schedule.shiftNumber === 2
      ? 'Druga smena'
      : 'Treća smena';

  const handleOk = () => {
    onConfirm(deleteScope);
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <ExclamationCircleOutlined className="text-red-500 text-xl" />
          <span>Potvrda brisanja rasporeda</span>
        </div>
      }
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      okText="Potvrdi brisanje"
      cancelText="Otkaži"
      okButtonProps={{ danger: true }}
      width={600}
    >
      <div className="space-y-4 py-4">
        {/* Informacije o rasporedu */}
        <div className="bg-gray-50 p-4 rounded-md space-y-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="font-medium text-gray-600">Datum:</span>
              <p className="text-gray-900">{formattedDate}</p>
            </div>
            <div>
              <span className="font-medium text-gray-600">Linija:</span>
              <p className="text-gray-900">
                {schedule.lineNumber} - {schedule.lineName}
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-600">Turaža:</span>
              <p className="text-gray-900">{schedule.turnusName}</p>
            </div>
            <div>
              <span className="font-medium text-gray-600">Smena:</span>
              <p className="text-gray-900">{shiftName}</p>
            </div>
            <div className="col-span-2">
              <span className="font-medium text-gray-600">Vozač:</span>
              <p className="text-gray-900">{schedule.driverName}</p>
            </div>
          </div>
        </div>

        {/* Opcije za brisanje */}
        <div>
          <p className="font-medium text-gray-700 mb-3">
            Izaberite opseg brisanja:
          </p>
          <Radio.Group
            value={deleteScope}
            onChange={(e) => setDeleteScope(e.target.value)}
            className="flex flex-col space-y-3"
          >
            <Radio value="day" className="items-start">
              <div>
                <div className="font-medium">Obriši samo za ovaj dan</div>
                <div className="text-sm text-gray-500 mt-1">
                  Brisaće se raspored samo za {formattedDate}
                </div>
              </div>
            </Radio>
            <Radio value="month" className="items-start">
              <div>
                <div className="font-medium">
                  Obriši za ceo mesec (isti turnus i smena)
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  Brisaće se svi rasporedi za turnus {schedule.turnusName},{' '}
                  {shiftName} u mesecu {monthName}
                </div>
              </div>
            </Radio>
          </Radio.Group>
        </div>

        {/* Upozorenje */}
        {deleteScope === 'month' && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-800 flex items-center gap-2">
              <ExclamationCircleOutlined className="text-red-600" />
              <span className="font-medium">Upozorenje:</span>
              <span>
                Ova akcija će obrisati sve rasporede za odabrani turnus i smenu u
                celom mesecu. Akcija se ne može poništiti.
              </span>
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};
