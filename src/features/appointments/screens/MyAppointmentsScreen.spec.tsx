jest.mock('@react-native-firebase/firestore', () => new Proxy({}, { get: () => jest.fn() }));

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: { uid: 'user-1' } })),
}));

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useIsFocused: () => true,
}));

const mockShowSuccess = jest.fn();
const mockShowError = jest.fn();
const mockShowConfirm = jest.fn();
const mockFeedbackApi = {
  showSuccess: mockShowSuccess,
  showError: mockShowError,
  showConfirm: mockShowConfirm,
};
jest.mock('@shared/components/FeedbackProvider', () => ({ useFeedback: () => mockFeedbackApi }));

const mockShopApi = { shopId: 'shop-1' as string | null };
jest.mock('@features/shops', () => ({ useShop: () => mockShopApi }));

const mockMutate = jest.fn();
const mockUseUserAppointments = jest.fn();
jest.mock('../hooks/useUserAppointments', () => ({
  useUserAppointments: () => mockUseUserAppointments(),
}));

const mockPullRefreshApi = { refreshControl: undefined, tick: 0 };
jest.mock('@shared/hooks/usePullRefresh', () => ({ usePullRefresh: () => mockPullRefreshApi }));

const mockCancelAppointment = jest.fn();
// getAppointmentRules é regra pura de domínio — vale usar a real, para o teste
// exercitar a decisão de verdade em vez de uma imitação.
jest.mock('../services/appointment.service', () => ({
  cancelAppointment: (...a: unknown[]) => mockCancelAppointment(...a),
  getAppointmentRules: jest.requireActual('../services/appointment.service').getAppointmentRules,
}));

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

import MyAppointmentsScreen from './MyAppointmentsScreen';
import type { UserAppointment } from '../domain/appointment.types';

const AGORA = new Date(2026, 6, 15, 12, 0, 0).getTime();
const HORA = 60 * 60 * 1000;
const TOLERANCIA = 15 * 60 * 1000;

const agendamento = (over: Partial<UserAppointment> = {}): UserAppointment =>
  ({
    id: 'appt-1',
    shopId: 'shop-1',
    startAtMs: AGORA + 24 * HORA,
    endAtMs: AGORA + 25 * HORA,
    durationMin: 60,
    status: 'scheduled',
    vehicleType: 'Carro',
    carCategory: 'SUV',
    serviceLabel: 'Polimento',
    price: 300,
    ...over,
  } as UserAppointment);

