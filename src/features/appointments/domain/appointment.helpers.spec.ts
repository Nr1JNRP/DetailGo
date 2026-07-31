import {
  isExpiredScheduled,
  filterActiveAppointments,
  getAppointmentStatusConfig,
} from './appointment.helpers';
import { NO_SHOW_GRACE_MS } from './appointment.constants';

describe('isExpiredScheduled', () => {
  const start = 1_000_000_000_000; // instante de referência

  it('é falso quando o horário ainda não chegou', () => {
    expect(isExpiredScheduled('scheduled', start, start - 60_000)).toBe(false);
  });

  it('é falso dentro da tolerância (passou do horário mas < graça)', () => {
    expect(isExpiredScheduled('scheduled', start, start + NO_SHOW_GRACE_MS - 1)).toBe(false);
  });

  it('é verdadeiro após horário + tolerância', () => {
    expect(isExpiredScheduled('scheduled', start, start + NO_SHOW_GRACE_MS + 1)).toBe(true);
  });

  it('só vale para scheduled — outros status nunca expiram por aqui', () => {
    const wayPast = start + NO_SHOW_GRACE_MS + 10_000;
    expect(isExpiredScheduled('done', start, wayPast)).toBe(false);
    expect(isExpiredScheduled('cancelled', start, wayPast)).toBe(false);
    expect(isExpiredScheduled('in_progress', start, wayPast)).toBe(false);
    expect(isExpiredScheduled('no_show', start, wayPast)).toBe(false);
  });
});

describe('filterActiveAppointments', () => {
  it('mantém só scheduled e in_progress', () => {
    const items = [
      { status: 'scheduled' },
      { status: 'in_progress' },
      { status: 'done' },
      { status: 'cancelled' },
      { status: 'no_show' },
    ];
    expect(filterActiveAppointments(items)).toEqual([
      { status: 'scheduled' },
      { status: 'in_progress' },
    ]);
  });
});

describe('getAppointmentStatusConfig', () => {
  it.each([
    ['scheduled', 'Agendado'],
    ['in_progress', 'Em andamento'],
    ['done', 'Concluído'],
    ['no_show', 'Não realizado'],
    ['cancelled', 'Cancelado'],
  ] as const)('%s → label "%s"', (status, label) => {
    expect(getAppointmentStatusConfig(status).label).toBe(label);
  });
});
