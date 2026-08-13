const mockSetDoc = jest.fn(async () => undefined);
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  doc: jest.fn((_db: unknown, ...path: unknown[]) => ({ path: path.join('/') })),
  setDoc: (...a: unknown[]) => mockSetDoc(...(a as [])),
  collection: jest.fn(() => ({})),
  getDoc: jest.fn(async () => ({ exists: () => false, data: () => ({}) })),
  getDocs: jest.fn(async () => ({ docs: [] })),
  onSnapshot: jest.fn(() => jest.fn()),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
  serverTimestamp: jest.fn(() => 'ts'),
}));

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: { uid: 'user-1' } })),
}));

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate, replace: mockReplace }),
  useIsFocused: () => true,
  useRoute: () => ({ params: {} }),
}));

const mockShowError = jest.fn();
const mockFeedbackApi = {
  showError: mockShowError,
  showSuccess: jest.fn(),
  showConfirm: jest.fn(),
};
jest.mock('@shared/components/FeedbackProvider', () => ({ useFeedback: () => mockFeedbackApi }));

const mockShopApi = { shop: { name: 'Tirac Auto Detail' }, shopId: 'shop-1' as string | null };
const mockServicesApi = { items: [] as unknown[], loading: false };
jest.mock('@features/shops', () => ({
  useShop: () => mockShopApi,
  useShopServices: () => mockServicesApi,
  getShopServiceIcon: () => () => null,
  // Regra pura de compatibilidade veículo/serviço — vale usar a real.
  serviceSupportsVehicle: jest.requireActual('@features/shops/services/shopServices.service')
    .serviceSupportsVehicle,
}));

const mockGetAvailableSlots = jest.fn();
const mockCreateAppointment = jest.fn();
jest.mock('@features/appointments', () => {
  const constantes = jest.requireActual('../domain/appointment.constants');
  return {
    getAvailableSlotsForDay: (...a: unknown[]) => mockGetAvailableSlots(...a),
    createAppointmentWithCapacityCheck: (...a: unknown[]) => mockCreateAppointment(...a),
    CAR_CATEGORIES: constantes.CAR_CATEGORIES,
    VEHICLE_TYPES: constantes.VEHICLE_TYPES,
  };
});

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

import React from 'react';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react-native';

import AppointmentScreen from './AppointmentScreen';

const AGORA = new Date(2026, 6, 15, 9, 0, 0);
const HORA = 60 * 60 * 1000;

const servico = (over: Record<string, unknown> = {}) => ({
  id: 'svc-1',
  name: 'Polimento',
  title: 'Polimento',
  durationMin: 90,
  price: 300,
  active: true,
  vehicleTypes: ['Carro', 'Moto'],
  carCategories: ['Hatch', 'Sedan', 'SUV', 'Picape cabine dupla'],
  includes: [],
  recommendedFor: [],
  description: null,
  note: null,
  ...over,
});

const slot = (hora: number) => ({
  startAtMs: AGORA.getTime() + hora * HORA,
  endAtMs: AGORA.getTime() + (hora + 1.5) * HORA,
  durationMin: 90,
});

/** Renderiza e espera a busca inicial de horários terminar. */
async function renderizar(servicos: unknown[] = [servico()]) {
  mockServicesApi.items = servicos;
  const utils = render(<AppointmentScreen />);
  await act(async () => {
    await Promise.resolve();
  });
  return utils;
}

/**
 * O seletor é um Modal local da tela: as opções só existem na árvore quando
 * ele está aberto. Localizamos pelo título do modal.
 */
function modalAberto(titulo: string) {
  const RN = require('react-native');
  return screen
    .UNSAFE_getAllByType(RN.Modal)
    .find(m => m.props.visible && within(m).queryByText(titulo));
}

/** Abre um dos seletores tocando no campo. */
async function abrirSeletor(testID: 'service-selector' | 'category-selector') {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
}

/** Escolhe uma opção no seletor aberto, como o usuário faria. */
async function escolherNoModal(titulo: string, opcao: string) {
  const modal = modalAberto(titulo);
  await act(async () => {
    fireEvent.press(within(modal!).getByText(opcao));
  });
}

/** Escolhe um serviço: abre o seletor e toca na opção. */
async function escolherServico(nome: string) {
  await abrirSeletor('service-selector');
  await escolherNoModal('Serviço', nome);
}

