const mockGetDoc = jest.fn();
const mockUpdateDoc = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  doc: jest.fn((...args: unknown[]) => ({ path: args.slice(1).join('/') })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  serverTimestamp: jest.fn(() => 'mock-server-timestamp'),
}));
jest.mock('@react-native-firebase/auth', () => new Proxy({}, { get: () => jest.fn() }));

// O serviço importa de '@features/appointments' — o barrel da feature, que
// também reexporta as telas. Sem este mock, carregar o serviço arrasta a
// AppointmentScreen inteira e o Jest quebra num pacote ESM que ela usa.
jest.mock('@features/appointments', () => ({
  NO_SHOW_GRACE_MS: jest.requireActual('@features/appointments/domain/appointment.constants')
    .NO_SHOW_GRACE_MS,
}));

import { updateAppointmentStatus } from './adminAppointments.service';
import { NO_SHOW_GRACE_MS } from '@features/appointments/domain/appointment.constants';

const AGORA = new Date(2026, 6, 15, 14, 0, 0).getTime();
const base = { shopId: 'shop-1', appointmentId: 'appt-1' };

/** Agendamento que já passou da tolerância de atraso. */
const expirado = AGORA - NO_SHOW_GRACE_MS - 60_000;
/** Agendamento ainda dentro da tolerância. */
const recente = AGORA - 60_000;

function snapCom(data: Record<string, unknown> | undefined) {
  return { data: () => data };
}

beforeEach(() => {
  mockGetDoc.mockReset();
  mockUpdateDoc.mockReset();
  // A função não aguarda o updateDoc — encadeia .catch() nele. O mock precisa
  // devolver promise, senão quebra com TypeError.
  mockUpdateDoc.mockResolvedValue(undefined);
  jest.spyOn(Date, 'now').mockReturnValue(AGORA);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('updateAppointmentStatus', () => {
  it('grava o status e o carimbo de atualização', async () => {
    mockGetDoc.mockResolvedValueOnce(
      snapCom({ startAtMs: AGORA + 3_600_000, status: 'scheduled' }),
    );

    await updateAppointmentStatus({ ...base, status: 'cancelled' });

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'shops/shop-1/appointments/appt-1' }),
      expect.objectContaining({ status: 'cancelled', updatedAt: 'mock-server-timestamp' }),
    );
  });

  // Cada transição relevante carimba seu próprio horário, para o histórico
  // saber quando o serviço começou, terminou ou foi dado como falta.
  it.each([
    ['in_progress', 'startedAt'],
    ['done', 'doneAt'],
    ['no_show', 'noShowAt'],
  ] as const)('status %s carimba %s', async (status, campo) => {
    mockGetDoc.mockResolvedValueOnce(
      snapCom({ startAtMs: AGORA + 3_600_000, status: 'scheduled' }),
    );

    await updateAppointmentStatus({ ...base, status });

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ [campo]: 'mock-server-timestamp' }),
    );
  });

  it('cancelamento não carimba horário de início nem de conclusão', async () => {
    mockGetDoc.mockResolvedValueOnce(
      snapCom({ startAtMs: AGORA + 3_600_000, status: 'scheduled' }),
    );

    await updateAppointmentStatus({ ...base, status: 'cancelled' });

    const [, payload] = mockUpdateDoc.mock.calls[0];
    expect(payload).not.toHaveProperty('startedAt');
    expect(payload).not.toHaveProperty('doneAt');
    expect(payload).not.toHaveProperty('noShowAt');
  });

  describe('trava do agendamento expirado', () => {
    // O dono não pode dizer que atendeu alguém que nunca chegou: passada a
    // tolerância, um agendamento ainda 'scheduled' só pode virar no_show.
    it.each(['in_progress', 'done'] as const)('recusa marcar como %s', async status => {
      mockGetDoc.mockResolvedValueOnce(snapCom({ startAtMs: expirado, status: 'scheduled' }));

      await expect(updateAppointmentStatus({ ...base, status })).rejects.toMatchObject({
        code: 'APPOINTMENT_EXPIRED',
      });
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('permite marcar como no_show', async () => {
      mockGetDoc.mockResolvedValueOnce(snapCom({ startAtMs: expirado, status: 'scheduled' }));

      await updateAppointmentStatus({ ...base, status: 'no_show' });

      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('permite concluir dentro da tolerância', async () => {
      mockGetDoc.mockResolvedValueOnce(snapCom({ startAtMs: recente, status: 'scheduled' }));

      await updateAppointmentStatus({ ...base, status: 'done' });

      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('não trava exatamente um milissegundo antes do limite', async () => {
      mockGetDoc.mockResolvedValueOnce(
        snapCom({ startAtMs: AGORA - NO_SHOW_GRACE_MS + 1, status: 'scheduled' }),
      );

      await updateAppointmentStatus({ ...base, status: 'done' });

      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    // Se o atendimento já começou, o cliente chegou — o tempo não desfaz isso.
    it('não trava quando o agendamento já saiu de scheduled', async () => {
      mockGetDoc.mockResolvedValueOnce(snapCom({ startAtMs: expirado, status: 'in_progress' }));

      await updateAppointmentStatus({ ...base, status: 'done' });

      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('não trava quando o documento não tem startAtMs', async () => {
      mockGetDoc.mockResolvedValueOnce(snapCom({ status: 'scheduled' }));

      await updateAppointmentStatus({ ...base, status: 'done' });

      expect(mockUpdateDoc).toHaveBeenCalled();
    });
  });

  it('funciona quando o documento não existe', async () => {
    mockGetDoc.mockResolvedValueOnce(snapCom(undefined));

    await expect(updateAppointmentStatus({ ...base, status: 'done' })).resolves.toBeUndefined();
    expect(mockUpdateDoc).toHaveBeenCalled();
  });

  // A escrita é disparada sem await de propósito: o Firestore aplica no cache
  // local na hora e sincroniza depois. Se o await ficasse, o botão travaria
  // com o aparelho offline.
  it('não propaga falha da escrita', async () => {
    mockGetDoc.mockResolvedValueOnce(
      snapCom({ startAtMs: AGORA + 3_600_000, status: 'scheduled' }),
    );
    mockUpdateDoc.mockRejectedValueOnce(new Error('offline'));

    await expect(updateAppointmentStatus({ ...base, status: 'done' })).resolves.toBeUndefined();
  });
});
