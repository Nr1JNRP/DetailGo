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

// A rosca vira um marcador que expõe o que foi mandado desenhar. O que este
// teste verifica é quais fatias a tela pede, não como a lib as pinta.
jest.mock('react-native-gifted-charts', () => {
  const ReactLocal = require('react');
  const { Text } = require('react-native');
  return {
    PieChart: ({ data }: { data: { value: number }[] }) =>
      ReactLocal.createElement(Text, { testID: 'rosca' }, data.map(d => d.value).join('|')),
  };
});

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react-native';

import ReportsScreen from './ReportsScreen';
import type { AdminAppointment } from '@features/admin';

type Opcoes = Partial<
  Pick<
    AdminAppointment,
    'serviceLabel' | 'price' | 'customerUid' | 'customerName' | 'vehicleType' | 'carCategory'
  >
>;

function agendamento(o: Opcoes = {}): AdminAppointment {
  return {
    id: Math.random().toString(36).slice(2),
    customerUid: 'c1',
    customerName: 'Ana Souza',
    vehicleType: 'Carro',
    carCategory: 'SUV',
    serviceLabel: 'Lavagem Técnica',
    price: 90,
    startAtMs: new Date(2026, 8, 10, 9, 0, 0).getTime(),
    status: 'done',
    ...o,
  };
}

/** Três lavagens de R$ 90 e um polimento de R$ 350, dois clientes. */
function mesTipico(): AdminAppointment[] {
  return [
    agendamento({ customerUid: 'c1', customerName: 'Ana Souza' }),
    agendamento({ customerUid: 'c1', customerName: 'Ana Souza' }),
    agendamento({ customerUid: 'c2', customerName: 'Carlos Lima' }),
    agendamento({
      serviceLabel: 'Polimento Comercial',
      price: 350,
      customerUid: 'c2',
      customerName: 'Carlos Lima',
      carCategory: 'Sedan',
    }),
  ];
}

