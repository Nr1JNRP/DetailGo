jest.mock('@react-native-firebase/firestore', () => new Proxy({}, { get: () => jest.fn() }));

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: { uid: 'user-1' } })),
}));

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }),
  // O FadeInUp usado nas linhas depende disto para animar só em foco.
  useIsFocused: () => true,
}));

// Hooks precisam devolver referência estável entre renders.
const mockUseUserAppointments = jest.fn();
jest.mock('../hooks/useUserAppointments', () => ({
  useUserAppointments: () => mockUseUserAppointments(),
}));

const mockPullRefreshApi = { refreshControl: undefined, tick: 0 };
jest.mock('@shared/hooks/usePullRefresh', () => ({ usePullRefresh: () => mockPullRefreshApi }));

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import HistoryScreen from './HistoryScreen';
import type { UserAppointment } from '../domain/appointment.types';

const AGORA = new Date(2026, 6, 15, 12, 0, 0).getTime();
const HORA = 60 * 60 * 1000;
const TOLERANCIA = 15 * 60 * 1000;

const agendamento = (over: Partial<UserAppointment> = {}): UserAppointment =>
  ({
    id: 'appt-1',
    shopId: 'shop-1',
    startAtMs: AGORA - 48 * HORA,
    endAtMs: AGORA - 47 * HORA,
    durationMin: 60,
    status: 'done',
    vehicleType: 'Carro',
    carCategory: 'SUV',
    serviceLabel: 'Polimento',
    price: 300,
    ...over,
  } as UserAppointment);

function renderizar(items: UserAppointment[] = [], loading = false) {
  mockUseUserAppointments.mockReturnValue({ items, loading, mutate: jest.fn() });
  return render(<HistoryScreen />);
}

beforeEach(() => {
  jest.clearAllMocks();
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

describe('HistoryScreen', () => {
  it('mostra o título e os filtros', () => {
    renderizar();

    expect(screen.getByText('Histórico')).toBeTruthy();
    ['Todos', 'Concluídos', 'Cancelados', 'Não realizados'].forEach(f => {
      expect(screen.getByText(f)).toBeTruthy();
    });
  });

  it('mostra o estado vazio', () => {
    renderizar();

    expect(screen.getByText('Nenhum registro')).toBeTruthy();
  });

  it('mostra carregamento enquanto não há sessão', () => {
    const { getAuth } = require('@react-native-firebase/auth');
    getAuth.mockReturnValue({ currentUser: null });

    try {
      renderizar();

      expect(screen.queryByText('Histórico')).toBeNull();
      expect(screen.UNSAFE_getAllByType(require('react-native').ActivityIndicator).length).toBe(1);
    } finally {
      getAuth.mockReturnValue({ currentUser: { uid: 'user-1' } });
    }
  });

  it('volta ao tocar na seta', () => {
    renderizar();

    fireEvent.press(screen.UNSAFE_getAllByType(require('react-native').TouchableOpacity)[0]);

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('lista o serviço concluído com preço e duração', () => {
    renderizar([agendamento()]);

    expect(screen.getByText('Polimento')).toBeTruthy();
    expect(screen.getByText(/R\$300/)).toBeTruthy();
    expect(screen.getByText(/60min/)).toBeTruthy();
  });

  it('agrupa os registros por mês', () => {
    renderizar([agendamento()]);

    // 15/07/2026 menos 48h continua em julho.
    expect(screen.getByText('Julho 2026')).toBeTruthy();
  });

  // O histórico do cliente é o que já terminou. Agendamento futuro fica na
  // tela "Meus agendamentos".
  it('não lista agendamento ainda por vir', () => {
    renderizar([agendamento({ status: 'scheduled', startAtMs: AGORA + 24 * HORA })]);

    expect(screen.getByText('Nenhum registro')).toBeTruthy();
  });

  // Um agendamento que passou do horário mais a tolerância já conta como não
  // realizado para o cliente, mesmo antes do dono dar baixa.
  it('trata agendamento vencido como não realizado', () => {
    renderizar([agendamento({ status: 'scheduled', startAtMs: AGORA - TOLERANCIA - 60_000 })]);

    expect(screen.getByText('Polimento')).toBeTruthy();
    expect(screen.getByText('Não realizado')).toBeTruthy();
  });

  it('não considera vencido quem ainda está na tolerância', () => {
    renderizar([agendamento({ status: 'scheduled', startAtMs: AGORA - 60_000 })]);

    expect(screen.getByText('Nenhum registro')).toBeTruthy();
  });

  describe('filtros', () => {
    const registros = [
      agendamento({ id: 'a', status: 'done', serviceLabel: 'Concluído A' }),
      agendamento({ id: 'b', status: 'cancelled', serviceLabel: 'Cancelado B' }),
      agendamento({
        id: 'c',
        status: 'scheduled',
        startAtMs: AGORA - TOLERANCIA - 60_000,
        serviceLabel: 'Vencido C',
      }),
    ];

    it('Todos mostra os três', () => {
      renderizar(registros);

      expect(screen.getByText('Concluído A')).toBeTruthy();
      expect(screen.getByText('Cancelado B')).toBeTruthy();
      expect(screen.getByText('Vencido C')).toBeTruthy();
    });

    it.each([
      ['Concluídos', 'Concluído A'],
      ['Cancelados', 'Cancelado B'],
      ['Não realizados', 'Vencido C'],
    ])('%s mostra apenas %s', (filtro, esperado) => {
      renderizar(registros);

      fireEvent.press(screen.getByText(filtro));

      expect(screen.getByText(esperado)).toBeTruthy();
      const outros = ['Concluído A', 'Cancelado B', 'Vencido C'].filter(s => s !== esperado);
      outros.forEach(s => expect(screen.queryByText(s)).toBeNull());
    });

    it('filtro sem resultado explica o motivo', () => {
      renderizar([agendamento({ status: 'done' })]);

      fireEvent.press(screen.getByText('Cancelados'));

      expect(screen.getByText('Nenhum registro para este filtro.')).toBeTruthy();
    });
  });

  describe('dados incompletos do registro', () => {
    it('sem preço mostra traços', () => {
      renderizar([agendamento({ price: null })]);

      expect(screen.getByText('--')).toBeTruthy();
    });

    it('calcula a duração pelo fim quando ela não foi gravada', () => {
      renderizar([
        agendamento({ durationMin: undefined, endAtMs: agendamento().startAtMs + 90 * 60_000 }),
      ]);

      expect(screen.getByText(/90min/)).toBeTruthy();
    });

    it('sem duração e sem fim mostra traços', () => {
      // A duração aparece junto do veículo no mesmo texto.
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
  });
});
