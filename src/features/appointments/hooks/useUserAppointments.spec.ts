const mockWatch = jest.fn();
jest.mock('../data/appointmentsRepo', () => ({
  watchUserAppointmentsWithFallback: (...a: unknown[]) => mockWatch(...a),
}));
jest.mock('@react-native-firebase/firestore', () => new Proxy({}, { get: () => jest.fn() }));
jest.mock('@react-native-firebase/auth', () => new Proxy({}, { get: () => jest.fn() }));

import { renderHook, act, waitFor } from '@testing-library/react-native';

import { useUserAppointments } from './useUserAppointments';
import type { UserAppointment } from '../domain/appointment.types';

const INICIO = 1_784_000_000_000;

const agendamento = (over: Partial<UserAppointment> = {}): UserAppointment =>
  ({
    id: 'appt-1',
    shopId: 'shop-1',
    startAtMs: INICIO,
    status: 'scheduled',
    vehicleType: 'Carro',
    carCategory: null,
    serviceLabel: 'Polimento',
    price: 300,
    ...over,
  } as UserAppointment);

/** Entrega uma lista ao onChange registrado. */
async function emitir(lista: UserAppointment[]) {
  const { onChange } = mockWatch.mock.calls[mockWatch.mock.calls.length - 1][0];
  await act(async () => {
    onChange(lista);
  });
}

/** Dispara o onError registrado. */
async function emitirErro() {
  const { onError } = mockWatch.mock.calls[mockWatch.mock.calls.length - 1][0];
  await act(async () => {
    onError(new Error('falhou'));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockWatch.mockReturnValue(jest.fn());
});

describe('useUserAppointments', () => {
  it('sem uid não assina nada e sai do carregamento', async () => {
    const { result } = renderHook(() => useUserAppointments({ uid: null }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
    expect(mockWatch).not.toHaveBeenCalled();
  });

  it('entrega os agendamentos recebidos', async () => {
    const { result } = renderHook(() => useUserAppointments({ uid: 'user-1' }));

    await emitir([agendamento()]);

    expect(result.current.items).toHaveLength(1);
    expect(result.current.loading).toBe(false);
  });

  it('ordena do mais recente para o mais antigo', async () => {
    // A lista do cliente mostra primeiro o que está mais próximo no tempo.
    const { result } = renderHook(() => useUserAppointments({ uid: 'user-1' }));

    await emitir([
      agendamento({ id: 'antigo', startAtMs: INICIO }),
      agendamento({ id: 'novo', startAtMs: INICIO + 86_400_000 }),
    ]);

    expect(result.current.items.map(i => i.id)).toEqual(['novo', 'antigo']);
  });

  describe('escopo por estética', () => {
    it('descarta agendamentos de outra loja', async () => {
      // Isolamento multi-tenant: a tela de um shop não pode listar o de outro.
      const { result } = renderHook(() => useUserAppointments({ uid: 'user-1', shopId: 'shop-1' }));

      await emitir([
        agendamento({ id: 'meu', shopId: 'shop-1' }),
        agendamento({ id: 'outro', shopId: 'shop-2' }),
      ]);

      expect(result.current.items.map(i => i.id)).toEqual(['meu']);
    });

    it('mantém agendamento antigo sem shopId', async () => {
      // Registros anteriores ao multi-tenant não têm o campo; some-los faria
      // o cliente perder o histórico.
      const { result } = renderHook(() => useUserAppointments({ uid: 'user-1', shopId: 'shop-1' }));

      await emitir([agendamento({ id: 'legado', shopId: null })]);

      expect(result.current.items.map(i => i.id)).toEqual(['legado']);
    });

    it('sem shopId não filtra por loja', async () => {
      const { result } = renderHook(() => useUserAppointments({ uid: 'user-1' }));

      await emitir([
        agendamento({ id: 'a', shopId: 'shop-1' }),
        agendamento({ id: 'b', shopId: 'shop-2' }),
      ]);

      expect(result.current.items).toHaveLength(2);
    });
  });

  describe('filtro por status', () => {
    it('mantém apenas os status pedidos', async () => {
      const { result } = renderHook(() =>
        useUserAppointments({ uid: 'user-1', statusIn: ['done', 'cancelled'] }),
      );

      await emitir([
        agendamento({ id: 'a', status: 'done' }),
        agendamento({ id: 'b', status: 'scheduled' }),
        agendamento({ id: 'c', status: 'cancelled' }),
      ]);

      expect(result.current.items.map(i => i.id).sort()).toEqual(['a', 'c']);
    });

    it('lista vazia de status não filtra nada', async () => {
      const { result } = renderHook(() => useUserAppointments({ uid: 'user-1', statusIn: [] }));

      await emitir([agendamento({ status: 'done' })]);

      expect(result.current.items).toHaveLength(1);
    });
  });

  it('erro limpa a lista e encerra o carregamento', async () => {
    const { result } = renderHook(() => useUserAppointments({ uid: 'user-1' }));

    await emitir([agendamento()]);
    await emitirErro();

    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('usa o limite padrão de 50 e respeita o informado', () => {
    renderHook(() => useUserAppointments({ uid: 'user-1' }));
    expect(mockWatch).toHaveBeenCalledWith(expect.objectContaining({ limitN: 50 }));

    renderHook(() => useUserAppointments({ uid: 'user-1', limitN: 10 }));
    expect(mockWatch).toHaveBeenCalledWith(expect.objectContaining({ limitN: 10 }));
  });

  it('mutate reassina para forçar releitura', async () => {
    const { result } = renderHook(() => useUserAppointments({ uid: 'user-1' }));
    expect(mockWatch).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.mutate();
    });

    expect(mockWatch).toHaveBeenCalledTimes(2);
  });

  it('cancela a assinatura ao desmontar', () => {
    const unsub = jest.fn();
    mockWatch.mockReturnValueOnce(unsub);

    const { unmount } = renderHook(() => useUserAppointments({ uid: 'user-1' }));
    unmount();

    expect(unsub).toHaveBeenCalled();
  });
});
