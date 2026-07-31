// Mocka o Firestore só para o import do módulo não quebrar — as funções
// testadas aqui são puras e não tocam no banco.
jest.mock('@react-native-firebase/firestore', () => new Proxy({}, { get: () => jest.fn() }));
jest.mock('@react-native-firebase/auth', () => new Proxy({}, { get: () => jest.fn() }));

import {
  overlaps,
  isWithinBusinessHours,
  generateSlots,
  filterAvailableSlots,
  type Slot,
} from './availability.service';

const settings = { openHour: 8, closeHour: 18, slotStepMin: 30, parallelCapacity: 2 } as any;

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
  it('gera slots do openHour ao closeHour no passo da duração', () => {
    const day = new Date(2026, 6, 15);
    const slots = generateSlots(day, settings, 30);
    // 8h→18h = 10h = 600min / 30 = 20 slots
    expect(slots).toHaveLength(20);
    expect(new Date(slots[0].startAtMs).getHours()).toBe(8);
    expect(new Date(slots[slots.length - 1].endAtMs).getHours()).toBe(18);
  });

  it('serviço mais longo gera menos slots', () => {
    const day = new Date(2026, 6, 15);
    expect(generateSlots(day, settings, 90)).toHaveLength(6); // 600/90 = 6 (arredonda p/ baixo)
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
