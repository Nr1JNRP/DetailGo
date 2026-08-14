const mockUser = {
  uid: 'user-1',
  email: 'ana@teste.com',
  displayName: null as string | null,
  photoURL: null as string | null,
};
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: mockUser })),
}));

const mockOnSnapshot = jest.fn();
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  doc: jest.fn((_db: unknown, ...path: unknown[]) => ({ path: path.join('/') })),
  onSnapshot: (...a: unknown[]) => mockOnSnapshot(...a),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useIsFocused: () => true,
  // A tela usa useFocusEffect(useCallback(...)); em teste ela está sempre em foco.
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));

const mockLaunchImageLibrary = jest.fn();
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: (...a: unknown[]) => mockLaunchImageLibrary(...a),
}));

const mockShowError = jest.fn();
const mockShowSuccess = jest.fn();
const mockShowConfirm = jest.fn();
const mockFeedbackApi = {
  showError: mockShowError,
  showSuccess: mockShowSuccess,
  showConfirm: mockShowConfirm,
};
jest.mock('@shared/components/FeedbackProvider', () => ({ useFeedback: () => mockFeedbackApi }));

const mockSignOut = jest.fn();
const mockAuthApi = { signOut: mockSignOut };
const mockMeState = { me: null as Record<string, unknown> | null };
jest.mock('@features/auth', () => ({
  useAuth: () => mockAuthApi,
  useMeStore: (seletor: (s: unknown) => unknown) => seletor(mockMeState),
}));

const mockShopApi = { shopId: null as string | null, shop: null as Record<string, unknown> | null };
const mockServicesApi = { loading: false, items: [] as unknown[] };
jest.mock('@features/shops', () => ({
  useShop: () => mockShopApi,
  useShopServices: () => mockServicesApi,
  getShopServiceIcon: () => () => null,
}));

const mockGetShopSettings = jest.fn();
jest.mock('@features/settings', () => ({
  getShopSettings: (...a: unknown[]) => mockGetShopSettings(...a),
}));

const mockNotificationsApi = { unreadCount: 0 };
jest.mock('@features/notifications', () => ({
  useRegisterPushToken: jest.fn(),
  useUserNotifications: () => mockNotificationsApi,
}));

const mockAppointmentsApi = { loading: false, items: [] as unknown[] };
const mockClearFavorite = jest.fn();
jest.mock('@features/appointments', () => {
  // Regras puras de domínio vêm de verdade — o teste exercita a decisão real
  // de "ativo" e "vencido", não uma imitação.
  const constantes = jest.requireActual('@features/appointments/domain/appointment.constants');
  const helpers = jest.requireActual('@features/appointments/domain/appointment.helpers');
  return {
    useDashboardAppointments: () => mockAppointmentsApi,
    clearShopFavoriteIfNoActive: (...a: unknown[]) => mockClearFavorite(...a),
    ACTIVE_APPOINTMENT_SET: constantes.ACTIVE_APPOINTMENT_SET,
    getAppointmentStatusConfig: helpers.getAppointmentStatusConfig,
    isExpiredScheduled: helpers.isExpiredScheduled,
  };
});

const mockUploadProfilePhoto = jest.fn();
jest.mock('@shared/services/userPhoto.service', () => ({
  uploadProfilePhoto: (...a: unknown[]) => mockUploadProfilePhoto(...a),
}));

const mockAgora = new Date(2026, 6, 15, 9, 0, 0).getTime();
jest.mock('@shared/hooks/useNowTick', () => ({ useNowTick: () => mockAgora }));

import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react-native';

import DashboardScreen from './DashboardScreen';
import type { UserAppointment } from '@features/appointments';

const AGORA = mockAgora;

const HORA = 60 * 60 * 1000;

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

const servico = (id: string, name: string) => ({ id, name, durationMin: 60, price: 100 });

const ESTETICA = {
  name: 'Tirac Auto Detail',
  ownerId: 'owner-1',
  location: { address: 'Rua das Flores, 100', city: 'Recife' },
};

/** Vincula o cliente a uma estética. */
function comEstetica(over: Record<string, unknown> = {}) {
  mockShopApi.shopId = 'shop-1';
  mockShopApi.shop = { ...ESTETICA, ...over };
}

async function renderizar() {
  const utils = render(<DashboardScreen />);
  await act(async () => {
    await Promise.resolve();
  });
  return utils;
}

