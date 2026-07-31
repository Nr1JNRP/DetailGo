// Mocka firestore/auth só para o import do módulo — getAppointmentRules é pura.
jest.mock('@react-native-firebase/firestore', () => new Proxy({}, { get: () => jest.fn() }));
jest.mock('@react-native-firebase/auth', () => new Proxy({}, { get: () => jest.fn() }));

import { getAppointmentRules } from './appointment.service';

const HOUR = 60 * 60 * 1000;

describe('getAppointmentRules', () => {
  it('agendamento futuro pode ser cancelado', () => {
    const rules = getAppointmentRules({ status: 'scheduled', startAtMs: Date.now() + HOUR });
    expect(rules.canCancel).toBe(true);
    expect(rules.isExpired).toBe(false);
  });

  it('NÃO cancela depois do horário marcado (corte no instante)', () => {
    const rules = getAppointmentRules({ status: 'scheduled', startAtMs: Date.now() - HOUR });
    expect(rules.canCancel).toBe(false);
    expect(rules.message).toMatch(/já passou/i);
  });

  it('exatamente no horário já não permite cancelar', () => {
    const rules = getAppointmentRules({ status: 'scheduled', startAtMs: Date.now() });
    expect(rules.canCancel).toBe(false);
  });

  it.each([
    ['cancelled', /cancelado/i],
    ['no_show', /não compareceu/i],
    ['done', /já foi realizado/i],
    ['in_progress', /andamento/i],
  ] as const)('status %s não permite cancelar e explica o motivo', (status, motivo) => {
    const rules = getAppointmentRules({ status, startAtMs: Date.now() + HOUR });
    expect(rules.canCancel).toBe(false);
    expect(rules.message).toMatch(motivo);
  });
});
