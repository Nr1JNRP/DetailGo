const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockRunTransaction = jest.fn();
const mockTxSet = jest.fn();

// Mock completo do Firestore: as funções puras não o usam, mas as de
// disponibilidade e criação de agendamento dependem dele.
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn((...args: unknown[]) => ({ path: args.slice(1).join('/') })),
  doc: jest.fn((...args: unknown[]) => ({ path: args.slice(1).join('/'), id: 'generated-id' })),
  query: jest.fn((ref: unknown) => ref),
  where: jest.fn((...args: unknown[]) => ({ where: args })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  serverTimestamp: jest.fn(() => 'mock-server-timestamp'),
}));
jest.mock('@react-native-firebase/auth', () => new Proxy({}, { get: () => jest.fn() }));

const mockGetShopSettings = jest.fn();
jest.mock('@features/settings', () => ({
  getShopSettings: (...args: unknown[]) => mockGetShopSettings(...args),
}));

import {
  overlaps,
  isWithinBusinessHours,
  generateSlots,
  filterAvailableSlots,
  respectsMinNotice,
  getAvailableSlotsForDay,
  createAppointmentWithCapacityCheck,
  checkSlotAvailability,
  AvailabilityError,
  type Slot,
} from './availability.service';

const settings = {
  openHour: 8,
  closeHour: 18,
  slotStepMin: 30,
  parallelCapacity: 2,
  minNoticeMin: 15,
  workingDays: ['seg', 'ter', 'qua', 'qui', 'sex'],
} as any;

function slotAt(hour: number, minute: number, durationMin: number): Slot {
  const d = new Date(2026, 6, 15);
  d.setHours(hour, minute, 0, 0);
  const start = d.getTime();
  return { startAtMs: start, endAtMs: start + durationMin * 60 * 1000, durationMin };
}

describe('overlaps', () => {
  it('detecta sobreposição real', () => {
    expect(overlaps(0, 10, 5, 15)).toBe(true);
    expect(overlaps(5, 15, 0, 10)).toBe(true);
  });

  it('horários que só se tocam não sobrepõem', () => {
    expect(overlaps(0, 10, 10, 20)).toBe(false);
  });

  it('intervalos separados não sobrepõem', () => {
    expect(overlaps(0, 10, 20, 30)).toBe(false);
  });
});

describe('isWithinBusinessHours', () => {
  it('aceita slot dentro do expediente', () => {
    expect(isWithinBusinessHours(slotAt(8, 0, 30), settings)).toBe(true);
    expect(isWithinBusinessHours(slotAt(17, 30, 30), settings)).toBe(true);
  });

  it('rejeita antes da abertura', () => {
    expect(isWithinBusinessHours(slotAt(7, 30, 30), settings)).toBe(false);
  });

  it('rejeita quando termina após o fechamento', () => {
    expect(isWithinBusinessHours(slotAt(17, 45, 30), settings)).toBe(false);
  });
});

describe('generateSlots', () => {
  const day = new Date(2026, 6, 15);

  it('gera slots do openHour ao closeHour no passo configurado', () => {
    const slots = generateSlots(day, settings, 30);
    // 8h→18h = 600min; passo 30 e duração 30 → último começa 17:30 → 20 slots
    expect(slots).toHaveLength(20);
    expect(new Date(slots[0].startAtMs).getHours()).toBe(8);
    expect(new Date(slots[slots.length - 1].endAtMs).getHours()).toBe(18);
  });

  it('serviço longo continua no passo do slot, não no da duração', () => {
    // 90min com passo de 30: 8:00, 8:30, 9:00… último que cabe começa 16:30.
    const slots = generateSlots(day, settings, 90);
    expect(slots).toHaveLength(18);

    const starts = slots.map(s => new Date(s.startAtMs));
    expect(starts[1].getHours()).toBe(8);
    expect(starts[1].getMinutes()).toBe(30);
    expect(starts[starts.length - 1].getHours()).toBe(16);
    expect(starts[starts.length - 1].getMinutes()).toBe(30);
  });

  it('respeita o passo de 15 e de 60 minutos', () => {
    // passo 15: 8:00 → 17:30 (último que cabe) = 39 slots
    expect(generateSlots(day, { ...settings, slotStepMin: 15 }, 30)).toHaveLength(39);
    // passo 60: 8:00 → 17:00 = 10 slots
    expect(generateSlots(day, { ...settings, slotStepMin: 60 }, 30)).toHaveLength(10);
  });

  it('nenhum slot ultrapassa o fechamento', () => {
    const slots = generateSlots(day, settings, 90);
    const close = new Date(day);
    close.setHours(18, 0, 0, 0);
    expect(slots.every(s => s.endAtMs <= close.getTime())).toBe(true);
  });
});

