// Todos os retornos de hook precisam ser estáveis entre renders — objeto novo
// a cada render reexecuta efeitos e trava o teste.

jest.mock('@react-native-firebase/firestore', () => new Proxy({}, { get: () => jest.fn() }));

const mockSignOut = jest.fn();
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: { uid: 'owner-1' } })),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => {
  const ReactLocal = require('react');
  return {
    useNavigation: () => ({ navigate: jest.fn(), goBack: mockGoBack }),
    useFocusEffect: (cb: () => void | (() => void)) => ReactLocal.useEffect(cb, [cb]),
  };
});

const mockShowError = jest.fn();
const mockFeedbackApi = {
  showError: mockShowError,
  showSuccess: jest.fn(),
  showConfirm: jest.fn(),
};
jest.mock('@shared/components/FeedbackProvider', () => ({ useFeedback: () => mockFeedbackApi }));

const mockUpdateShopName = jest.fn();
const mockCreateShopService = jest.fn();
const mockUpdateShopService = jest.fn();
const mockDeleteShopService = jest.fn();
const mockShopApi = { shop: { name: 'Tirac Auto Detail' }, shopId: 'shop-1' as string | null };
const mockServicesApi = {
  items: [] as unknown[],
  loading: false,
  reload: jest.fn(),
};
jest.mock('@features/shops', () => ({
  useShop: () => mockShopApi,
  useShopServices: () => mockServicesApi,
  createShopService: (...a: unknown[]) => mockCreateShopService(...a),
  updateShopName: (...a: unknown[]) => mockUpdateShopName(...a),
  deleteShopService: (...a: unknown[]) => mockDeleteShopService(...a),
  updateShopService: (...a: unknown[]) => mockUpdateShopService(...a),
  getServiceVehicleSummary: () => 'Carro',
  getShopServiceIcon: () => () => null,
}));

const mockGetShopSettings = jest.fn();
const mockUpdateShopSettings = jest.fn();
jest.mock('@features/settings', () => {
  const real = jest.requireActual('@features/settings/services/shopSettings.service');
  return {
    getShopSettings: (...a: unknown[]) => mockGetShopSettings(...a),
    updateShopSettings: (...a: unknown[]) => mockUpdateShopSettings(...a),
    ALL_WEEK_DAYS: real.ALL_WEEK_DAYS,
    WEEK_DAY_LABELS: real.WEEK_DAY_LABELS,
    SLOT_STEP_OPTIONS: real.SLOT_STEP_OPTIONS,
    MAX_MIN_NOTICE_MIN: real.MAX_MIN_NOTICE_MIN,
  };
});

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';

import AdminManageScreen from './AdminManageScreen';

const settingsPadrao = {
  openHour: 8,
  closeHour: 18,
  parallelCapacity: 2,
  workingDays: ['seg', 'ter', 'qua', 'qui', 'sex'],
  slotStepMin: 30,
  minNoticeMin: 15,
};

/** Renderiza e espera as configurações carregarem. */
async function renderizar() {
  const utils = render(<AdminManageScreen />);
  await waitFor(() => expect(screen.getByText('Horário de funcionamento')).toBeTruthy());
  return utils;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockShopApi.shopId = 'shop-1';
  mockServicesApi.items = [];
  mockServicesApi.loading = false;
  mockGetShopSettings.mockResolvedValue({ ...settingsPadrao });
  mockUpdateShopSettings.mockImplementation(async (_id, s) => s);
  mockUpdateShopName.mockResolvedValue(undefined);
  mockCreateShopService.mockResolvedValue({ id: 'svc-novo' });
  mockUpdateShopService.mockResolvedValue(undefined);
  mockDeleteShopService.mockResolvedValue(undefined);
});

