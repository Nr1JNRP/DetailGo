// Mocka firestore/auth só para o import do módulo — as funções aqui são puras.
jest.mock('@react-native-firebase/firestore', () => new Proxy({}, { get: () => jest.fn() }));
jest.mock('@react-native-firebase/auth', () => new Proxy({}, { get: () => jest.fn() }));

import { isExpiredAppointment, resolveDisplayStatus } from './appointmentRules';
import { NO_SHOW_GRACE_MS } from '../domain/appointment.constants';
import type { AppointmentStatus } from '../domain/appointment.types';

const AGORA = new Date(2026, 6, 15, 14, 0, 0).getTime();

// O horário do agendamento é sempre relativo a "agora", porque a regra compara
// com Date.now(). Positivo = futuro, negativo = passado.
const emMinutos = (min: number) => AGORA + min * 60 * 1000;

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(AGORA);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('isExpiredAppointment', () => {
  it('agendamento futuro não expira', () => {
    expect(isExpiredAppointment(emMinutos(30), 'scheduled')).toBe(false);
  });

  it('não expira dentro da tolerância de atraso', () => {
    // Começou há 10min; a tolerância é 15min, então ainda dá tempo de chegar.
    expect(isExpiredAppointment(emMinutos(-10), 'scheduled')).toBe(false);
  });

  it('expira quando passa da tolerância', () => {
    expect(isExpiredAppointment(emMinutos(-16), 'scheduled')).toBe(true);
  });

  it('expira exatamente no limite da tolerância', () => {
    // A comparação é >=, então no milissegundo exato já conta como expirado.
    const inicio = AGORA - NO_SHOW_GRACE_MS;
    expect(isExpiredAppointment(inicio, 'scheduled')).toBe(true);
  });

  it('um milissegundo antes do limite ainda não expirou', () => {
    const inicio = AGORA - NO_SHOW_GRACE_MS + 1;
    expect(isExpiredAppointment(inicio, 'scheduled')).toBe(false);
  });

  // Só 'scheduled' pode virar no-show: os demais já têm desfecho definido e
  // não devem ser reinterpretados pela passagem do tempo.
  const statusQueNaoExpiram: AppointmentStatus[] = ['in_progress', 'done', 'cancelled', 'no_show'];

  it.each(statusQueNaoExpiram)('status %s nunca expira, mesmo bem atrasado', status => {
    expect(isExpiredAppointment(emMinutos(-600), status)).toBe(false);
  });
});

describe('resolveDisplayStatus', () => {
  it('mostra no_show quando o agendamento expirou', () => {
    expect(resolveDisplayStatus(emMinutos(-30), 'scheduled')).toBe('no_show');
  });

  it('mantém scheduled enquanto não expirou', () => {
    expect(resolveDisplayStatus(emMinutos(30), 'scheduled')).toBe('scheduled');
  });

  it('mantém scheduled dentro da tolerância', () => {
    expect(resolveDisplayStatus(emMinutos(-5), 'scheduled')).toBe('scheduled');
  });

  it('não altera status que já tem desfecho', () => {
    // Em atendimento não vira no_show mesmo com o horário de início vencido:
    // o cliente chegou, o serviço começou.
    expect(resolveDisplayStatus(emMinutos(-120), 'in_progress')).toBe('in_progress');
    expect(resolveDisplayStatus(emMinutos(-120), 'done')).toBe('done');
    expect(resolveDisplayStatus(emMinutos(-120), 'cancelled')).toBe('cancelled');
    expect(resolveDisplayStatus(emMinutos(-120), 'no_show')).toBe('no_show');
  });
});