describe('respectsMinNotice', () => {
  const now = new Date(2026, 6, 15, 15, 37).getTime();

  it('rejeita horário que começa antes da antecedência mínima', () => {
    // 15:37 + 15min de antecedência → 15:45 ainda não vale
    expect(respectsMinNotice(slotAt(15, 45, 90), 15, now)).toBe(false);
  });

  it('aceita horário com folga suficiente', () => {
    // era o caso real: loja vazia às 15:37 e o cliente quer as 16:00
    expect(respectsMinNotice(slotAt(16, 0, 90), 15, now)).toBe(true);
  });

  it('aceita exatamente no limite da antecedência', () => {
    expect(respectsMinNotice(slotAt(15, 52, 90), 15, now)).toBe(true);
  });

  it('antecedência zero aceita qualquer horário futuro', () => {
    expect(respectsMinNotice(slotAt(15, 38, 90), 0, now)).toBe(true);
  });
});

describe('filterAvailableSlots (parallelCapacity)', () => {
  const slot = slotAt(8, 0, 30);
  const overlapping = { startAtMs: slot.startAtMs, endAtMs: slot.endAtMs } as any;

  it('mantém o slot enquanto a lotação não é atingida', () => {
    expect(filterAvailableSlots([slot], [overlapping], 2)).toHaveLength(1);
  });

  it('remove o slot quando atinge a capacidade paralela', () => {
    expect(filterAvailableSlots([slot], [overlapping, overlapping], 2)).toHaveLength(0);
  });

  it('capacidade 1 remove com um único agendamento sobreposto', () => {
    expect(filterAvailableSlots([slot], [overlapping], 1)).toHaveLength(0);
  });

  it('agendamento em outro horário não bloqueia o slot', () => {
    const other = {
      startAtMs: slotAt(10, 0, 30).startAtMs,
      endAtMs: slotAt(10, 30, 30).endAtMs,
    } as any;
    expect(filterAvailableSlots([slot], [other], 1)).toHaveLength(1);
  });
});

// ─── A partir daqui, as funções que falam com o Firestore ───

/** Monta o retorno de getDocs a partir de documentos simples. */
const snapDocs = (docs: Record<string, unknown>[]) => ({
  docs: docs.map((data, i) => ({ id: `doc-${i}`, data: () => data })),
});

/** Quarta-feira, dia útil na configuração padrão. */
const QUARTA = new Date(2026, 6, 15);

