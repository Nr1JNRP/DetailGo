// Mocka o Firestore só para o import do módulo não quebrar — as funções
// testadas aqui são puras e não tocam no banco.
jest.mock('@react-native-firebase/firestore', () => new Proxy({}, { get: () => jest.fn() }));
jest.mock('@react-native-firebase/auth', () => new Proxy({}, { get: () => jest.fn() }));

import {
  overlaps,
  isWithinBusinessHours,
  generateSlots,
  filterAvailableSlots,
  respectsMinNotice,
  type Slot,
} from './availability.service';

const settings = {
  openHour: 8,
  closeHour: 18,
  slotStepMin: 30,
  parallelCapacity: 2,
  minNoticeMin: 15,
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
