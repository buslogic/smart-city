import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Table,
  Button,
  Space,
  message,
  Modal,
  Form,
  Steps,
  Tag,
  Popconfirm,
  Input,
  Switch,
  Spin,
  Checkbox,
} from 'antd';
import {
  LinkOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import Select from 'react-select';
import {
  linkedTurnusiService,
  type LinkedTurnus,
  type CreateLinkedTurnusDto,
} from '../../../services/linked-turnusi.service';
import {
  planningService,
  type Line,
  type Turnus,
} from '../../../services/planning.service';
import {
  formatValidDays,
  formatValidDaysAsNumbers,
  getDefaultValidDays,
  isAtLeastOneDaySelected,
  DAY_OPTIONS,
  type ValidDays,
} from '../../../utils/format-valid-days';

const { Title, Text } = Typography;
const { Step } = Steps;
const { TextArea } = Input;

const LinkedTurnusiPage: React.FC = () => {
  // State za listu
  const [linkedTurnusi, setLinkedTurnusi] = useState<LinkedTurnus[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterLineNumber, setFilterLineNumber] = useState<string>('');

  // State za modal
  const [modalVisible, setModalVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);

  // State za forme
  const [lines, setLines] = useState<Line[]>([]);
  const [turnusi1, setTurnusi1] = useState<Turnus[]>([]);
  const [turnusi2, setTurnusi2] = useState<Turnus[]>([]);

  // Form data
  const [validDays, setValidDays] = useState<ValidDays>(getDefaultValidDays());
  const [selectedLine1, setSelectedLine1] = useState<Line | null>(null);
  const [selectedTurnus1, setSelectedTurnus1] = useState<Turnus | null>(null);
  const [selectedShift1, setSelectedShift1] = useState<number | null>(null);
  const [selectedLine2, setSelectedLine2] = useState<Line | null>(null);
  const [selectedTurnus2, setSelectedTurnus2] = useState<Turnus | null>(null);
  const [selectedShift2, setSelectedShift2] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

  useEffect(() => {
    loadLinkedTurnusi();
    loadLines();
  }, []);

  useEffect(() => {
    if (filterLineNumber) {
      loadLinkedTurnusi();
    }
  }, [filterLineNumber]);

  const loadLinkedTurnusi = async () => {
    try {
      setLoading(true);
      const data = await linkedTurnusiService.getAll({
        lineNumber: filterLineNumber || undefined,
      });
      setLinkedTurnusi(data);
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Greška pri učitavanju');
    } finally {
      setLoading(false);
    }
  };

  const loadLines = async () => {
    try {
      const data = await planningService.getLines();
      setLines(data);
    } catch (error) {
      message.error('Greška pri učitavanju linija');
    }
  };

  const loadTurnusi1 = async (lineNumber: string) => {
    try {
      // Koristimo današnji datum za učitavanje turnusa
      const today = new Date().toISOString().split('T')[0];
      const data = await planningService.getTurnusi(lineNumber, today);
      setTurnusi1(data);
    } catch (error) {
      message.error('Greška pri učitavanju turnusa');
    }
  };

  const loadTurnusi2 = async (lineNumber: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await planningService.getTurnusi(lineNumber, today);
      setTurnusi2(data);
    } catch (error) {
      message.error('Greška pri učitavanju turnusa');
    }
  };

  const handleOpenModal = async (record?: LinkedTurnus) => {
    if (record) {
      // Editovanje - učitaj postojeće podatke
      setEditingId(record.id);
      setDescription(record.description || '');
      setStatus(record.status);

      // Učitaj validne dane
      setValidDays({
        validMonday: record.validMonday,
        validTuesday: record.validTuesday,
        validWednesday: record.validWednesday,
        validThursday: record.validThursday,
        validFriday: record.validFriday,
        validSaturday: record.validSaturday,
        validSunday: record.validSunday,
      });

      // Pronađi linije iz postojećih podataka
      const line1 = lines.find((l) => l.value === record.lineNumber1);
      const line2 = lines.find((l) => l.value === record.lineNumber2);

      if (line1) {
        setSelectedLine1(line1);
        // Učitaj turnuse za liniju 1
        try {
          const today = new Date().toISOString().split('T')[0];
          const turnusiData1 = await planningService.getTurnusi(
            record.lineNumber1,
            today,
          );
          setTurnusi1(turnusiData1);

          // Pronađi turnus po imenu (ne po ID-u!)
          const turnus1 = turnusiData1.find(
            (t) => t.turnusName === record.turnusName1,
          );
          if (turnus1) {
            setSelectedTurnus1(turnus1);
            setSelectedShift1(record.shiftNumber1); // Setuj smenu iz baze
          }
        } catch (error) {
          console.error('Greška pri učitavanju turnusa 1:', error);
        }
      }

      if (line2) {
        setSelectedLine2(line2);
        // Učitaj turnuse za liniju 2
        try {
          const today = new Date().toISOString().split('T')[0];
          const turnusiData2 = await planningService.getTurnusi(
            record.lineNumber2,
            today,
          );
          setTurnusi2(turnusiData2);

          // Pronađi turnus po imenu (ne po ID-u!)
          const turnus2 = turnusiData2.find(
            (t) => t.turnusName === record.turnusName2,
          );
          if (turnus2) {
            setSelectedTurnus2(turnus2);
            setSelectedShift2(record.shiftNumber2); // Setuj smenu iz baze
          }
        } catch (error) {
          console.error('Greška pri učitavanju turnusa 2:', error);
        }
      }
    } else {
      // Novo kreiranje
      setEditingId(null);
      resetForm();
    }
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setCurrentStep(0);
    resetForm();
  };

  const resetForm = () => {
    setValidDays(getDefaultValidDays());
    setSelectedLine1(null);
    setSelectedTurnus1(null);
    setSelectedShift1(null);
    setSelectedLine2(null);
    setSelectedTurnus2(null);
    setSelectedShift2(null);
    setDescription('');
    setStatus('ACTIVE');
    setTurnusi1([]);
    setTurnusi2([]);
  };

  const handleNext = () => {
    if (currentStep === 0) {
      // Step 0: Validacija validnih dana
      if (!isAtLeastOneDaySelected(validDays)) {
        message.warning('Barem jedan dan mora biti selektovan');
        return;
      }
    } else if (currentStep === 1) {
      // Step 1: Prvi turnus
      if (!selectedLine1 || !selectedTurnus1 || !selectedShift1) {
        message.warning('Odaberite liniju, turnus i smenu');
        return;
      }
      // Automatski postavi istu liniju za drugi turnus (95% slučajeva)
      if (!selectedLine2) {
        setSelectedLine2(selectedLine1);
        loadTurnusi2(selectedLine1.value);
      }
    } else if (currentStep === 2) {
      // Step 2: Drugi turnus
      if (!selectedLine2 || !selectedTurnus2 || !selectedShift2) {
        message.warning('Odaberite liniju, turnus i smenu');
        return;
      }
      // Validacija: ne može isti turnus sa istom smenom
      if (
        selectedLine1?.value === selectedLine2?.value &&
        selectedTurnus1?.turnusName === selectedTurnus2?.turnusName &&
        selectedShift1 === selectedShift2
      ) {
        message.error('Turnus sa istom smenom ne može biti povezan sam sa sobom!');
        return;
      }
    }
    setCurrentStep(currentStep + 1);
  };

  const handlePrev = () => {
    setCurrentStep(currentStep - 1);
  };

  // Handler za validne dane sa auto-čekiranjem radnih dana
  const handleDayChange = (dayKey: keyof ValidDays, checked: boolean) => {
    // Radni dani (Po-Pe)
    const weekdays: (keyof ValidDays)[] = [
      'validMonday',
      'validTuesday',
      'validWednesday',
      'validThursday',
      'validFriday',
    ];

    // Ako se čekira bilo koji radni dan, automatski čekiraj SVE radne dane
    if (checked && weekdays.includes(dayKey)) {
      setValidDays({
        ...validDays,
        validMonday: true,
        validTuesday: true,
        validWednesday: true,
        validThursday: true,
        validFriday: true,
      });
    } else {
      // Inače samo promeni taj dan
      setValidDays({
        ...validDays,
        [dayKey]: checked,
      });
    }
  };

  const handleSubmit = async () => {
    if (!selectedLine1 || !selectedTurnus1 || !selectedShift1 || !selectedLine2 || !selectedTurnus2 || !selectedShift2) {
      message.error('Svi podaci moraju biti popunjeni (uključujući smene)');
      return;
    }

    const dto: CreateLinkedTurnusDto = {
      lineNumber1: selectedLine1.value,
      turnusId1: selectedTurnus1.turnusId,
      turnusName1: selectedTurnus1.turnusName,
      shiftNumber1: selectedShift1,
      lineNumber2: selectedLine2.value,
      turnusId2: selectedTurnus2.turnusId,
      turnusName2: selectedTurnus2.turnusName,
      shiftNumber2: selectedShift2,
      description: description || undefined,
      status,
      validMonday: validDays.validMonday,
      validTuesday: validDays.validTuesday,
      validWednesday: validDays.validWednesday,
      validThursday: validDays.validThursday,
      validFriday: validDays.validFriday,
      validSaturday: validDays.validSaturday,
      validSunday: validDays.validSunday,
    };

    try {
      if (editingId) {
        await linkedTurnusiService.update(editingId, dto);
        message.success('Povezani turnus uspešno ažuriran');
      } else {
        await linkedTurnusiService.create(dto);
        message.success('Povezani turnus uspešno kreiran');
      }
      handleCloseModal();
      loadLinkedTurnusi();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Greška pri čuvanju');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await linkedTurnusiService.delete(id);
      message.success('Povezani turnus uspešno obrisan');
      loadLinkedTurnusi();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Greška pri brisanju');
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'Linija 1',
      dataIndex: 'lineNumber1',
      key: 'lineNumber1',
      width: 100,
    },
    {
      title: 'Turnus 1',
      dataIndex: 'turnusName1',
      key: 'turnusName1',
      width: 150,
    },
    {
      title: 'Smena 1',
      dataIndex: 'shiftNumber1',
      key: 'shiftNumber1',
      width: 100,
      render: (shift: number) => (
        <Tag color="blue">
          {shift === 1 ? 'I' : shift === 2 ? 'II' : 'III'}
        </Tag>
      ),
    },
    {
      title: 'Linija 2',
      dataIndex: 'lineNumber2',
      key: 'lineNumber2',
      width: 100,
    },
    {
      title: 'Turnus 2',
      dataIndex: 'turnusName2',
      key: 'turnusName2',
      width: 150,
    },
    {
      title: 'Smena 2',
      dataIndex: 'shiftNumber2',
      key: 'shiftNumber2',
      width: 100,
      render: (shift: number) => (
        <Tag color="blue">
          {shift === 1 ? 'I' : shift === 2 ? 'II' : 'III'}
        </Tag>
      ),
    },
    {
      title: 'Validni dani',
      key: 'validDays',
      width: 120,
      render: (record: LinkedTurnus) => (
        <Text>{formatValidDaysAsNumbers(record)}</Text>
      ),
    },
    {
      title: 'Napomena',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'ACTIVE' ? 'green' : 'red'}>
          {status === 'ACTIVE' ? 'Aktivan' : 'Neaktivan'}
        </Tag>
      ),
    },
    {
      title: 'Kreirao',
      key: 'creator',
      width: 150,
      render: (record: LinkedTurnus) =>
        record.creator
          ? `${record.creator.firstName} ${record.creator.lastName}`
          : '-',
    },
    {
      title: 'Akcije',
      key: 'actions',
      width: 120,
      render: (record: LinkedTurnus) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenModal(record)}
          />
          <Popconfirm
            title="Da li ste sigurni da želite da obrišete ovaj povezani turnus?"
            onConfirm={() => handleDelete(record.id)}
            okText="Da"
            cancelText="Ne"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <LinkOutlined className="text-2xl text-blue-500" />
            <Title level={2} className="mb-0">
              Povezani turnusi
            </Title>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleOpenModal()}
          >
            Novi Povezani Turnus
          </Button>
        </div>

        {/* Filter */}
        <div className="mb-4" style={{ width: 300 }}>
          <Text strong>Filter po liniji:</Text>
          <Select
            placeholder="Sve linije"
            options={[
              { value: '', label: 'Sve linije' },
              ...lines.map((l) => ({ value: l.value, label: l.label })),
            ]}
            onChange={(option: any) => setFilterLineNumber(option?.value || '')}
            isClearable
            className="mt-2"
          />
        </div>

        {/* Tabela */}
        <Table
          columns={columns}
          dataSource={linkedTurnusi}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Ukupno: ${total}`,
          }}
        />
      </Card>

      {/* Modal za kreiranje/editovanje */}
      <Modal
        title={editingId ? 'Ažuriraj Povezani Turnus' : 'Novi Povezani Turnus'}
        open={modalVisible}
        onCancel={handleCloseModal}
        footer={null}
        width={700}
      >
        <Steps current={currentStep} className="mb-6">
          <Step title="Validni dani" />
          <Step title="Prvi Turnus" />
          <Step title="Drugi Turnus" />
          <Step title="Detalji" />
        </Steps>

        {/* Step 0: Validni dani */}
        {currentStep === 0 && (
          <div>
            <Form layout="vertical">
              <Form.Item
                label="Odaberite dane u kojima povezani turnusi važe"
                required
              >
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {DAY_OPTIONS.map((day) => (
                    <Checkbox
                      key={day.value}
                      checked={validDays[day.value]}
                      onChange={(e) => handleDayChange(day.value, e.target.checked)}
                    >
                      {day.label}
                    </Checkbox>
                  ))}
                </div>
              </Form.Item>
            </Form>

            <div className="flex justify-end gap-2 mt-4">
              <Button onClick={handleCloseModal}>Otkaži</Button>
              <Button type="primary" onClick={handleNext}>
                Dalje
              </Button>
            </div>
          </div>
        )}

        {/* Step 1: Prvi turnus */}
        {currentStep === 1 && (
          <div>
            <Form layout="vertical">
              <Form.Item label="Linija 1" required>
                <Select
                  placeholder="Odaberite liniju"
                  options={lines}
                  value={selectedLine1}
                  onChange={(option: any) => {
                    setSelectedLine1(option);
                    setSelectedTurnus1(null);
                    if (option) {
                      loadTurnusi1(option.value);
                    }
                  }}
                />
              </Form.Item>

              {selectedLine1 && (
                <Form.Item label="Turnus 1" required>
                  <Select
                    placeholder="Odaberite turnus"
                    options={turnusi1}
                    value={selectedTurnus1}
                    onChange={(option: any) => {
                      setSelectedTurnus1(option);
                      setSelectedShift1(null); // Reset shift kada se menja turnus
                    }}
                  />
                </Form.Item>
              )}

              {selectedTurnus1 && (
                <Form.Item label="Smena 1" required>
                  <Select
                    placeholder="Odaberite smenu"
                    options={selectedTurnus1.shifts.map((shift) => ({
                      value: shift,
                      label:
                        shift === 1
                          ? 'Prva smena'
                          : shift === 2
                            ? 'Druga smena'
                            : 'Treća smena',
                    }))}
                    value={
                      selectedShift1
                        ? {
                            value: selectedShift1,
                            label:
                              selectedShift1 === 1
                                ? 'Prva smena'
                                : selectedShift1 === 2
                                  ? 'Druga smena'
                                  : 'Treća smena',
                          }
                        : null
                    }
                    onChange={(option: any) => setSelectedShift1(option?.value || null)}
                  />
                </Form.Item>
              )}
            </Form>

            <div className="flex justify-end gap-2 mt-4">
              <Button onClick={handleCloseModal}>Otkaži</Button>
              <Button type="primary" onClick={handleNext}>
                Dalje
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Drugi turnus */}
        {currentStep === 2 && (
          <div>
            <Form layout="vertical">
              <Form.Item label="Linija 2" required>
                <Select
                  placeholder="Odaberite liniju"
                  options={lines}
                  value={selectedLine2}
                  onChange={(option: any) => {
                    setSelectedLine2(option);
                    setSelectedTurnus2(null);
                    if (option) {
                      loadTurnusi2(option.value);
                    }
                  }}
                />
              </Form.Item>

              {selectedLine2 && (
                <Form.Item label="Turnus 2" required>
                  <Select
                    placeholder="Odaberite turnus"
                    options={turnusi2}
                    value={selectedTurnus2}
                    onChange={(option: any) => {
                      setSelectedTurnus2(option);
                      setSelectedShift2(null); // Reset shift kada se menja turnus
                    }}
                  />
                </Form.Item>
              )}

              {selectedTurnus2 && (
                <Form.Item label="Smena 2" required>
                  <Select
                    placeholder="Odaberite smenu"
                    options={selectedTurnus2.shifts.map((shift) => ({
                      value: shift,
                      label:
                        shift === 1
                          ? 'Prva smena'
                          : shift === 2
                            ? 'Druga smena'
                            : 'Treća smena',
                    }))}
                    value={
                      selectedShift2
                        ? {
                            value: selectedShift2,
                            label:
                              selectedShift2 === 1
                                ? 'Prva smena'
                                : selectedShift2 === 2
                                  ? 'Druga smena'
                                  : 'Treća smena',
                          }
                        : null
                    }
                    onChange={(option: any) => setSelectedShift2(option?.value || null)}
                  />
                </Form.Item>
              )}
            </Form>

            <div className="flex justify-end gap-2 mt-4">
              <Button onClick={handlePrev}>Nazad</Button>
              <Button type="primary" onClick={handleNext}>
                Dalje
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Detalji i potvrda */}
        {currentStep === 3 && (
          <div>
            <div className="mb-4 p-4 bg-gray-50 rounded">
              <Text strong>Pregled odabranih turnusa:</Text>
              <div className="mt-2">
                <p>
                  <strong>Validni dani:</strong> {formatValidDays(validDays)}
                </p>
                <p>
                  <strong>Prvi turnus:</strong> Linija {selectedLine1?.value} -{' '}
                  {selectedTurnus1?.turnusName} - Smena{' '}
                  {selectedShift1 === 1
                    ? 'Prva (I)'
                    : selectedShift1 === 2
                      ? 'Druga (II)'
                      : 'Treća (III)'}
                </p>
                <p>
                  <strong>Drugi turnus:</strong> Linija {selectedLine2?.value} -{' '}
                  {selectedTurnus2?.turnusName} - Smena{' '}
                  {selectedShift2 === 1
                    ? 'Prva (I)'
                    : selectedShift2 === 2
                      ? 'Druga (II)'
                      : 'Treća (III)'}
                </p>
              </div>
            </div>

            <Form layout="vertical">
              <Form.Item label="Napomena/Opis">
                <TextArea
                  rows={3}
                  placeholder="Unesite napomenu..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Form.Item>

              <Form.Item label="Status">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={status === 'ACTIVE'}
                    onChange={(checked) =>
                      setStatus(checked ? 'ACTIVE' : 'INACTIVE')
                    }
                  />
                  <Text>{status === 'ACTIVE' ? 'Aktivan' : 'Neaktivan'}</Text>
                </div>
              </Form.Item>
            </Form>

            <div className="flex justify-end gap-2 mt-4">
              <Button onClick={handlePrev}>Nazad</Button>
              <Button type="primary" onClick={handleSubmit}>
                {editingId ? 'Ažuriraj' : 'Kreiraj'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default LinkedTurnusiPage;