describe('AdminManageScreen', () => {
  it('mostra as seções de gestão da loja', async () => {
    await renderizar();

    expect(screen.getByText('Nome da loja')).toBeTruthy();
    expect(screen.getByText('Serviços disponíveis')).toBeTruthy();
  });

  it('avisa quando as configurações não carregam', async () => {
    mockGetShopSettings.mockRejectedValueOnce(new Error('offline'));

    render(<AdminManageScreen />);

    await waitFor(() =>
      expect(mockShowError).toHaveBeenCalledWith('Falha ao carregar configurações.'),
    );
  });

  describe('nome da loja', () => {
    it('salva o nome informado', async () => {
      await renderizar();

      fireEvent.changeText(
        screen.getByPlaceholderText('Ex: Auto Detailing São Paulo'),
        'Nova Estética',
      );
      await act(async () => {
        fireEvent.press(screen.getByText('Salvar nome'));
      });

      expect(mockUpdateShopName).toHaveBeenCalledWith('shop-1', 'Nova Estética');
    });

    it('mostra o motivo quando o nome é recusado', async () => {
      mockUpdateShopName.mockRejectedValueOnce({ message: 'Nome já usado' });
      await renderizar();

      await act(async () => {
        fireEvent.press(screen.getByText('Salvar nome'));
      });

      expect(mockShowError).toHaveBeenCalledWith('Nome já usado');
    });
  });

  describe('horário de funcionamento', () => {
    // Abertura depois do fechamento geraria uma agenda sem nenhum horário.
    it('recusa abertura posterior ao fechamento', async () => {
      mockGetShopSettings.mockResolvedValueOnce({ ...settingsPadrao, openHour: 19, closeHour: 18 });
      await renderizar();

      await act(async () => {
        fireEvent.press(screen.getByText('Salvar configurações'));
      });

      expect(mockShowError).toHaveBeenCalledWith(
        'Horário de abertura deve ser anterior ao fechamento.',
        expect.objectContaining({ title: 'Atenção' }),
      );
      expect(mockUpdateShopSettings).not.toHaveBeenCalled();
    });

    it('salva as configurações válidas', async () => {
      await renderizar();

      await act(async () => {
        fireEvent.press(screen.getByText('Salvar configurações'));
      });

      expect(mockUpdateShopSettings).toHaveBeenCalledWith(
        'shop-1',
        expect.objectContaining({ openHour: 8, closeHour: 18 }),
      );
    });

    it('avisa quando a gravação falha', async () => {
      mockUpdateShopSettings.mockRejectedValueOnce(new Error('offline'));
      await renderizar();

      await act(async () => {
        fireEvent.press(screen.getByText('Salvar configurações'));
      });

      expect(mockShowError).toHaveBeenCalledWith('Falha ao salvar configurações.');
    });

    it('o intervalo entre horários anda pelas opções válidas', async () => {
      await renderizar();

      expect(screen.getByText('30 min')).toBeTruthy();

      await act(async () => {
        fireEvent.press(screen.getByTestId('slot-step-plus'));
      });
      expect(screen.getByText('60 min')).toBeTruthy();

      // 60 é o maior valor: não passa disso.
      await act(async () => {
        fireEvent.press(screen.getByTestId('slot-step-plus'));
      });
      expect(screen.getByText('60 min')).toBeTruthy();

      await act(async () => {
        fireEvent.press(screen.getByTestId('slot-step-minus'));
        fireEvent.press(screen.getByTestId('slot-step-minus'));
      });
      expect(screen.getByText('15 min')).toBeTruthy();
    });

    it('a antecedência mínima anda de 15 em 15 e não fica negativa', async () => {
      await renderizar();

      await act(async () => {
        fireEvent.press(screen.getByTestId('min-notice-minus'));
      });
      // Zero é exibido como "Sem", que significa antecedência desligada.
      expect(screen.getByText('Sem')).toBeTruthy();

      // Não passa de zero por baixo.
      await act(async () => {
        fireEvent.press(screen.getByTestId('min-notice-minus'));
      });
      expect(screen.getByText('Sem')).toBeTruthy();

      await act(async () => {
        fireEvent.press(screen.getByTestId('min-notice-plus'));
      });
      expect(screen.queryByText('Sem')).toBeNull();
    });
  });

  // Sem essas validações entrariam serviços impossíveis de agendar — duração
  // zero, preço negativo ou sem veículo atendido.
  describe('validação do serviço novo', () => {
    async function preencherEEnviar(campos: { nome?: string; duracao?: string; preco?: string }) {
      await renderizar();

      // O formulário só aparece depois de pedir para adicionar.
      await act(async () => {
        fireEvent.press(screen.getByText('Adicionar serviço'));
      });

      if (campos.nome !== undefined) {
        fireEvent.changeText(screen.getByPlaceholderText('Ex: Lavagem premium'), campos.nome);
      }
      if (campos.preco !== undefined) {
        fireEvent.changeText(screen.getByPlaceholderText('80'), campos.preco);
      }

      await act(async () => {
        fireEvent.press(screen.getByText('Criar serviço'));
      });
    }

    it('abre o formulário ao pedir para adicionar', async () => {
      await renderizar();

      await act(async () => {
        fireEvent.press(screen.getByText('Adicionar serviço'));
      });

      expect(screen.getByText('Novo serviço')).toBeTruthy();
    });

    it('exige o nome', async () => {
      await preencherEEnviar({ nome: '   ' });

      expect(mockShowError).toHaveBeenCalledWith(
        'Informe o nome do serviço.',
        expect.objectContaining({ title: 'Atenção' }),
      );
      expect(mockCreateShopService).not.toHaveBeenCalled();
    });

    it('exige preço válido', async () => {
      await preencherEEnviar({ nome: 'Lavagem', preco: '-10' });

      expect(mockShowError).toHaveBeenCalledWith(
        expect.stringMatching(/pre(ç|c)o v(á|a)lido/i),
        expect.objectContaining({ title: 'Atenção' }),
      );
      expect(mockCreateShopService).not.toHaveBeenCalled();
    });

    // O rascunho já nasce com duração de 30min e todos os veículos marcados —
    // o dono só precisa informar nome e preço para publicar.
    it('cria o serviço com os padrões do formulário', async () => {
      await preencherEEnviar({ nome: 'Lavagem', preco: '80' });

      expect(mockShowError).not.toHaveBeenCalled();
      expect(mockCreateShopService).toHaveBeenCalledWith(
        'shop-1',
        // O id do serviço é um slug do nome — some acento e caixa alta.
        'lavagem',
        expect.objectContaining({
          name: 'Lavagem',
          price: 80,
          durationMin: 30,
          active: true,
          vehicleTypes: ['Carro', 'Moto'],
        }),
      );
    });

    it('gera o id sem acento nem espaço', async () => {
      await preencherEEnviar({ nome: 'Higienização de Bancos', preco: '250' });

      expect(mockCreateShopService).toHaveBeenCalledWith(
        'shop-1',
        expect.stringMatching(/^[a-z0-9-]+$/),
        expect.anything(),
      );
    });

    it('avisa quando a criação falha', async () => {
      mockCreateShopService.mockRejectedValueOnce(new Error('offline'));

      await preencherEEnviar({ nome: 'Lavagem', preco: '80' });

      expect(mockShowError).toHaveBeenCalled();
    });

    it('aceita preço com vírgula', async () => {
      // O teclado numérico brasileiro produz vírgula; recusar seria armadilha.
      await renderizar();
      await act(async () => {
        fireEvent.press(screen.getByText('Adicionar serviço'));
      });

      fireEvent.changeText(screen.getByPlaceholderText('Ex: Lavagem premium'), 'Lavagem');
      fireEvent.changeText(screen.getByPlaceholderText('80'), '99,90');
      await act(async () => {
        fireEvent.press(screen.getByText('Criar serviço'));
      });

      // Passa da validação de preço e para na de duração, não na de preço.
      expect(mockShowError).not.toHaveBeenCalledWith(
        expect.stringMatching(/pre(ç|c)o/i),
        expect.anything(),
      );
    });

    it('cancelar fecha o formulário', async () => {
      await renderizar();
      await act(async () => {
        fireEvent.press(screen.getByText('Adicionar serviço'));
      });

      await act(async () => {
        fireEvent.press(screen.getByText('Cancelar'));
      });

      expect(screen.queryByText('Novo serviço')).toBeNull();
      expect(screen.getByText('Adicionar serviço')).toBeTruthy();
    });

    it('exige ao menos um tipo de veículo', async () => {
      await renderizar();
      await act(async () => {
        fireEvent.press(screen.getByText('Adicionar serviço'));
      });

      fireEvent.changeText(screen.getByPlaceholderText('Ex: Lavagem premium'), 'Lavagem');
      fireEvent.changeText(screen.getByPlaceholderText('80'), '80');
      // Ambos vêm marcados por padrão: desmarca os dois.
      await act(async () => {
        fireEvent.press(screen.getByText('Carro'));
      });
      await act(async () => {
        fireEvent.press(screen.getByText('Moto'));
      });
      await act(async () => {
        fireEvent.press(screen.getByText('Criar serviço'));
      });

      expect(mockShowError).toHaveBeenCalledWith(
        expect.stringMatching(/tipo de ve(í|i)culo/i),
        expect.objectContaining({ title: 'Atenção' }),
      );
      expect(mockCreateShopService).not.toHaveBeenCalled();
    });

    it('exige categoria quando o serviço atende carro', async () => {
      await renderizar();
      await act(async () => {
        fireEvent.press(screen.getByText('Adicionar serviço'));
      });

      fireEvent.changeText(screen.getByPlaceholderText('Ex: Lavagem premium'), 'Lavagem');
      fireEvent.changeText(screen.getByPlaceholderText('80'), '80');
      // Tira todas as categorias, mantendo Carro entre os veículos atendidos.
      for (const categoria of ['Hatch', 'Sedan', 'SUV', 'Picape cabine dupla']) {
        await act(async () => {
          fireEvent.press(screen.getByText(categoria));
        });
      }
      await act(async () => {
        fireEvent.press(screen.getByText('Criar serviço'));
      });

      expect(mockShowError).toHaveBeenCalledWith(
        expect.stringMatching(/categoria de carro/i),
        expect.objectContaining({ title: 'Atenção' }),
      );
    });
  });

  describe('sair da conta', () => {
    it('pede confirmação antes de deslogar', async () => {
      await renderizar();

      await act(async () => {
        fireEvent.press(screen.getByText('Sair da conta'));
      });

      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it('desloga ao confirmar', async () => {
      mockSignOut.mockResolvedValueOnce(undefined);
      await renderizar();

      await act(async () => {
        fireEvent.press(screen.getByText('Sair da conta'));
      });
      // 'Sair' aparece no item e no botão do modal.
      await act(async () => {
        fireEvent.press(screen.getAllByText('Sair')[0]);
      });

      expect(mockSignOut).toHaveBeenCalled();
    });

    it('avisa quando o logout falha', async () => {
      mockSignOut.mockRejectedValueOnce(new Error('sem rede'));
      await renderizar();

      await act(async () => {
        fireEvent.press(screen.getByText('Sair da conta'));
      });
      await act(async () => {
        fireEvent.press(screen.getAllByText('Sair')[0]);
      });

      expect(mockShowError).toHaveBeenCalledWith('Falha ao sair da conta.');
    });
  });

  describe('steppers de horário e capacidade', () => {
    it('ajusta abertura e fechamento', async () => {
      await renderizar();

      await act(async () => {
        fireEvent.press(screen.getByTestId('openHour-plus'));
      });
      expect(screen.getByText('09:00')).toBeTruthy();

      await act(async () => {
        fireEvent.press(screen.getByTestId('closeHour-minus'));
      });
      expect(screen.getByText('17:00')).toBeTruthy();
    });

    it('não passa de meia-noite nem das 23h', async () => {
      mockGetShopSettings.mockResolvedValueOnce({ ...settingsPadrao, openHour: 0, closeHour: 23 });
      await renderizar();

      await act(async () => {
        fireEvent.press(screen.getByTestId('openHour-minus'));
      });
      expect(screen.getByText('00:00')).toBeTruthy();

      await act(async () => {
        fireEvent.press(screen.getByTestId('closeHour-plus'));
      });
      expect(screen.getByText('23:00')).toBeTruthy();
    });

    it('ajusta os atendimentos simultâneos respeitando os limites', async () => {
      mockGetShopSettings.mockResolvedValueOnce({ ...settingsPadrao, parallelCapacity: 1 });
      await renderizar();

      // Um é o mínimo: não dá para ter estética que atende zero carros.
      await act(async () => {
        fireEvent.press(screen.getByTestId('capacity-minus'));
      });
      expect(screen.getByText('1')).toBeTruthy();

      await act(async () => {
        fireEvent.press(screen.getByTestId('capacity-plus'));
      });
      expect(screen.getByText('2')).toBeTruthy();
    });
  });

  describe('nome de serviço e id gerado', () => {
    it('acrescenta sufixo quando o id já existe', async () => {
      // Dois serviços com o mesmo nome não podem colidir no mesmo id.
      mockServicesApi.items = [{ id: 'lavagem', name: 'Lavagem', durationMin: 30, price: 80 }];

      await renderizar();
      await act(async () => {
        fireEvent.press(screen.getByText('Adicionar serviço'));
      });
      fireEvent.changeText(screen.getByPlaceholderText('Ex: Lavagem premium'), 'Lavagem');
      fireEvent.changeText(screen.getByPlaceholderText('80'), '80');
      await act(async () => {
        fireEvent.press(screen.getByText('Criar serviço'));
      });

      expect(mockCreateShopService).toHaveBeenCalledWith('shop-1', 'lavagem-2', expect.anything());
    });

    it('usa "servico" quando o nome não gera id utilizável', async () => {
      await renderizar();
      await act(async () => {
        fireEvent.press(screen.getByText('Adicionar serviço'));
      });
      fireEvent.changeText(screen.getByPlaceholderText('Ex: Lavagem premium'), '!!!');
      fireEvent.changeText(screen.getByPlaceholderText('80'), '80');
      await act(async () => {
        fireEvent.press(screen.getByText('Criar serviço'));
      });

      expect(mockCreateShopService).toHaveBeenCalledWith('shop-1', 'servico', expect.anything());
    });
  });

  describe('edição de serviço existente', () => {
    const servico = {
      id: 'svc-1',
      name: 'Lavagem simples',
      title: 'Lavagem simples',
      durationMin: 90,
      price: 80,
      active: true,
      vehicleTypes: ['Carro'],
      carCategories: ['Hatch'],
      includes: [],
      recommendedFor: [],
      description: null,
      note: null,
      sortOrder: 0,
    };

    it('abre o formulário de edição', async () => {
      mockServicesApi.items = [servico];
      await renderizar();

      await act(async () => {
        fireEvent.press(screen.getByText('Editar serviço'));
      });

      expect(screen.getByText('Salvar serviço')).toBeTruthy();
    });

    it('salva as alterações', async () => {
      mockServicesApi.items = [servico];
      await renderizar();

      await act(async () => {
        fireEvent.press(screen.getByText('Editar serviço'));
      });
      fireEvent.changeText(screen.getByPlaceholderText('Ex: Lavagem premium'), 'Lavagem completa');
      await act(async () => {
        fireEvent.press(screen.getByText('Salvar serviço'));
      });

      expect(mockUpdateShopService).toHaveBeenCalledWith(
        'shop-1',
        'svc-1',
        expect.objectContaining({ name: 'Lavagem completa' }),
      );
    });

    it('mostra a duração formatada em horas e minutos', async () => {
      // 90min não está na lista de opções: cai no formato calculado.
      mockServicesApi.items = [servico];
      await renderizar();

      await act(async () => {
        fireEvent.press(screen.getByText('Editar serviço'));
      });

      expect(screen.getByText(/1h\s*30min/)).toBeTruthy();
    });

    it('pede confirmação antes de excluir', async () => {
      mockServicesApi.items = [servico];
      await renderizar();

      await act(async () => {
        fireEvent.press(screen.getByText('Excluir'));
      });

      expect(screen.getByText('Excluir serviço')).toBeTruthy();
      expect(mockDeleteShopService).not.toHaveBeenCalled();
    });

    it('exclui ao confirmar', async () => {
      mockServicesApi.items = [servico];
      await renderizar();

      await act(async () => {
        fireEvent.press(screen.getByText('Excluir'));
      });
      // O rótulo 'Excluir' está no botão da linha e no do modal.
      await act(async () => {
        fireEvent.press(screen.getAllByText('Excluir')[1]);
      });

      expect(mockDeleteShopService).toHaveBeenCalledWith('shop-1', 'svc-1');
    });

    it('avisa quando a exclusão falha', async () => {
      mockServicesApi.items = [servico];
      mockDeleteShopService.mockRejectedValueOnce(new Error('offline'));
      await renderizar();

      await act(async () => {
        fireEvent.press(screen.getByText('Excluir'));
      });
      await act(async () => {
        fireEvent.press(screen.getAllByText('Excluir')[1]);
      });

      expect(mockShowError).toHaveBeenCalledWith('Falha ao excluir serviço.');
    });
  });

  describe('campos livres do formulário', () => {
    /** Abre o formulário de serviço novo. */
    async function abrirFormulario() {
      await renderizar();
      await act(async () => {
        fireEvent.press(screen.getByText('Adicionar serviço'));
      });
    }

    it('preenche descrição, itens inclusos, indicações e observação', async () => {
      await abrirFormulario();

      fireEvent.changeText(screen.getByPlaceholderText('Ex: Lavagem premium'), 'Vitrificação');
      fireEvent.changeText(screen.getByPlaceholderText('80'), '900');
      fireEvent.changeText(
        screen.getByPlaceholderText('Descreva o que está incluso neste serviço'),
        'Proteção de longa duração',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Um item por linha\nEx: Lavagem externa\nAspiração rápida'),
        'Lavagem técnica\nDescontaminação',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Um item por linha\nEx: Uso diário\nManutenção'),
        'Carros escuros',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Ex: Ideal para manutenção semanal'),
        'Requer agendamento prévio',
      );

      await act(async () => {
        fireEvent.press(screen.getByText('Criar serviço'));
      });

      expect(mockCreateShopService).toHaveBeenCalledWith(
        'shop-1',
        expect.any(String),
        expect.objectContaining({
          description: 'Proteção de longa duração',
          // Textos multilinha viram lista, um item por linha.
          includes: ['Lavagem técnica', 'Descontaminação'],
          recommendedFor: ['Carros escuros'],
          note: 'Requer agendamento prévio',
        }),
      );
    });
  });

  describe('seletor de duração', () => {
    /**
     * "30 min" aparece no stepper de intervalo e no campo de duração do
     * formulário. O do formulário é o último renderizado.
     */
    function campoDuracao() {
      const nos = screen.getAllByText('30 min');
      return nos[nos.length - 1];
    }

    /** Aciona o SelectModal de duração com o valor informado. */
    async function escolherDuracao(valor: string) {
      const SelectModal = require('@shared/components/SelectModal').default;
      const modal = screen.UNSAFE_getByType(SelectModal);
      await act(async () => {
        modal.props.onSelect(valor);
      });
    }

    it('abre ao tocar no campo de duração', async () => {
      await renderizar();
      await act(async () => {
        fireEvent.press(screen.getByText('Adicionar serviço'));
      });

      const SelectModal = require('@shared/components/SelectModal').default;
      expect(screen.UNSAFE_getByType(SelectModal).props.visible).toBe(false);

      await act(async () => {
        fireEvent.press(campoDuracao());
      });

      expect(screen.UNSAFE_getByType(SelectModal).props.visible).toBe(true);
    });

    it('recusa duração abaixo do mínimo', async () => {
      // Menos de 5 minutos não é serviço — provavelmente digitação errada.
      await renderizar();
      await act(async () => {
        fireEvent.press(screen.getByText('Adicionar serviço'));
      });
      fireEvent.changeText(screen.getByPlaceholderText('Ex: Lavagem premium'), 'Lavagem');
      fireEvent.changeText(screen.getByPlaceholderText('80'), '80');
      await act(async () => {
        fireEvent.press(campoDuracao());
      });
      await escolherDuracao('0');

      await act(async () => {
        fireEvent.press(screen.getByText('Criar serviço'));
      });

      expect(mockShowError).toHaveBeenCalledWith(
        'Informe uma duração válida para o serviço.',
        expect.objectContaining({ title: 'Atenção' }),
      );
    });

    it('mostra "Selecionar" quando não há duração escolhida', async () => {
      await renderizar();
      await act(async () => {
        fireEvent.press(screen.getByText('Adicionar serviço'));
      });
      await act(async () => {
        fireEvent.press(campoDuracao());
      });
      await escolherDuracao('');

      expect(screen.getByText('Selecionar')).toBeTruthy();
    });

    it('fecha sem escolher', async () => {
      await renderizar();
      await act(async () => {
        fireEvent.press(screen.getByText('Adicionar serviço'));
      });
      await act(async () => {
        fireEvent.press(campoDuracao());
      });

      const SelectModal = require('@shared/components/SelectModal').default;
      await act(async () => {
        screen.UNSAFE_getByType(SelectModal).props.onClose();
      });

      expect(screen.UNSAFE_getByType(SelectModal).props.visible).toBe(false);
    });
  });

  describe('dias de atendimento', () => {
    it('remove e devolve um dia da semana', async () => {
      await renderizar();

      // Segunda vem marcada por padrão; tocar desmarca.
      await act(async () => {
        fireEvent.press(screen.getByText('Seg'));
      });
      await act(async () => {
        fireEvent.press(screen.getByText('Salvar configurações'));
      });

      expect(mockUpdateShopSettings).toHaveBeenCalledWith(
        'shop-1',
        expect.objectContaining({ workingDays: expect.not.arrayContaining(['seg']) }),
      );
    });

    it('acrescenta um dia que não era atendido', async () => {
      await renderizar();

      await act(async () => {
        fireEvent.press(screen.getByText('Sáb'));
      });
      await act(async () => {
        fireEvent.press(screen.getByText('Salvar configurações'));
      });

      expect(mockUpdateShopSettings).toHaveBeenCalledWith(
        'shop-1',
        expect.objectContaining({ workingDays: expect.arrayContaining(['sab']) }),
      );
    });
  });

  describe('confirmação de sucesso temporária', () => {
    // O "salvo" some sozinho depois de 2s — sem os timers falsos o teste
    // ficaria dependente de espera real.
    it('a marca de nome salvo desaparece após 2 segundos', async () => {
      // Falsificar SÓ os timers. Os modernos também congelam nextTick,
      // queueMicrotask e setImmediate — e o `await act(...)` depende dessa
      // fila para resolver, então o teste travava sem nunca terminar.
      jest.useFakeTimers({
        doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask', 'performance'],
      });
      try {
        render(<AdminManageScreen />);
        await act(async () => {
          await Promise.resolve();
        });

        await act(async () => {
          fireEvent.press(screen.getByText('Salvar nome'));
        });
        await act(async () => {
          jest.advanceTimersByTime(2000);
        });

        expect(screen.getByText('Salvar nome')).toBeTruthy();
      } finally {
        jest.useRealTimers();
      }
    });
  });

  it('volta ao tocar na seta', async () => {
    await renderizar();

    fireEvent.press(screen.UNSAFE_getAllByType(require('react-native').TouchableOpacity)[0]);

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('cancela a confirmação sem executar a ação', async () => {
    mockServicesApi.items = [
      { id: 'svc-1', name: 'Lavagem', durationMin: 30, price: 80, active: true, sortOrder: 0 },
    ];
    await renderizar();

    await act(async () => {
      fireEvent.press(screen.getByText('Excluir'));
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Cancelar'));
    });

    expect(mockDeleteShopService).not.toHaveBeenCalled();
  });

  it('não carrega configurações sem shop definido', async () => {
    mockShopApi.shopId = null;

    render(<AdminManageScreen />);

    expect(mockGetShopSettings).not.toHaveBeenCalled();
  });

  it('não salva nome em branco', async () => {
    await renderizar();

    fireEvent.changeText(screen.getByPlaceholderText('Ex: Auto Detailing São Paulo'), '   ');
    await act(async () => {
      fireEvent.press(screen.getByText('Salvar nome'));
    });

    expect(mockUpdateShopName).not.toHaveBeenCalled();
  });

  describe('serviços cadastrados', () => {
    const servico = {
      id: 'svc-1',
      name: 'Lavagem simples',
      title: 'Lavagem simples',
      durationMin: 30,
      price: 80,
      active: true,
      vehicleTypes: ['Carro'],
      carCategories: ['Hatch'],
      includes: [],
      recommendedFor: [],
      description: null,
      note: null,
    };

    it('lista os serviços da estética', async () => {
      mockServicesApi.items = [servico];

      await renderizar();

      expect(screen.getByText('Lavagem simples')).toBeTruthy();
    });

    it('avisa quando a alteração do serviço falha', async () => {
      mockServicesApi.items = [servico];
      mockUpdateShopService.mockRejectedValueOnce(new Error('offline'));

      await renderizar();
      const toggle = screen.UNSAFE_getAllByType(require('react-native').Switch)[0];
      await act(async () => {
        fireEvent(toggle, 'valueChange', false);
      });

      expect(mockShowError).toHaveBeenCalledWith('Falha ao atualizar serviço.');
    });

    it('liga e desliga o serviço', async () => {
      mockServicesApi.items = [servico];

      await renderizar();
      const toggle = screen.UNSAFE_getAllByType(require('react-native').Switch)[0];
      await act(async () => {
        fireEvent(toggle, 'valueChange', false);
      });

      expect(mockUpdateShopService).toHaveBeenCalledWith('shop-1', 'svc-1', { active: false });
    });
  });
});