/** Entrega o telefone do dono ao listener registrado. */
async function telefoneDoDono(phone: string | undefined) {
  const onNext = mockOnSnapshot.mock.calls[0][1];
  await act(async () => {
    onNext({ data: () => (phone === undefined ? undefined : { phone }) });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUser.displayName = null;
  mockUser.photoURL = null;
  mockShopApi.shopId = null;
  mockShopApi.shop = null;
  mockServicesApi.loading = false;
  mockServicesApi.items = [];
  mockAppointmentsApi.loading = false;
  mockAppointmentsApi.items = [];
  mockNotificationsApi.unreadCount = 0;
  mockMeState.me = null;
  mockOnSnapshot.mockReturnValue(jest.fn());
  mockGetShopSettings.mockResolvedValue({ openHour: 8, closeHour: 18 });
  mockLaunchImageLibrary.mockResolvedValue({ didCancel: true });
  mockUploadProfilePhoto.mockResolvedValue({ ok: true, url: 'https://foto/nova.jpg' });
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

describe('DashboardScreen', () => {
  describe('cliente sem estética', () => {
    // Cliente novo não tem agendamento nenhum: mostrar uma lista vazia não
    // ajuda. A tela manda ele para o mapa.
    it('convida a encontrar uma estética', async () => {
      await renderizar();

      expect(screen.getByText('Encontre uma estética')).toBeTruthy();
      expect(screen.queryByText('Próximos serviços')).toBeNull();
    });

    it('explorar mapa leva para o mapa', async () => {
      await renderizar();

      fireEvent.press(screen.getByText('Explorar mapa'));

      expect(mockNavigate).toHaveBeenCalledWith('Map');
    });

    it('não busca telefone nem horários da estética', async () => {
      await renderizar();

      expect(mockOnSnapshot).not.toHaveBeenCalled();
      expect(mockGetShopSettings).not.toHaveBeenCalled();
    });
  });

  describe('saudação e identidade', () => {
    it.each([
      [8, 'Bom dia'],
      [14, 'Boa tarde'],
      [21, 'Boa noite'],
    ])('às %sh cumprimenta com "%s"', async (hora, esperado) => {
      jest.setSystemTime(new Date(2026, 6, 15, hora, 0, 0));

      await renderizar();

      expect(screen.getByText(esperado)).toBeTruthy();
    });

    it('mostra o nome do documento do usuário', async () => {
      mockMeState.me = { uid: 'user-1', firstName: 'Ana', lastName: 'Silva' };

      await renderizar();

      expect(screen.getByText('Ana Silva')).toBeTruthy();
      expect(screen.getByText('AS')).toBeTruthy();
    });

    // Documento ainda não carregou: o displayName do Firebase Auth serve de
    // ponte para a tela não abrir com "Você".
    it('sem documento usa o displayName do Auth', async () => {
      mockUser.displayName = 'Ana Silva';

      await renderizar();

      expect(screen.getByText('Ana Silva')).toBeTruthy();
      expect(screen.getByText('AS')).toBeTruthy();
    });

    it('sem nome nenhum usa o rótulo padrão', async () => {
      await renderizar();

      expect(screen.getByText('Você')).toBeTruthy();
      expect(screen.getByText('U')).toBeTruthy();
    });

    it('só o primeiro nome vira uma inicial', async () => {
      mockMeState.me = { uid: 'user-1', firstName: 'Ana' };

      await renderizar();

      expect(screen.getByText('A')).toBeTruthy();
    });
  });

  describe('foto de perfil', () => {
    it('escolher uma foto envia e troca o avatar', async () => {
      mockLaunchImageLibrary.mockResolvedValue({
        didCancel: false,
        assets: [{ uri: 'file://foto.jpg' }],
      });

      await renderizar();
      await act(async () => {
        fireEvent.press(screen.getByText('U'));
      });

      expect(mockUploadProfilePhoto).toHaveBeenCalledWith('user-1', 'file://foto.jpg');
      expect(mockShowError).not.toHaveBeenCalled();
    });

    it('cancelar a galeria não envia nada', async () => {
      mockLaunchImageLibrary.mockResolvedValue({ didCancel: true });

      await renderizar();
      await act(async () => {
        fireEvent.press(screen.getByText('U'));
      });

      expect(mockUploadProfilePhoto).not.toHaveBeenCalled();
    });

    it('escolha sem arquivo não envia nada', async () => {
      mockLaunchImageLibrary.mockResolvedValue({ didCancel: false, assets: [] });

      await renderizar();
      await act(async () => {
        fireEvent.press(screen.getByText('U'));
      });

      expect(mockUploadProfilePhoto).not.toHaveBeenCalled();
    });

    it('falha no envio mostra o motivo do serviço', async () => {
      mockLaunchImageLibrary.mockResolvedValue({
        didCancel: false,
        assets: [{ uri: 'file://foto.jpg' }],
      });
      mockUploadProfilePhoto.mockResolvedValue({ ok: false, message: 'Arquivo muito grande.' });

      await renderizar();
      await act(async () => {
        fireEvent.press(screen.getByText('U'));
      });

      expect(mockShowError).toHaveBeenCalledWith('Arquivo muito grande.');
    });

    it('erro inesperado na galeria vira aviso genérico', async () => {
      mockLaunchImageLibrary.mockRejectedValue(new Error('sem permissão'));

      await renderizar();
      await act(async () => {
        fireEvent.press(screen.getByText('U'));
      });

      expect(mockShowError).toHaveBeenCalledWith('Não foi possível atualizar a foto');
    });
  });

  describe('notificações', () => {
    it('sem não lidas não mostra selo', async () => {
      await renderizar();

      expect(screen.queryByText('0')).toBeNull();
    });

    it('mostra a quantidade não lida', async () => {
      mockNotificationsApi.unreadCount = 3;

      await renderizar();

      expect(screen.getByText('3')).toBeTruthy();
    });

    // Acima de 9 o selo não cabe: vira 9+ em vez de esticar o círculo.
    it('mais de nove vira 9+', async () => {
      mockNotificationsApi.unreadCount = 42;

      await renderizar();

      expect(screen.getByText('9+')).toBeTruthy();
    });
  });

  describe('cliente vinculado a uma estética', () => {
    it('oferece agendar na estética vinculada', async () => {
      comEstetica();

      await renderizar();

      expect(screen.getByText('Agendar serviço')).toBeTruthy();
      expect(screen.getByText('em Tirac Auto Detail')).toBeTruthy();
    });

    it('agendar leva para a tela de agendamento', async () => {
      comEstetica();

      await renderizar();
      fireEvent.press(screen.getByText('Agendar serviço'));

      expect(mockNavigate).toHaveBeenCalledWith('Appointment');
    });

    it('lista os serviços da estética', async () => {
      comEstetica();
      mockServicesApi.items = [servico('a', 'Polimento'), servico('b', 'Enceramento')];

      await renderizar();

      expect(screen.getByText('Polimento')).toBeTruthy();
      expect(screen.getByText('Enceramento')).toBeTruthy();
    });

    it('tocar num serviço leva para o agendamento', async () => {
      comEstetica();
      mockServicesApi.items = [servico('a', 'Polimento')];

      await renderizar();
      fireEvent.press(screen.getByText('Polimento'));

      expect(mockNavigate).toHaveBeenCalledWith('Appointment');
    });

    it('estética sem serviço avisa', async () => {
      comEstetica();

      await renderizar();

      expect(screen.getByText('Nenhum serviço disponível')).toBeTruthy();
    });

    it('mostra carregamento enquanto os serviços vêm', async () => {
      comEstetica();
      mockServicesApi.loading = true;

      await renderizar();

      expect(screen.queryByText('Nenhum serviço disponível')).toBeNull();
    });
  });

  describe('informações da estética', () => {
    async function abrirInfo() {
      comEstetica();
      await renderizar();
      await act(async () => {
        fireEvent.press(screen.UNSAFE_getAllByType(require('react-native').TouchableOpacity)[4]);
      });
    }

    it('mostra endereço, horário e telefone', async () => {
      await abrirInfo();
      await telefoneDoDono('11999998888');

      await act(async () => {
        fireEvent.press(screen.UNSAFE_getAllByType(require('react-native').TouchableOpacity)[4]);
      });

      const [mensagem, opcoes] = mockShowSuccess.mock.calls.at(-1)!;
      expect(mensagem).toContain('Rua das Flores, 100 - Recife');
      expect(mensagem).toContain('08h às 18h');
      expect(mensagem).toContain('(11) 99999-8888');
      expect(opcoes).toEqual(expect.objectContaining({ title: 'Tirac Auto Detail' }));
    });

    // O cliente pode não ter permissão de ler o doc do dono. Sem telefone a
    // tela ainda mostra o resto em vez de quebrar.
    it('sem telefone do dono informa que não há', async () => {
      await abrirInfo();
      await telefoneDoDono(undefined);

      await act(async () => {
        fireEvent.press(screen.UNSAFE_getAllByType(require('react-native').TouchableOpacity)[4]);
      });

      expect(mockShowSuccess.mock.calls.at(-1)![0]).toContain('Não informado');
    });

    it('erro na leitura do dono não quebra a tela', async () => {
      comEstetica();
      await renderizar();

      const onError = mockOnSnapshot.mock.calls[0][2];
      await act(async () => {
        onError(new Error('permission-denied'));
      });

      expect(screen.getByText('Agendar serviço')).toBeTruthy();
    });

    it('estética sem endereço diz que não foi informado', async () => {
      comEstetica({ location: undefined });
      await renderizar();

      await act(async () => {
        fireEvent.press(screen.UNSAFE_getAllByType(require('react-native').TouchableOpacity)[4]);
      });

      expect(mockShowSuccess.mock.calls.at(-1)![0]).toContain('Endereço não informado');
    });

    it('falha ao ler os horários não impede a informação', async () => {
      mockGetShopSettings.mockRejectedValue(new Error('offline'));
      comEstetica();

      await renderizar();
      await act(async () => {
        fireEvent.press(screen.UNSAFE_getAllByType(require('react-native').TouchableOpacity)[4]);
      });

      expect(mockShowSuccess.mock.calls.at(-1)![0]).not.toContain('Atendimento');
    });
  });

  describe('próximos serviços', () => {
    it('lista o próximo agendamento', async () => {
      comEstetica();
      mockAppointmentsApi.items = [agendamento()];

      await renderizar();

      expect(screen.getByText('Polimento')).toBeTruthy();
      expect(screen.getByText('1 ativos')).toBeTruthy();
    });

    // Concluído e cancelado pertencem ao histórico, não ao painel.
    it('ignora agendamento que já terminou', async () => {
      comEstetica();
      mockAppointmentsApi.items = [
        agendamento({ id: 'a', status: 'done' }),
        agendamento({ id: 'b', status: 'cancelled' }),
      ];

      await renderizar();

      expect(screen.getByText('Sem agendamentos')).toBeTruthy();
    });

    // Passou do horário e o dono não deu baixa: sai daqui e vira pendência no
    // histórico, senão ficaria preso como "próximo" para sempre.
    it('tira da lista o agendamento vencido', async () => {
      comEstetica();
      mockAppointmentsApi.items = [agendamento({ startAtMs: AGORA - 5 * HORA })];

      await renderizar();

      expect(screen.getByText('Sem agendamentos')).toBeTruthy();
    });

    it('mostra no máximo três próximos', async () => {
      comEstetica();
      mockAppointmentsApi.items = [1, 2, 3, 4].map(n =>
        agendamento({ id: `appt-${n}`, serviceLabel: `Serviço ${n}` }),
      );

      await renderizar();

      expect(screen.getByText('3 ativos')).toBeTruthy();
    });

    it('tocar no card leva para os agendamentos', async () => {
      comEstetica();
      mockAppointmentsApi.items = [agendamento()];

      await renderizar();
      fireEvent.press(screen.getByText('Polimento'));

      expect(mockNavigate).toHaveBeenCalledWith('MyAppointments');
    });

    it('em andamento aparece com o status', async () => {
      comEstetica();
      mockAppointmentsApi.items = [agendamento({ status: 'in_progress' })];

      await renderizar();

      expect(screen.getByText('Em andamento')).toBeTruthy();
    });

    it('sem categoria mostra o tipo do veículo', async () => {
      comEstetica();
      mockAppointmentsApi.items = [agendamento({ carCategory: null, vehicleType: 'Moto' })];

      await renderizar();

      expect(screen.getByText('Moto')).toBeTruthy();
    });

    it('sem rótulo de serviço mostra o genérico', async () => {
      comEstetica();
      mockAppointmentsApi.items = [agendamento({ serviceLabel: undefined })];

      await renderizar();

      expect(screen.getByText('Serviço')).toBeTruthy();
    });

    it('começar leva para o agendamento quando não há nenhum', async () => {
      comEstetica();

      await renderizar();
      fireEvent.press(screen.getByText('Começar'));

      expect(mockNavigate).toHaveBeenCalledWith('Appointment');
    });

    it('mostra carregamento enquanto os agendamentos vêm', async () => {
      comEstetica();
      mockAppointmentsApi.loading = true;

      await renderizar();

      expect(screen.queryByText('Sem agendamentos')).toBeNull();
    });
  });

  describe('vínculo com a estética', () => {
    // Sem nenhum serviço ativo por vir, o vínculo é desfeito e o cliente volta
    // a poder escolher outra estética.
    it('sem próximos desfaz o vínculo', async () => {
      comEstetica();

      await renderizar();

      expect(mockClearFavorite).toHaveBeenCalledWith('user-1', 'shop-1');
    });

    it('com próximo mantém o vínculo', async () => {
      comEstetica();
      mockAppointmentsApi.items = [agendamento()];

      await renderizar();

      expect(mockClearFavorite).not.toHaveBeenCalled();
    });

    it('enquanto carrega não desfaz nada', async () => {
      comEstetica();
      mockAppointmentsApi.loading = true;

      await renderizar();

      expect(mockClearFavorite).not.toHaveBeenCalled();
    });
  });

  describe('barra inferior', () => {
    it.each([
      ['Explorar', 'Map'],
      ['Histórico', 'History'],
      ['Perfil', 'Profile'],
    ])('%s leva para %s', async (rotulo, rota) => {
      await renderizar();

      fireEvent.press(screen.getByText(rotulo));

      expect(mockNavigate).toHaveBeenCalledWith(rota);
    });

    it('Início não navega — já está nele', async () => {
      await renderizar();

      fireEvent.press(screen.getByText('Início'));

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('o sino leva para as notificações', async () => {
      await renderizar();

      fireEvent.press(screen.UNSAFE_getAllByType(require('react-native').TouchableOpacity)[1]);

      expect(mockNavigate).toHaveBeenCalledWith('Notifications');
    });
  });

  describe('menu lateral', () => {
    async function abrirMenu() {
      await renderizar();
      await act(async () => {
        fireEvent.press(screen.UNSAFE_getAllByType(require('react-native').TouchableOpacity)[0]);
      });
    }

    it('o menu abre com os dados do usuário', async () => {
      mockUser.displayName = 'Ana Silva';

      await abrirMenu();

      expect(screen.getByText('ana@teste.com')).toBeTruthy();
      expect(screen.getByText('Meus agendamentos')).toBeTruthy();
    });

    it.each([
      ['Meus agendamentos', 'MyAppointments'],
      // "Histórico" e "Perfil" existem também na barra inferior; o item do
      // menu é o último da árvore, porque a gaveta é renderizada por cima.
      ['Histórico', 'History'],
      ['Perfil', 'Profile'],
      ['Explorar estéticas', 'Map'],
    ])('%s leva para %s e fecha o menu', async (rotulo, rota) => {
      await abrirMenu();

      const itens = screen.getAllByText(rotulo);
      await act(async () => {
        fireEvent.press(itens[itens.length - 1]);
      });

      expect(mockNavigate).toHaveBeenCalledWith(rota);
    });

    it('o fundo fecha o menu', async () => {
      await abrirMenu();

      await act(async () => {
        fireEvent.press(screen.getByTestId('drawer-overlay'));
      });

      await waitFor(() => expect(screen.queryByText('Meus agendamentos')).toBeNull());
    });

    // Sair pede confirmação: um toque errado no menu não pode derrubar a sessão.
    it('sair pede confirmação antes de encerrar', async () => {
      await abrirMenu();

      await act(async () => {
        fireEvent.press(screen.getByText('Sair'));
      });

      expect(mockShowConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Sair da conta', destructive: true }),
      );
      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it('confirmar encerra a sessão', async () => {
      await abrirMenu();
      await act(async () => {
        fireEvent.press(screen.getByText('Sair'));
      });

      await act(async () => {
        await mockShowConfirm.mock.calls[0][0].onConfirm();
      });

      expect(mockSignOut).toHaveBeenCalled();
    });
  });
});