/** Escolhe a categoria do carro. */
async function escolherCategoria(nome: string) {
  await abrirSeletor('category-selector');
  await escolherNoModal('Categoria', nome);
}

/** Opções listadas por um seletor aberto (fora o próprio título). */
function opcoesDoModal(titulo: string): string[] {
  const modal = modalAberto(titulo);
  if (!modal) return [];
  return within(modal)
    .UNSAFE_getAllByType(require('react-native').Text)
    .map(t => String(t.props.children))
    .filter(t => t !== titulo);
}

/** Nomes de serviço oferecidos no seletor. */
async function servicosOferecidos(): Promise<string[]> {
  await abrirSeletor('service-selector');
  return opcoesDoModal('Serviço');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockShopApi.shopId = 'shop-1';
  mockServicesApi.loading = false;
  mockGetAvailableSlots.mockResolvedValue([slot(3), slot(5)]);
  mockCreateAppointment.mockResolvedValue({ id: 'appt-novo' });
  jest.useFakeTimers({
    now: AGORA.getTime(),
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

describe('AppointmentScreen', () => {
  it('mostra o título e os serviços da estética', async () => {
    await renderizar();

    expect(screen.getByText('Agendar')).toBeTruthy();
    expect(await servicosOferecidos()).toContain('Polimento');
  });

  it('volta ao tocar na seta', async () => {
    await renderizar();

    fireEvent.press(screen.UNSAFE_getAllByType(require('react-native').TouchableOpacity)[0]);

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('mostra carregamento enquanto não há sessão', async () => {
    const { getAuth } = require('@react-native-firebase/auth');
    getAuth.mockReturnValue({ currentUser: null });

    try {
      render(<AppointmentScreen />);

      expect(screen.queryByText('Agendar')).toBeNull();
    } finally {
      getAuth.mockReturnValue({ currentUser: { uid: 'user-1' } });
    }
  });

  describe('escolha do serviço', () => {
    it('busca os horários do serviço escolhido', async () => {
      await renderizar();

      await escolherServico('Polimento');

      expect(mockGetAvailableSlots).toHaveBeenCalledWith(expect.any(Date), 90, 'shop-1');
    });

    it('avisa quando a busca de horários falha', async () => {
      mockGetAvailableSlots.mockRejectedValue(new Error('offline'));

      await renderizar();
      await escolherServico('Polimento');

      expect(mockShowError).toHaveBeenCalledWith('Não foi possível carregar os horários.');
    });

    // Serviço que não atende o veículo escolhido não deve ser oferecido.
    it('oferece só os serviços compatíveis com o veículo', async () => {
      await renderizar([
        servico({ id: 'a', name: 'Polimento', vehicleTypes: ['Carro'] }),
        servico({ id: 'b', name: 'Lavagem de moto', vehicleTypes: ['Moto'] }),
      ]);

      expect(await servicosOferecidos()).toEqual(['Polimento']);
    });

    it('trocar o veículo troca os serviços oferecidos', async () => {
      await renderizar([
        servico({ id: 'a', name: 'Polimento', vehicleTypes: ['Carro'] }),
        servico({ id: 'b', name: 'Lavagem de moto', vehicleTypes: ['Moto'] }),
      ]);

      await act(async () => {
        fireEvent.press(screen.getByText('Moto'));
      });

      expect(await servicosOferecidos()).toEqual(['Lavagem de moto']);
    });

    // Categoria de carro também filtra: um serviço só de Hatch não aparece
    // para quem escolheu SUV.
    it('a categoria do carro também restringe a lista', async () => {
      await renderizar([
        servico({ id: 'a', name: 'Só hatch', vehicleTypes: ['Carro'], carCategories: ['Hatch'] }),
        servico({ id: 'b', name: 'Todos', vehicleTypes: ['Carro'] }),
      ]);

      expect(await servicosOferecidos()).toEqual(['Só hatch', 'Todos']);

      await escolherCategoria('SUV');

      expect(await servicosOferecidos()).toEqual(['Todos']);
    });

    it('a categoria oferece só o que os serviços atendem', async () => {
      await renderizar([servico({ vehicleTypes: ['Carro'], carCategories: ['Hatch', 'SUV'] })]);

      await abrirSeletor('category-selector');

      expect(opcoesDoModal('Categoria')).toEqual(['Hatch', 'SUV']);
    });
  });

  describe('validações antes de confirmar', () => {
    /** Toca no botão de confirmar. */
    async function confirmar() {
      await act(async () => {
        fireEvent.press(screen.getByText(/Confirmar|Selecione os dados/));
      });
    }

    // Sem serviço e sem horário o botão fica desabilitado: a tela impede o
    // toque em vez de deixar tocar e recusar depois.
    it('mantém o botão bloqueado sem serviço', async () => {
      await renderizar();

      expect(screen.getByText('Selecione os dados')).toBeTruthy();
      await confirmar();

      expect(mockCreateAppointment).not.toHaveBeenCalled();
    });

    it('mantém o botão bloqueado sem horário', async () => {
      await renderizar();
      await escolherServico('Polimento');

      expect(screen.getByText('Selecione os dados')).toBeTruthy();
      await confirmar();

      expect(mockCreateAppointment).not.toHaveBeenCalled();
    });

    // Serviço de carro sem categoria nenhuma não atende ninguém: some da
    // lista em vez de deixar agendar e falhar depois.
    it('não oferece serviço de carro sem categoria', async () => {
      await renderizar([servico({ vehicleTypes: ['Carro'], carCategories: [] })]);

      expect(await servicosOferecidos()).toEqual([]);
      await confirmar();

      expect(mockCreateAppointment).not.toHaveBeenCalled();
    });
  });

  describe('confirmação do agendamento', () => {
    /** Escolhe serviço e primeiro horário disponível. */
    async function escolherServicoEHorario() {
      await escolherServico('Polimento');
      await waitFor(() => expect(mockGetAvailableSlots).toHaveBeenCalled());
      const horarios = screen.getAllByText(/^\d{2}:\d{2}$/);
      await act(async () => {
        fireEvent.press(horarios[0]);
      });
    }

    it('cria o agendamento com os dados escolhidos', async () => {
      await renderizar();
      await escolherServicoEHorario();

      await act(async () => {
        fireEvent.press(screen.getByText(/Confirmar/));
      });

      expect(mockCreateAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          shopId: 'shop-1',
          customerUid: 'user-1',
          serviceLabel: 'Polimento',
          durationMin: 90,
          vehicleType: 'Carro',
        }),
      );
    });

    it('guarda a estética como a última usada', async () => {
      await renderizar();
      await escolherServicoEHorario();

      await act(async () => {
        fireEvent.press(screen.getByText(/Confirmar/));
      });

      // Assim o app já abre no shop certo da próxima vez.
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        { shopId: 'shop-1' },
        { merge: true },
      );
    });

    it('horário tomado no meio do caminho pede outro e recarrega a lista', async () => {
      mockCreateAppointment.mockRejectedValueOnce({ code: 'SLOT_FULL' });

      await renderizar();
      await escolherServicoEHorario();
      mockGetAvailableSlots.mockClear();

      await act(async () => {
        fireEvent.press(screen.getByText(/Confirmar/));
      });

      expect(mockShowError).toHaveBeenCalledWith(
        'Selecione outro horário.',
        expect.objectContaining({ title: 'Horário indisponível' }),
      );
      expect(mockGetAvailableSlots).toHaveBeenCalled();
    });

    it('explica o conflito com outra estética no mesmo dia', async () => {
      mockCreateAppointment.mockRejectedValueOnce({ code: 'CUSTOMER_DAILY_SHOP_CONFLICT' });

      await renderizar();
      await escolherServicoEHorario();

      await act(async () => {
        fireEvent.press(screen.getByText(/Confirmar/));
      });

      expect(mockShowError).toHaveBeenCalledWith(
        expect.stringMatching(/outra est(é|e)tica nesta data/i),
        expect.objectContaining({ title: 'Agendamento em outra estética' }),
      );
    });

    it('mensagem genérica nos demais erros', async () => {
      mockCreateAppointment.mockRejectedValueOnce(new Error('offline'));

      await renderizar();
      await escolherServicoEHorario();

      await act(async () => {
        fireEvent.press(screen.getByText(/Confirmar/));
      });

      expect(mockShowError).toHaveBeenCalledWith('Não foi possível realizar o agendamento.');
    });

    it('confirma e leva para o painel pelo modal de sucesso', async () => {
      await renderizar();
      await escolherServicoEHorario();

      await act(async () => {
        fireEvent.press(screen.getByText(/Confirmar/));
      });
      expect(screen.getByText('Agendamento confirmado!')).toBeTruthy();

      await act(async () => {
        fireEvent.press(screen.getByText('Ver agendamentos'));
      });

      expect(mockReplace).toHaveBeenCalledWith('Dashboard');
    });
  });

  // O cliente precisa saber em qual estética está agendando.
  describe('estética no topo', () => {
    const comShop = (data: Record<string, unknown>) => {
      const { getDoc } = require('@react-native-firebase/firestore');
      getDoc.mockResolvedValueOnce({ exists: () => true, data: () => data });
    };

    it('mostra nome e endereço da estética', async () => {
      comShop({ name: 'Tirac Auto Detail', location: { address: 'Rua A, 10', city: 'Recife' } });

      await renderizar();

      expect(screen.getByText('Tirac Auto Detail')).toBeTruthy();
      expect(screen.getByText('Rua A, 10 · Recife')).toBeTruthy();
    });

    it('sem endereço mostra só o nome', async () => {
      comShop({ name: 'Tirac Auto Detail' });

      await renderizar();

      expect(screen.getByText('Tirac Auto Detail')).toBeTruthy();
      expect(screen.queryByText(/Rua |Recife/)).toBeNull();
    });

    it('shop sem nome cai no rótulo genérico', async () => {
      comShop({ location: { city: 'Recife' } });

      await renderizar();

      expect(screen.getByText('Estética')).toBeTruthy();
    });

    it('sem estética escolhida não mostra o cabeçalho', async () => {
      mockShopApi.shopId = null;

      await renderizar();

      expect(screen.queryByText('Tirac Auto Detail')).toBeNull();
    });
  });

  describe('detalhes do serviço', () => {
    /** Escolhe o serviço e abre o cartão de detalhes. */
    async function abrirDetalhes(over: Record<string, unknown> = {}) {
      await renderizar([servico(over)]);
      await escolherServico('Polimento');
      await act(async () => {
        fireEvent.press(screen.getByText('Detalhes'));
      });
    }

    it('lista o que está incluso no serviço', async () => {
      await abrirDetalhes({ includes: ['Lavagem', 'Cera'], description: 'Brilho total' });

      expect(screen.getByText('Brilho total')).toBeTruthy();
      expect(screen.getByText('Lavagem')).toBeTruthy();
      expect(screen.getByText('Cera')).toBeTruthy();
    });

    // Serviço sem lista de itens não pode abrir um cartão vazio.
    it('sem itens usa a descrição como item único', async () => {
      await abrirDetalhes({ includes: [], description: 'Polimento completo' });

      expect(screen.getAllByText('Polimento completo').length).toBeGreaterThan(0);
    });

    it('sem itens e sem descrição usa um texto padrão', async () => {
      await abrirDetalhes({ includes: [], description: null });

      expect(screen.getByText('Execução do serviço selecionado')).toBeTruthy();
      expect(screen.getByText('Serviço da estética')).toBeTruthy();
    });

    it('fecha ao tocar em continuar', async () => {
      await abrirDetalhes();
      expect(screen.getByText('Inclui')).toBeTruthy();

      await act(async () => {
        fireEvent.press(screen.getByText('Continuar'));
      });

      expect(screen.queryByText('Inclui')).toBeNull();
    });
  });

  describe('troca de dia', () => {
    /** Abre o calendário e devolve o picker montado. */
    async function abrirCalendario() {
      await act(async () => {
        fireEvent.press(screen.getByText(/\d{2}\/\d{2}/));
      });
      return screen.UNSAFE_getByType('DateTimePicker' as never);
    }

    it('escolher outro dia recarrega os horários', async () => {
      await renderizar();
      await escolherServico('Polimento');
      mockGetAvailableSlots.mockClear();

      const picker = await abrirCalendario();
      const amanha = new Date(2026, 6, 16, 0, 0, 0);
      await act(async () => {
        picker.props.onChange({ type: 'set' }, amanha);
      });

      expect(mockGetAvailableSlots).toHaveBeenCalledWith(amanha, 90, 'shop-1');
    });

    // No Android o cancelar do calendário chega como evento 'dismissed'.
    it('cancelar o calendário no Android não recarrega', async () => {
      const { Platform } = require('react-native');
      const original = Platform.OS;
      Platform.OS = 'android';

      try {
        await renderizar();
        await escolherServico('Polimento');
        mockGetAvailableSlots.mockClear();

        const picker = await abrirCalendario();
        await act(async () => {
          picker.props.onChange({ type: 'dismissed' }, new Date(2026, 6, 16));
        });

        expect(mockGetAvailableSlots).not.toHaveBeenCalled();
      } finally {
        Platform.OS = original;
      }
    });

    it('fechar o calendário sem escolher não recarrega', async () => {
      await renderizar();
      await escolherServico('Polimento');
      mockGetAvailableSlots.mockClear();

      const picker = await abrirCalendario();
      await act(async () => {
        picker.props.onChange({ type: 'dismissed' }, undefined);
      });

      expect(mockGetAvailableSlots).not.toHaveBeenCalled();
    });
  });

  // Sem serviço escolhido não há duração para consultar: a lista fica vazia
  // em vez de buscar horários sem sentido.
  it('trocar o dia sem serviço não busca horários', async () => {
    await renderizar();

    await act(async () => {
      fireEvent.press(screen.getByText(/\d{2}\/\d{2}/));
    });
    const picker = screen.UNSAFE_getByType('DateTimePicker' as never);
    await act(async () => {
      picker.props.onChange({ type: 'set' }, new Date(2026, 6, 16));
    });

    expect(mockGetAvailableSlots).not.toHaveBeenCalled();
  });

  it('sem serviço nenhum na estética o seletor fica desabilitado', async () => {
    await renderizar([]);

    expect(screen.getByText('Nenhum serviço disponível')).toBeTruthy();
  });

  it('enquanto os serviços carregam mostra o aviso', async () => {
    mockServicesApi.loading = true;

    await renderizar([]);

    expect(screen.getByText('Carregando serviços...')).toBeTruthy();
  });

  describe('veículo padrão', () => {
    // A tela abre em Carro. Se a estética só atende moto, ela troca sozinha
    // em vez de mostrar uma lista vazia.
    it('troca para moto quando a estética só atende moto', async () => {
      await renderizar([servico({ name: 'Lavagem de moto', vehicleTypes: ['Moto'] })]);

      expect(await servicosOferecidos()).toEqual(['Lavagem de moto']);
    });

    it('sem serviço nenhum não força troca de veículo', async () => {
      await renderizar([]);

      // Continua em Carro: não há para onde trocar.
      expect(screen.getByTestId('category-selector')).toBeTruthy();
    });

    it('moto não mostra o seletor de categoria', async () => {
      await renderizar([servico({ name: 'Lavagem de moto', vehicleTypes: ['Moto'] })]);

      expect(screen.queryByTestId('category-selector')).toBeNull();
    });

    it('voltar para carro traz a categoria de volta', async () => {
      await renderizar([servico({ vehicleTypes: ['Carro', 'Moto'] })]);

      await act(async () => {
        fireEvent.press(screen.getByText('Moto'));
      });
      expect(screen.queryByTestId('category-selector')).toBeNull();

      await act(async () => {
        fireEvent.press(screen.getByText('Carro'));
      });

      expect(screen.getByTestId('category-selector')).toBeTruthy();
      await abrirSeletor('category-selector');
      expect(opcoesDoModal('Categoria')).toContain('Hatch');
    });
  });

  it('tocar no serviço já escolhido reabre o seletor', async () => {
    await renderizar([
      servico({ id: 'a', name: 'Polimento' }),
      servico({ id: 'b', name: 'Enceramento' }),
    ]);
    await escolherServico('Polimento');

    await abrirSeletor('service-selector');
    await escolherNoModal('Serviço', 'Enceramento');

    expect(mockGetAvailableSlots).toHaveBeenLastCalledWith(expect.any(Date), 90, 'shop-1');
    expect(screen.getByText('Enceramento')).toBeTruthy();
  });

  // Trocar de veículo depois de escolher o serviço não pode deixar para trás
  // um serviço que o novo veículo não atende.
  it('trocar o veículo descarta o serviço incompatível e os horários', async () => {
    await renderizar([
      servico({ id: 'a', name: 'Polimento', vehicleTypes: ['Carro'] }),
      servico({ id: 'b', name: 'Lavagem de moto', vehicleTypes: ['Moto'] }),
    ]);
    await escolherServico('Polimento');
    await waitFor(() => expect(screen.getAllByText(/^\d{2}:\d{2}$/).length).toBeGreaterThan(0));

    await act(async () => {
      fireEvent.press(screen.getByText('Moto'));
    });

    expect(screen.queryByText(/^\d{2}:\d{2}$/)).toBeNull();
    expect(screen.getByText('Selecione os dados')).toBeTruthy();
  });
});