function renderizar(items: UserAppointment[] = [], loading = false) {
  mockUseUserAppointments.mockReturnValue({ items, loading, mutate: mockMutate });
  return render(<MyAppointmentsScreen />);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockShopApi.shopId = 'shop-1';
  mockCancelAppointment.mockResolvedValue({ ok: true, message: 'Agendamento cancelado!' });
  jest.useFakeTimers({
    now: AGORA,
    doNotFake: [
      'nextTick',
      'setImmediate',
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'queueMicrotask',
      'performance',
    ],
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('MyAppointmentsScreen', () => {
  it('lista os agendamentos ativos', () => {
    renderizar([agendamento()]);

    expect(screen.getByText('Polimento')).toBeTruthy();
  });

  it('leva para o agendamento novo', () => {
    renderizar([]);

    fireEvent.press(screen.getByText(/agendar/i));

    expect(mockNavigate).toHaveBeenCalledWith('Appointment', {});
  });

  // Passado o horário mais a tolerância, o agendamento sai daqui e vira
  // "Não realizado" no histórico — senão ficaria preso na lista de ativos.
  it('remove agendamento vencido da lista', () => {
    renderizar([agendamento({ status: 'scheduled', startAtMs: AGORA - TOLERANCIA - 60_000 })]);

    expect(screen.queryByText('Polimento')).toBeNull();
  });

  it('mantém agendamento dentro da tolerância', () => {
    renderizar([agendamento({ status: 'scheduled', startAtMs: AGORA - 60_000 })]);

    expect(screen.getByText('Polimento')).toBeTruthy();
  });

  it('mantém em andamento mesmo com horário vencido', () => {
    // O cliente chegou e o serviço começou: o relógio não desfaz isso.
    renderizar([agendamento({ status: 'in_progress', startAtMs: AGORA - 5 * HORA })]);

    expect(screen.getByText('Polimento')).toBeTruthy();
  });

  describe('cancelamento', () => {
    /** Executa o onConfirm entregue ao showConfirm. */
    async function confirmar() {
      const { onConfirm } = mockShowConfirm.mock.calls[0][0];
      await act(async () => {
        await onConfirm();
      });
    }

    it('pede confirmação antes de cancelar', () => {
      renderizar([agendamento()]);

      fireEvent.press(screen.getByText(/cancelar/i));

      expect(mockShowConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Cancelar agendamento', destructive: true }),
      );
      expect(mockCancelAppointment).not.toHaveBeenCalled();
    });

    it('cancela ao confirmar e recarrega a lista', async () => {
      renderizar([agendamento()]);

      fireEvent.press(screen.getByText(/cancelar/i));
      await confirmar();

      expect(mockCancelAppointment).toHaveBeenCalledWith('appt-1', 'user-1', 'shop-1');
      expect(mockShowSuccess).toHaveBeenCalledWith('Agendamento cancelado!');
      expect(mockMutate).toHaveBeenCalled();
    });

    it('mostra o motivo quando o serviço recusa', async () => {
      mockCancelAppointment.mockResolvedValueOnce({ ok: false, message: 'Permissão negada.' });
      renderizar([agendamento()]);

      fireEvent.press(screen.getByText(/cancelar/i));
      await confirmar();

      expect(mockShowError).toHaveBeenCalledWith('Permissão negada.');
      expect(mockMutate).not.toHaveBeenCalled();
    });

    // A regra vem do domínio: atendimento em andamento não se cancela pelo
    // app. A tela desabilita o botão em vez de deixar tocar e recusar depois.
    it('não deixa cancelar atendimento em andamento', () => {
      renderizar([agendamento({ status: 'in_progress' })]);

      fireEvent.press(screen.getByText(/cancelar/i));

      expect(mockShowConfirm).not.toHaveBeenCalled();
      expect(mockCancelAppointment).not.toHaveBeenCalled();
    });
  });

  describe('dados incompletos', () => {
    it('calcula a duração pelo fim quando ela não foi gravada', () => {
      renderizar([
        agendamento({ durationMin: undefined, endAtMs: AGORA + 24 * HORA + 90 * 60_000 }),
      ]);

      expect(screen.getByText(/90 min/)).toBeTruthy();
    });

    it('sem duração e sem fim mostra traços', () => {
      renderizar([agendamento({ durationMin: undefined, endAtMs: undefined })]);

      expect(screen.getByText(/--/)).toBeTruthy();
    });

    it('carro sem categoria mostra o tipo', () => {
      renderizar([agendamento({ vehicleType: 'Carro', carCategory: null })]);

      expect(screen.getByText(/Carro/)).toBeTruthy();
    });

    it('moto mostra o tipo do veículo', () => {
      renderizar([agendamento({ vehicleType: 'Moto', carCategory: null })]);

      expect(screen.getByText(/Moto/)).toBeTruthy();
    });

    it('separa vários agendamentos na lista', () => {
      renderizar([
        agendamento({ id: 'a', serviceLabel: 'Polimento' }),
        agendamento({ id: 'b', serviceLabel: 'Enceramento' }),
      ]);

      expect(screen.getByText('Polimento')).toBeTruthy();
      expect(screen.getByText('Enceramento')).toBeTruthy();
    });
  });

  it('mostra carregamento enquanto não há sessão', () => {
    const { getAuth } = require('@react-native-firebase/auth');
    getAuth.mockReturnValue({ currentUser: null });

    try {
      renderizar();

      expect(
        screen.UNSAFE_getAllByType(require('react-native').ActivityIndicator).length,
      ).toBeGreaterThan(0);
    } finally {
      getAuth.mockReturnValue({ currentUser: { uid: 'user-1' } });
    }
  });

  it('volta ao tocar na seta', () => {
    renderizar();

    fireEvent.press(screen.UNSAFE_getAllByType(require('react-native').TouchableOpacity)[0]);

    expect(mockGoBack).toHaveBeenCalled();
  });
});