describe('ReportsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({
      doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask', 'performance'],
    });
    jest.setSystemTime(new Date(2026, 8, 15, 10, 0, 0));
    mockShop.shopId = 'shop-1';
    mockBuscar.mockResolvedValue(mesTipico());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('período', () => {
    it('abre no mês corrente e busca o período dele', async () => {
      render(<ReportsScreen />);

      expect(await screen.findByText('Setembro')).toBeTruthy();
      expect(mockBuscar).toHaveBeenCalledWith('shop-1', {
        inicioMs: new Date(2026, 8, 1).getTime(),
        fimMs: new Date(2026, 9, 1).getTime(),
      });
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

    // Não existe futuro para relatar.
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
  });

  describe('resumo', () => {
    it('mostra serviços, faturamento e ticket médio', async () => {
      render(<ReportsScreen />);

      expect(await screen.findByText('4')).toBeTruthy();
      expect(screen.getByText('R$ 620')).toBeTruthy();
      expect(screen.getByText('R$ 155')).toBeTruthy();
    });
  });

  describe('destaques', () => {
    it('responde as três perguntas do dono', async () => {
      render(<ReportsScreen />);

      const destaques = within(await screen.findByTestId('destaques'));

      expect(destaques.getByText('Serviço campeão')).toBeTruthy();
      expect(destaques.getByText('Lavagem Técnica')).toBeTruthy();

      expect(destaques.getByText('Veículo mais atendido')).toBeTruthy();
      expect(destaques.getByText('SUV')).toBeTruthy();

      expect(destaques.getByText('Cliente do mês')).toBeTruthy();
      expect(destaques.getByText('Carlos Lima')).toBeTruthy();
    });
  });

  describe('serviços realizados', () => {
    it('desenha uma fatia por serviço, do maior ao menor', async () => {
      render(<ReportsScreen />);

      expect(await screen.findByTestId('rosca')).toHaveTextContent('3|1');
    });

    it('mostra o nome inteiro e a porcentagem na legenda', async () => {
      render(<ReportsScreen />);

      await screen.findByTestId('rosca');
      expect(screen.getByText('75%')).toBeTruthy();
      expect(screen.getByText('25%')).toBeTruthy();
    });
  });

  describe('o que mais rende', () => {
    // O serviço que enche a agenda não é o que paga as contas: 1 polimento
    // rende mais que 3 lavagens.
    it('ordena por faturamento, não por quantidade', async () => {
      render(<ReportsScreen />);

      const barras = within(await screen.findByTestId('barras-faturamento'));

      expect(barras.getByText('R$ 350,00')).toBeTruthy();
      expect(barras.getByText('R$ 270,00')).toBeTruthy();
    });

    it('explica a diferença em uma frase', async () => {
      render(<ReportsScreen />);

      expect(
        await screen.findByText(
          'O Polimento Comercial é 25% do que você faz e traz 56% do faturamento.',
        ),
      ).toBeTruthy();
    });

    it('não mostra frase quando o mais feito também é o que mais rende', async () => {
      mockBuscar.mockResolvedValue([
        agendamento({ serviceLabel: 'Lavagem', price: 500 }),
        agendamento({ serviceLabel: 'Lavagem', price: 500 }),
        agendamento({ serviceLabel: 'Cera', price: 20 }),
      ]);

      render(<ReportsScreen />);

      await screen.findByTestId('barras-faturamento');
      expect(screen.queryByText(/traz .* do faturamento/)).toBeNull();
    });
  });

  describe('veículos', () => {
    it('lista os veículos atendidos', async () => {
      render(<ReportsScreen />);

      const barras = within(await screen.findByTestId('barras-veiculos'));

      expect(barras.getByText('SUV')).toBeTruthy();
      expect(barras.getByText('Sedan')).toBeTruthy();
    });

    it('mostra moto como faixa própria', async () => {
      mockBuscar.mockResolvedValue([
        agendamento({ vehicleType: 'Moto', carCategory: null }),
        agendamento({ vehicleType: 'Carro', carCategory: 'SUV' }),
      ]);

      render(<ReportsScreen />);

      const barras = within(await screen.findByTestId('barras-veiculos'));
      expect(barras.getByText('Moto')).toBeTruthy();
    });
  });

  describe('melhores clientes', () => {
    it('mostra o pódio com visitas e total gasto', async () => {
      render(<ReportsScreen />);

      expect(await screen.findByText('Melhores clientes')).toBeTruthy();
      expect(screen.getByText('R$ 440,00')).toBeTruthy();
      expect(screen.getByText('R$ 180,00')).toBeTruthy();
      expect(screen.getAllByText('2 visitas')).toHaveLength(2);
    });

    it('usa singular para quem veio uma vez', async () => {
      mockBuscar.mockResolvedValue([agendamento()]);

      render(<ReportsScreen />);

      expect(await screen.findByText('1 visita')).toBeTruthy();
    });
  });

  describe('estados', () => {
    // `done` é marcado à mão pelo dono. Um gráfico em branco pareceria app
    // quebrado; o texto diz o que fazer.
    it('explica o mês vazio em vez de desenhar nada', async () => {
      mockBuscar.mockResolvedValue([]);

      render(<ReportsScreen />);

      expect(await screen.findByText('Nenhum serviço concluído em Setembro')).toBeTruthy();
      expect(
        screen.getByText(
          'O relatório conta os agendamentos que você marcou como concluídos no painel.',
        ),
      ).toBeTruthy();
      expect(screen.queryByTestId('rosca')).toBeNull();
      expect(screen.queryByTestId('destaques')).toBeNull();
    });

    it('avisa quando a consulta falha e não deixa dado velho na tela', async () => {
      mockBuscar.mockRejectedValue(new Error('sem rede'));

      render(<ReportsScreen />);

      await waitFor(() =>
        expect(mockShowError).toHaveBeenCalledWith('Não foi possível carregar o relatório.'),
      );
      expect(screen.queryByTestId('rosca')).toBeNull();
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
});
