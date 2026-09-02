const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }),
}));

const mockShowError = jest.fn();
jest.mock('@shared/components/FeedbackProvider', () => ({
  useFeedback: () => ({ showError: mockShowError, showSuccess: jest.fn(), showConfirm: jest.fn() }),
}));

const mockShop = { shopId: 'shop-1' as string | null };
jest.mock('@features/shops', () => ({ useShop: () => mockShop }));

const mockBuscar = jest.fn();
jest.mock('../data/reportsRepo', () => ({
  buscarConcluidosDoMes: (...args: unknown[]) => mockBuscar(...args),
}));

// O gráfico vira um marcador que expõe os rótulos das barras: o que este teste
// verifica é QUAIS barras a tela manda desenhar, não como a lib as pinta.
jest.mock('react-native-gifted-charts', () => {
  const ReactLocal = require('react');
  const { Text } = require('react-native');
  return {
    BarChart: ({ data }: { data: { label: string; value: number }[] }) =>
      ReactLocal.createElement(
        Text,
        { testID: 'grafico' },
        data.map(d => `${d.label}:${d.value}`).join('|'),
      ),
  };
});

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import ReportsScreen from './ReportsScreen';
import type { AdminAppointment } from '@features/admin';

function agendamento(servico: string, preco: number | null = 80): AdminAppointment {
  return {
    id: Math.random().toString(36).slice(2),
    customerUid: 'c1',
    customerName: 'Cliente',
    vehicleType: 'Carro',
    carCategory: 'Hatch',
    serviceLabel: servico,
    price: preco,
    startAtMs: Date.now(),
    status: 'done',
  };
}

describe('ReportsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({
      doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask', 'performance'],
    });
    // 15/09/2026: um dia qualquer no meio do mês, longe da virada.
    jest.setSystemTime(new Date(2026, 8, 15, 10, 0, 0));
    mockShop.shopId = 'shop-1';
    mockBuscar.mockResolvedValue([
      agendamento('Lavagem', 80),
      agendamento('Lavagem', 80),
      agendamento('Polimento', 300),
    ]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('abre no mês corrente', async () => {
    render(<ReportsScreen />);

    expect(await screen.findByText('Setembro')).toBeTruthy();
  });

  it('busca os concluídos do mês da loja', async () => {
    render(<ReportsScreen />);

    await waitFor(() =>
      expect(mockBuscar).toHaveBeenCalledWith('shop-1', {
        inicioMs: new Date(2026, 8, 1).getTime(),
        fimMs: new Date(2026, 9, 1).getTime(),
      }),
    );
  });

  it('desenha as barras do mais feito ao menos feito', async () => {
    render(<ReportsScreen />);

    expect(await screen.findByTestId('grafico')).toHaveTextContent('Lavagem:2|Polimento:1');
  });

  it('mostra o total de serviços do mês', async () => {
    render(<ReportsScreen />);

    expect(await screen.findByText('3 serviços')).toBeTruthy();
  });

  it('usa o singular quando o mês teve um serviço só', async () => {
    mockBuscar.mockResolvedValue([agendamento('Lavagem')]);

    render(<ReportsScreen />);

    expect(await screen.findByText('1 serviço')).toBeTruthy();
  });

  it('lista o detalhe com quantidade e faturamento', async () => {
    render(<ReportsScreen />);

    expect(await screen.findByText('Polimento')).toBeTruthy();
    expect(screen.getByText('2x')).toBeTruthy();
    expect(screen.getByText('R$ 160,00')).toBeTruthy();
    expect(screen.getByText('R$ 300,00')).toBeTruthy();
  });

  it('volta um mês pela seta e busca o período novo', async () => {
    render(<ReportsScreen />);
    await screen.findByText('Setembro');

    fireEvent.press(screen.getByTestId('mes-anterior'));

    expect(await screen.findByText('Agosto')).toBeTruthy();
    await waitFor(() =>
      expect(mockBuscar).toHaveBeenLastCalledWith('shop-1', {
        inicioMs: new Date(2026, 7, 1).getTime(),
        fimMs: new Date(2026, 8, 1).getTime(),
      }),
    );
  });

  // Não existe futuro para relatar: no mês corrente a seta de avançar some.
  it('não oferece avançar no mês corrente', async () => {
    render(<ReportsScreen />);
    await screen.findByText('Setembro');

    expect(screen.queryByTestId('mes-seguinte')).toBeNull();
  });

  it('oferece avançar depois de voltar', async () => {
    render(<ReportsScreen />);
    await screen.findByText('Setembro');

    fireEvent.press(screen.getByTestId('mes-anterior'));
    await screen.findByText('Agosto');

    fireEvent.press(screen.getByTestId('mes-seguinte'));

    expect(await screen.findByText('Setembro')).toBeTruthy();
  });

  // `done` é marcado à mão pelo dono. Um gráfico em branco pareceria app
  // quebrado; o texto diz o que fazer.
  it('explica o vazio em vez de mostrar gráfico em branco', async () => {
    mockBuscar.mockResolvedValue([]);

    render(<ReportsScreen />);

    expect(await screen.findByText('Nenhum serviço concluído em Setembro')).toBeTruthy();
    expect(
      screen.getByText(
        'O relatório conta os agendamentos que você marcou como concluídos no painel.',
      ),
    ).toBeTruthy();
    expect(screen.queryByTestId('grafico')).toBeNull();
  });

  it('avisa quando a consulta falha e não deixa dado velho na tela', async () => {
    mockBuscar.mockRejectedValue(new Error('sem rede'));

    render(<ReportsScreen />);

    await waitFor(() =>
      expect(mockShowError).toHaveBeenCalledWith('Não foi possível carregar o relatório.'),
    );
    expect(screen.queryByTestId('grafico')).toBeNull();
  });

  it('não busca nada sem shopId', async () => {
    mockShop.shopId = null;

    render(<ReportsScreen />);

    await waitFor(() => expect(mockBuscar).not.toHaveBeenCalled());
  });

  it('volta ao tocar na seta do topo', async () => {
    render(<ReportsScreen />);
    await screen.findByText('Setembro');

    fireEvent.press(screen.getByTestId('voltar'));

    expect(mockGoBack).toHaveBeenCalled();
  });
});