function horarioEm(hour: number, minute = 0): number {
  const d = new Date(QUARTA);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

beforeEach(() => {
  // clearAllMocks não esvazia a fila de mockResolvedValueOnce — usamos
  // mockReset em quem consome ...Once para não vazar valor entre testes.
  mockGetDoc.mockReset();
  mockGetDocs.mockReset();
  mockRunTransaction.mockReset();
  mockTxSet.mockReset();
  mockGetShopSettings.mockReset();
  mockGetShopSettings.mockResolvedValue(settings);
  // O serviço busca o nome do cliente ANTES de validar o horário, então até os
  // testes de recusa passam por aqui. Um mockResolvedValueOnce no teste tem
  // precedência sobre este padrão.
  mockGetDoc.mockResolvedValue({ data: () => ({ firstName: 'Ana', lastName: 'Silva' }) });
  // Congela o "agora" às 9:00 da quarta: os slots do dia ficam no futuro.
  jest.spyOn(Date, 'now').mockReturnValue(horarioEm(9, 0));
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('getAvailableSlotsForDay', () => {
  it('devolve vazio em dia que a estética não atende', async () => {
    const domingo = new Date(2026, 6, 19);
    const slots = await getAvailableSlotsForDay(domingo, 30, 'shop-1');

    expect(slots).toEqual([]);
    // Nem chega a consultar os horários ocupados.
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('devolve apenas horários futuros que respeitam a antecedência', async () => {
    mockGetDocs.mockResolvedValueOnce(snapDocs([]));

    const slots = await getAvailableSlotsForDay(QUARTA, 30, 'shop-1');

    // Agora são 9:00 e a antecedência é 15min: o primeiro válido é 9:30.
    expect(new Date(slots[0].startAtMs).getHours()).toBe(9);
    expect(new Date(slots[0].startAtMs).getMinutes()).toBe(30);
    expect(slots.every(s => s.startAtMs >= horarioEm(9, 15))).toBe(true);
  });

  it('descarta o próximo horário quando ele não respeita a antecedência', async () => {
    // Às 9:20, o horário das 9:30 está a 10min — menos que os 15 exigidos.
    jest.spyOn(Date, 'now').mockReturnValue(horarioEm(9, 20));
    mockGetDocs.mockResolvedValueOnce(snapDocs([]));

    const slots = await getAvailableSlotsForDay(QUARTA, 30, 'shop-1');

    expect(slots.some(s => s.startAtMs === horarioEm(9, 30))).toBe(false);
    expect(new Date(slots[0].startAtMs).getHours()).toBe(10);
    expect(new Date(slots[0].startAtMs).getMinutes()).toBe(0);
  });

  it('remove horário cuja capacidade paralela está esgotada', async () => {
    const ocupado = { startAtMs: horarioEm(10, 0), endAtMs: horarioEm(10, 30) };
    // parallelCapacity é 2: dois agendamentos sobrepostos lotam o horário.
    mockGetDocs.mockResolvedValueOnce(snapDocs([ocupado, ocupado]));

    const slots = await getAvailableSlotsForDay(QUARTA, 30, 'shop-1');

    expect(slots.some(s => s.startAtMs === horarioEm(10, 0))).toBe(false);
    // Os vizinhos continuam livres.
    expect(slots.some(s => s.startAtMs === horarioEm(10, 30))).toBe(true);
  });

  it('um único agendamento não bloqueia horário com capacidade 2', async () => {
    mockGetDocs.mockResolvedValueOnce(
      snapDocs([{ startAtMs: horarioEm(10, 0), endAtMs: horarioEm(10, 30) }]),
    );

    const slots = await getAvailableSlotsForDay(QUARTA, 30, 'shop-1');

    expect(slots.some(s => s.startAtMs === horarioEm(10, 0))).toBe(true);
  });
});

describe('checkSlotAvailability', () => {
  it('recusa horário no passado', async () => {
    const res = await checkSlotAvailability(horarioEm(8, 0), 30, 'shop-1');

    expect(res.available).toBe(false);
    expect(res.reason).toMatch(/passado/i);
  });

  it('recusa horário dentro da antecedência mínima', async () => {
    // Agora são 9:00; 9:10 não respeita os 15min exigidos.
    const res = await checkSlotAvailability(horarioEm(9, 10), 30, 'shop-1');

    expect(res.available).toBe(false);
    expect(res.reason).toMatch(/antecedência/i);
  });

  it('recusa horário fora do expediente', async () => {
    const res = await checkSlotAvailability(horarioEm(19, 0), 30, 'shop-1');

    expect(res.available).toBe(false);
    expect(res.reason).toMatch(/comercial/i);
  });

  it('recusa quando a capacidade está esgotada', async () => {
    const ocupado = { startAtMs: horarioEm(11, 0), endAtMs: horarioEm(11, 30) };
    mockGetDocs.mockResolvedValueOnce(snapDocs([ocupado, ocupado]));

    const res = await checkSlotAvailability(horarioEm(11, 0), 30, 'shop-1');

    expect(res.available).toBe(false);
    expect(res.reason).toMatch(/capacidade/i);
  });

  it('aceita horário livre e válido', async () => {
    mockGetDocs.mockResolvedValueOnce(snapDocs([]));

    const res = await checkSlotAvailability(horarioEm(11, 0), 30, 'shop-1');

    expect(res).toEqual({ available: true });
  });

  it('ignora agendamentos do dia que não conflitam com o horário pedido', async () => {
    // A estética está lotada às 15h, mas isso não afeta quem quer as 11h.
    mockGetDocs.mockResolvedValueOnce(
      snapDocs([
        { startAtMs: horarioEm(15, 0), endAtMs: horarioEm(15, 30) },
        { startAtMs: horarioEm(15, 0), endAtMs: horarioEm(15, 30) },
      ]),
    );

    const res = await checkSlotAvailability(horarioEm(11, 0), 30, 'shop-1');

    expect(res).toEqual({ available: true });
  });
});

describe('createAppointmentWithCapacityCheck', () => {
  const entrada = {
    shopId: 'shop-1',
    customerUid: 'user-1',
    vehicleType: 'car',
    carCategory: 'medium',
    serviceLabel: 'Higienização de bancos',
    durationMin: 90,
    price: 250,
    startAtMs: horarioEm(11, 0),
    endAtMs: horarioEm(12, 30),
  } as any;

  /** Prepara os mocks do caminho feliz até a transação. */
  function prepararCaminhoFeliz(slotsOcupados: Record<string, unknown>[] = []) {
    mockGetDoc.mockResolvedValueOnce({ data: () => ({ firstName: 'Ana', lastName: 'Silva' }) });
    mockGetDocs.mockResolvedValueOnce(snapDocs([])); // agendamentos do cliente por dayKey
    mockGetDocs.mockResolvedValueOnce(snapDocs([])); // agendamentos do cliente por período
    mockGetDocs.mockResolvedValueOnce(snapDocs(slotsOcupados)); // slots do shop na transação
    mockRunTransaction.mockImplementation(async (_db, fn) => fn({ set: mockTxSet }));
  }

  it('recusa agendamento no passado', async () => {
    await expect(
      createAppointmentWithCapacityCheck({ ...entrada, startAtMs: horarioEm(8, 0) }),
    ).rejects.toMatchObject({ code: 'PAST_DATE' });
  });

  it('recusa agendamento sem a antecedência mínima', async () => {
    await expect(
      createAppointmentWithCapacityCheck({
        ...entrada,
        startAtMs: horarioEm(9, 5),
        endAtMs: horarioEm(10, 35),
      }),
    ).rejects.toMatchObject({ code: 'MIN_NOTICE' });
  });

  it('recusa agendamento fora do expediente', async () => {
    await expect(
      createAppointmentWithCapacityCheck({
        ...entrada,
        startAtMs: horarioEm(17, 0),
        endAtMs: horarioEm(18, 30),
      }),
    ).rejects.toMatchObject({ code: 'OUTSIDE_BUSINESS_HOURS' });
  });

  it('recusa quando o cliente já tem agendamento ativo em outra estética no dia', async () => {
    mockGetDoc.mockResolvedValueOnce({ data: () => ({ firstName: 'Ana' }) });
    mockGetDocs.mockResolvedValueOnce(
      snapDocs([{ status: 'scheduled', shopId: 'shop-2', whenMs: horarioEm(14, 0) }]),
    );
    mockGetDocs.mockResolvedValueOnce(snapDocs([]));

    await expect(createAppointmentWithCapacityCheck(entrada)).rejects.toMatchObject({
      code: 'CUSTOMER_DAILY_SHOP_CONFLICT',
    });
  });

  it('permite quando o agendamento em outra estética já foi cancelado', async () => {
    mockGetDoc.mockResolvedValueOnce({ data: () => ({ firstName: 'Ana' }) });
    mockGetDocs.mockResolvedValueOnce(
      snapDocs([{ status: 'cancelled', shopId: 'shop-2', whenMs: horarioEm(14, 0) }]),
    );
    mockGetDocs.mockResolvedValueOnce(snapDocs([]));
    mockGetDocs.mockResolvedValueOnce(snapDocs([]));
    mockRunTransaction.mockImplementation(async (_db, fn) => fn({ set: mockTxSet }));

    await expect(createAppointmentWithCapacityCheck(entrada)).resolves.toBeDefined();
  });

  it('detecta conflito vindo só da consulta por período', async () => {
    // O serviço consulta os agendamentos do cliente duas vezes: por dayKey e
    // por faixa de whenMs. A segunda existe para alcançar documentos antigos,
    // gravados antes do dayKey existir — o conflito precisa ser detectado
    // mesmo que só ela encontre o agendamento.
    mockGetDoc.mockResolvedValueOnce({ data: () => ({ firstName: 'Ana' }) });
    mockGetDocs.mockResolvedValueOnce(snapDocs([])); // por dayKey: nada
    mockGetDocs.mockResolvedValueOnce(
      snapDocs([{ status: 'scheduled', shopId: 'shop-2', whenMs: horarioEm(14, 0) }]),
    );

    await expect(createAppointmentWithCapacityCheck(entrada)).rejects.toMatchObject({
      code: 'CUSTOMER_DAILY_SHOP_CONFLICT',
    });
  });

  it('permite outro agendamento na mesma estética no mesmo dia', async () => {
    mockGetDoc.mockResolvedValueOnce({ data: () => ({ firstName: 'Ana' }) });
    mockGetDocs.mockResolvedValueOnce(
      snapDocs([{ status: 'scheduled', shopId: 'shop-1', whenMs: horarioEm(14, 0) }]),
    );
    mockGetDocs.mockResolvedValueOnce(snapDocs([]));
    mockGetDocs.mockResolvedValueOnce(snapDocs([]));
    mockRunTransaction.mockImplementation(async (_db, fn) => fn({ set: mockTxSet }));

    await expect(createAppointmentWithCapacityCheck(entrada)).resolves.toBeDefined();
  });

  it('recusa quando a capacidade do horário está esgotada', async () => {
    const ocupado = { startAtMs: horarioEm(11, 30), endAtMs: horarioEm(12, 0) };
    prepararCaminhoFeliz([ocupado, ocupado]);

    await expect(createAppointmentWithCapacityCheck(entrada)).rejects.toMatchObject({
      code: 'SLOT_FULL',
    });
    expect(mockTxSet).not.toHaveBeenCalled();
  });

  it('agendamento em outro horário do dia não ocupa a capacidade', async () => {
    // A loja tem dois atendimentos às 15h — capacidade cheia lá, livre às 11h.
    prepararCaminhoFeliz([
      { startAtMs: horarioEm(15, 0), endAtMs: horarioEm(15, 30) },
      { startAtMs: horarioEm(15, 0), endAtMs: horarioEm(15, 30) },
    ]);

    await expect(createAppointmentWithCapacityCheck(entrada)).resolves.toBeDefined();
  });

  it('grava agendamento, slot espelho e cópia do cliente', async () => {
    prepararCaminhoFeliz();

    const res = await createAppointmentWithCapacityCheck(entrada);

    expect(res).toEqual({ id: 'generated-id' });
    expect(mockTxSet).toHaveBeenCalledTimes(3);

    // 1. Agendamento do shop, com o nome do cliente resolvido.
    expect(mockTxSet).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        shopId: 'shop-1',
        customerUid: 'user-1',
        customerName: 'Ana Silva',
        serviceLabel: 'Higienização de bancos',
        status: 'scheduled',
        startAtMs: entrada.startAtMs,
      }),
    );

    // 2. Slot espelho: só horários, sem PII — é o que o cliente lê.
    const [, slotGravado] = mockTxSet.mock.calls[1];
    expect(Object.keys(slotGravado).sort()).toEqual(['dayKey', 'endAtMs', 'shopId', 'startAtMs']);
    expect(slotGravado).not.toHaveProperty('customerName');
    expect(slotGravado).not.toHaveProperty('customerUid');

    // 3. Cópia na subcoleção do cliente, para listagem rápida.
    expect(mockTxSet).toHaveBeenNthCalledWith(
      3,
      expect.anything(),
      expect.objectContaining({ appointmentId: 'generated-id', whenMs: entrada.startAtMs }),
    );
  });

  it('usa "Cliente" quando o documento do usuário não tem dados', async () => {
    // data() devolve undefined quando o documento não existe — o serviço cai
    // no objeto vazio e ainda assim grava o agendamento.
    mockGetDoc.mockResolvedValueOnce({ data: () => undefined });
    mockGetDocs.mockResolvedValueOnce(snapDocs([]));
    mockGetDocs.mockResolvedValueOnce(snapDocs([]));
    mockGetDocs.mockResolvedValueOnce(snapDocs([]));
    mockRunTransaction.mockImplementation(async (_db, fn) => fn({ set: mockTxSet }));

    await createAppointmentWithCapacityCheck(entrada);

    expect(mockTxSet).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({ customerName: 'Cliente' }),
    );
  });

  it('usa "Cliente" quando o perfil não tem nome', async () => {
    mockGetDoc.mockResolvedValueOnce({ data: () => ({}) });
    mockGetDocs.mockResolvedValueOnce(snapDocs([]));
    mockGetDocs.mockResolvedValueOnce(snapDocs([]));
    mockGetDocs.mockResolvedValueOnce(snapDocs([]));
    mockRunTransaction.mockImplementation(async (_db, fn) => fn({ set: mockTxSet }));

    await createAppointmentWithCapacityCheck(entrada);

    expect(mockTxSet).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({ customerName: 'Cliente' }),
    );
  });

  it('erros de disponibilidade carregam código para a UI tratar', async () => {
    await expect(
      createAppointmentWithCapacityCheck({ ...entrada, startAtMs: horarioEm(8, 0) }),
    ).rejects.toBeInstanceOf(AvailabilityError);
  });
});
