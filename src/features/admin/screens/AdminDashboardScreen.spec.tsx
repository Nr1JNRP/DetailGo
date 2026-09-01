// Lição das telas anteriores: tudo que a tela usa como dependência de
// useCallback/useFocusEffect precisa ser ESTÁVEL entre renders. Um objeto ou
// função nova a cada render reexecuta o efeito sem parar e o teste estoura a
// memória em vez de falhar com mensagem útil.

const mockOnSnapshot = jest.fn();
const mockGetDocs = jest.fn();
// A tela chama getFirestore() a cada render e usa o resultado como dependência
// de useCallback. Em produção o Firebase devolve sempre a mesma instância; o
// mock precisa imitar isso, senão a tela fica presa recarregando.
const mockDb = {};

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => mockDb),
  collection: jest.fn((_db: unknown, ...path: unknown[]) => ({ path: path.join('/') })),
  doc: jest.fn((_db: unknown, ...path: unknown[]) => ({ path: path.join('/') })),
  query: jest.fn((ref: unknown, ...clauses: unknown[]) => ({ ref, clauses })),
  where: jest.fn((...args: unknown[]) => ({ tipo: 'where', args })),
  orderBy: jest.fn((...args: unknown[]) => ({ tipo: 'orderBy', args })),
  limit: jest.fn((n: number) => ({ tipo: 'limit', n })),
  startAfter: jest.fn((d: unknown) => ({ tipo: 'startAfter', d })),
  getDoc: jest.fn(async () => ({ data: () => ({}) })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  // Usado para contar os concluídos da semana anterior no cabeçalho.
  getCountFromServer: jest.fn(async () => ({ data: () => ({ count: 0 }) })),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  updateDoc: jest.fn(async () => undefined),
  setDoc: jest.fn(async () => undefined),
  serverTimestamp: jest.fn(() => 'ts'),
}));

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: { uid: 'owner-1', displayName: 'Bruno' } })),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => {
  const ReactLocal = require('react');
  return {
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
    useFocusEffect: (cb: () => void | (() => void)) => ReactLocal.useEffect(cb, [cb]),
  };
});

const mockUpdateAppointmentStatus = jest.fn();
jest.mock('@features/admin', () => ({
  updateAppointmentStatus: (...args: unknown[]) => mockUpdateAppointmentStatus(...args),
}));

const mockShowError = jest.fn();
const mockFeedbackApi = {
  showError: mockShowError,
  showSuccess: jest.fn(),
  showConfirm: jest.fn(),
};
jest.mock('@shared/components/FeedbackProvider', () => ({ useFeedback: () => mockFeedbackApi }));

const mockShopApi = {
  shop: { name: 'Tirac Auto Detail' },
  shopId: 'shop-1' as string | null,
  isInGrace: false,
};
jest.mock('@features/shops', () => ({
  useShop: () => mockShopApi,
  useShopServices: () => ({ items: [{ id: 'svc-1' }], loading: false }),
  GRACE_DAYS: 5,
}));

jest.mock('@features/auth', () => ({
  useMeStore: (selector: (s: unknown) => unknown) => selector({ me: null }),
}));

const mockNotificationsApi = { unreadCount: 0, items: [], loading: false };
jest.mock('@features/notifications', () => ({
  useShopNotifications: () => mockNotificationsApi,
  useRegisterPushToken: () => undefined,
}));

// A tela importa NO_SHOW_GRACE_MS do barrel '@features/appointments', que
// também reexporta AppointmentScreen — e essa arrasta o datetimepicker (ESM),
// que o Jest não transforma. Mockar o barrel corta essa corrente.
jest.mock('@features/appointments', () => ({
  NO_SHOW_GRACE_MS: jest.requireActual('@features/appointments/domain/appointment.constants')
    .NO_SHOW_GRACE_MS,
}));

const mockFetchCustomerName = jest.fn(async () => 'Ana Silva');
const mockCacheApi = { fetchCustomerName: mockFetchCustomerName };
jest.mock('@shared/hooks/useFirestoreCache', () => ({ useCustomerName: () => mockCacheApi }));

jest.mock('@shared/hooks/useNowTick', () => ({ useNowTick: () => 0 }));

const mockPullRefreshApi = { refreshControl: undefined, tick: 0 };
jest.mock('@shared/hooks/usePullRefresh', () => ({ usePullRefresh: () => mockPullRefreshApi }));

jest.mock('@shared/services/userPhoto.service', () => ({
  uploadProfilePhoto: jest.fn(async () => ({ ok: true })),
}));

jest.mock('react-native-image-picker', () => ({ launchImageLibrary: jest.fn(async () => ({})) }));

// O drawer tem testes próprios; aqui basta saber se foi aberto.
jest.mock('../components/AdminDrawer', () => {
  const ReactLocal = require('react');
  const RN = require('react-native');
  return ({ visible }: { visible: boolean }) =>
    visible ? ReactLocal.createElement(RN.Text, null, 'drawer-aberto') : null;
});

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';

import AdminDashboardScreen from './AdminDashboardScreen';

const HOJE = new Date(2026, 6, 15, 10, 0, 0);
const QUINZE_MIN = 15 * 60 * 1000;

const doc = (over: Record<string, unknown> = {}, id = 'appt-1') => ({
  id,
  data: () => ({
    startAtMs: HOJE.getTime() + 2 * 60 * 60 * 1000,
    endAtMs: HOJE.getTime() + 3 * 60 * 60 * 1000,
    customerUid: 'user-1',
    customerName: 'Ana Silva',
    serviceLabel: 'Polimento',
    price: 300,
    status: 'scheduled',
    vehicleType: 'Carro',
    carCategory: 'SUV',
    ...over,
  }),
});

/** Entrega documentos a todos os listeners registrados pela tela. */
async function emitir(docs: ReturnType<typeof doc>[]) {
  await act(async () => {
    for (const call of mockOnSnapshot.mock.calls) {
      await call[1]({ docs });
    }
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockShopApi.shopId = 'shop-1';
  mockShopApi.isInGrace = false;
  mockOnSnapshot.mockReturnValue(jest.fn());
  mockGetDocs.mockResolvedValue({ docs: [] });
  mockUpdateAppointmentStatus.mockResolvedValue(undefined);
  // A tela usa new Date() para o dia selecionado — espionar Date.now não
  // bastaria. Congelamos o relógio inteiro, mas mantemos os timers reais para
  // não travar o async do React.
  jest.useFakeTimers({
    now: HOJE.getTime(),
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
  jest.restoreAllMocks();
});

describe('AdminDashboardScreen', () => {
  it('mostra o aviso quando o dia não tem agendamentos', async () => {
    render(<AdminDashboardScreen />);
    await emitir([]);

    expect(screen.getByText('Sem agendamentos')).toBeTruthy();
    expect(screen.getByText('Nenhum serviço para este dia.')).toBeTruthy();
  });

  it('lista o agendamento do dia selecionado', async () => {
    render(<AdminDashboardScreen />);
    await emitir([doc()]);

    await waitFor(() => expect(screen.getByText('Polimento')).toBeTruthy());
  });

  it('abre as notificações da estética', async () => {
    render(<AdminDashboardScreen />);
    await emitir([]);

    fireEvent.press(screen.getByTestId('admin-notifications'));

    expect(mockNavigate).toHaveBeenCalledWith('AdminNotifications');
  });

  // O botão do card muda conforme o estado do agendamento — é o principal
  // ponto de decisão da tela do dono.
  describe('ação do agendamento', () => {
    it('agendamento futuro oferece iniciar atendimento', async () => {
      render(<AdminDashboardScreen />);
      await emitir([doc({ status: 'scheduled' })]);

      await waitFor(() => expect(screen.getByText('Iniciar atendimento')).toBeTruthy());
    });

    it('iniciar atendimento não pede confirmação', async () => {
      render(<AdminDashboardScreen />);
      await emitir([doc({ status: 'scheduled' })]);

      await act(async () => {
        fireEvent.press(screen.getByText('Iniciar atendimento'));
      });

      expect(mockUpdateAppointmentStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          shopId: 'shop-1',
          appointmentId: 'appt-1',
          status: 'in_progress',
        }),
      );
    });

    it('atendimento em andamento oferece concluir', async () => {
      render(<AdminDashboardScreen />);
      await emitir([doc({ status: 'in_progress' })]);

      await waitFor(() => expect(screen.getByText('Concluir serviço')).toBeTruthy());
    });

    it('concluir pede confirmação antes de gravar', async () => {
      render(<AdminDashboardScreen />);
      await emitir([doc({ status: 'in_progress' })]);

      await act(async () => {
        fireEvent.press(screen.getByText('Concluir serviço'));
      });

      expect(screen.getByText(/Finalizar Polimento/)).toBeTruthy();
      expect(mockUpdateAppointmentStatus).not.toHaveBeenCalled();
    });

    // Passada a tolerância, o dono não pode dizer que atendeu: a única saída
    // é registrar que o cliente não apareceu.
    it('agendamento vencido oferece marcar como não realizado', async () => {
      render(<AdminDashboardScreen />);
      await emitir([doc({ status: 'scheduled', startAtMs: HOJE.getTime() - QUINZE_MIN - 60_000 })]);

      await waitFor(() => expect(screen.getByText('Não realizado')).toBeTruthy());
    });

    it('marcar como não realizado pede confirmação', async () => {
      render(<AdminDashboardScreen />);
      await emitir([doc({ status: 'scheduled', startAtMs: HOJE.getTime() - QUINZE_MIN - 60_000 })]);

      await act(async () => {
        fireEvent.press(screen.getByText('Não realizado'));
      });

      expect(screen.getByText('Marcar não realizado')).toBeTruthy();
      expect(mockUpdateAppointmentStatus).not.toHaveBeenCalled();
    });

    it('grava o novo status ao confirmar', async () => {
      render(<AdminDashboardScreen />);
      await emitir([doc({ status: 'in_progress' })]);

      await act(async () => {
        fireEvent.press(screen.getByText('Concluir serviço'));
      });
      await act(async () => {
        fireEvent.press(screen.getByText('Concluir'));
      });

      expect(mockUpdateAppointmentStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'done' }),
      );
    });

    it('cancelar a confirmação não grava nada', async () => {
      render(<AdminDashboardScreen />);
      await emitir([doc({ status: 'in_progress' })]);

      await act(async () => {
        fireEvent.press(screen.getByText('Concluir serviço'));
      });
      await act(async () => {
        fireEvent.press(screen.getByText('Cancelar'));
      });

      expect(mockUpdateAppointmentStatus).not.toHaveBeenCalled();
    });
  });

  describe('retorno da atualização', () => {
    it('confirma o início do atendimento', async () => {
      render(<AdminDashboardScreen />);
      await emitir([doc({ status: 'scheduled' })]);

      await act(async () => {
        fireEvent.press(screen.getByText('Iniciar atendimento'));
      });

      await waitFor(() => expect(screen.getByText('Atendimento iniciado.')).toBeTruthy());
    });

    it('fecha a confirmação de sucesso no Ok', async () => {
      render(<AdminDashboardScreen />);
      await emitir([doc({ status: 'scheduled' })]);

      await act(async () => {
        fireEvent.press(screen.getByText('Iniciar atendimento'));
      });
      await waitFor(() => expect(screen.getByText('Atendimento iniciado.')).toBeTruthy());

      await act(async () => {
        fireEvent.press(screen.getByText('Ok'));
      });

      expect(screen.queryByText('Atendimento iniciado.')).toBeNull();
    });

    it('traduz o erro de agendamento expirado', async () => {
      // A trava vem do serviço; a tela precisa explicar o motivo ao dono.
      mockUpdateAppointmentStatus.mockRejectedValueOnce({ code: 'APPOINTMENT_EXPIRED' });

      render(<AdminDashboardScreen />);
      await emitir([doc({ status: 'scheduled' })]);

      await act(async () => {
        fireEvent.press(screen.getByText('Iniciar atendimento'));
      });

      expect(mockShowError).toHaveBeenCalledWith('Agendamento expirado.');
    });

    it('mostra mensagem genérica nos demais erros', async () => {
      mockUpdateAppointmentStatus.mockRejectedValueOnce(new Error('offline'));

      render(<AdminDashboardScreen />);
      await emitir([doc({ status: 'scheduled' })]);

      await act(async () => {
        fireEvent.press(screen.getByText('Iniciar atendimento'));
      });

      expect(mockShowError).toHaveBeenCalledWith('Não foi possível atualizar.');
    });
  });

  it('ignora toques repetidos enquanto grava', async () => {
    // Sem essa guarda, tocar duas vezes dispararia duas gravações — e o dono
    // veria o feedback piscar duas vezes para o mesmo atendimento.
    let liberar: (() => void) | undefined;
    mockUpdateAppointmentStatus.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          liberar = () => resolve();
        }),
    );

    render(<AdminDashboardScreen />);
    await emitir([doc({ status: 'scheduled' })]);

    const botao = screen.getByText('Iniciar atendimento');
    await act(async () => {
      fireEvent.press(botao);
    });
    await act(async () => {
      fireEvent.press(botao);
    });

    expect(mockUpdateAppointmentStatus).toHaveBeenCalledTimes(1);

    await act(async () => {
      liberar?.();
    });
  });

  describe('navegação de semana e dia', () => {
    it('mostra os sete dias da semana', async () => {
      render(<AdminDashboardScreen />);
      await emitir([]);

      ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'].forEach(d => {
        expect(screen.getByText(d)).toBeTruthy();
      });
    });

    it('avança e volta uma semana', async () => {
      render(<AdminDashboardScreen />);
      await emitir([]);

      // 15/07/2026 é quarta; a semana começa no domingo, dia 12.
      expect(screen.getByText('12')).toBeTruthy();

      await act(async () => {
        fireEvent.press(screen.getByTestId('week-next'));
      });
      expect(screen.getByText('19')).toBeTruthy();

      await act(async () => {
        fireEvent.press(screen.getByTestId('week-prev'));
      });
      expect(screen.getByText('12')).toBeTruthy();
    });

    it('trocar de dia troca a lista mostrada', async () => {
      render(<AdminDashboardScreen />);
      // Agendamento na quinta (16/07), enquanto o dia selecionado é quarta.
      await emitir([doc({ startAtMs: new Date(2026, 6, 16, 10, 0).getTime() })]);

      expect(screen.getByText('Sem agendamentos')).toBeTruthy();

      await act(async () => {
        fireEvent.press(screen.getByText('QUI'));
      });

      await waitFor(() => expect(screen.getByText('Polimento')).toBeTruthy());
    });
  });

  describe('foto do perfil', () => {
    it('não faz upload quando o usuário cancela a seleção', async () => {
      const { launchImageLibrary } = require('react-native-image-picker');
      const { uploadProfilePhoto } = require('@shared/services/userPhoto.service');
      launchImageLibrary.mockResolvedValueOnce({ didCancel: true });

      render(<AdminDashboardScreen />);
      await emitir([]);

      await act(async () => {
        fireEvent.press(screen.getByTestId('admin-avatar'));
      });

      expect(uploadProfilePhoto).not.toHaveBeenCalled();
    });

    it('envia a foto escolhida', async () => {
      const { launchImageLibrary } = require('react-native-image-picker');
      const { uploadProfilePhoto } = require('@shared/services/userPhoto.service');
      launchImageLibrary.mockResolvedValueOnce({ assets: [{ uri: 'file://foto.jpg' }] });
      uploadProfilePhoto.mockResolvedValueOnce({ ok: true });

      render(<AdminDashboardScreen />);
      await emitir([]);

      await act(async () => {
        fireEvent.press(screen.getByTestId('admin-avatar'));
      });

      expect(uploadProfilePhoto).toHaveBeenCalledWith('owner-1', 'file://foto.jpg');
    });

    it('mostra o motivo quando o upload é recusado', async () => {
      const { launchImageLibrary } = require('react-native-image-picker');
      const { uploadProfilePhoto } = require('@shared/services/userPhoto.service');
      launchImageLibrary.mockResolvedValueOnce({ assets: [{ uri: 'file://foto.jpg' }] });
      uploadProfilePhoto.mockResolvedValueOnce({ ok: false, message: 'Imagem muito grande' });

      render(<AdminDashboardScreen />);
      await emitir([]);

      await act(async () => {
        fireEvent.press(screen.getByTestId('admin-avatar'));
      });

      expect(mockShowError).toHaveBeenCalledWith('Imagem muito grande');
    });

    it('avisa quando a seleção da imagem falha', async () => {
      const { launchImageLibrary } = require('react-native-image-picker');
      launchImageLibrary.mockRejectedValueOnce(new Error('sem permissão'));

      render(<AdminDashboardScreen />);
      await emitir([]);

      await act(async () => {
        fireEvent.press(screen.getByTestId('admin-avatar'));
      });

      expect(mockShowError).toHaveBeenCalledWith('Não foi possível atualizar a foto');
    });
  });

  describe('cumprimento pelo horário', () => {
    it.each([
      [9, 'BOM DIA'],
      [14, 'BOA TARDE'],
      [20, 'BOA NOITE'],
    ])('às %i horas mostra %s', async (hora, texto) => {
      jest.setSystemTime(new Date(2026, 6, 15, hora, 0, 0));

      render(<AdminDashboardScreen />);
      await emitir([]);

      expect(screen.getByText(texto)).toBeTruthy();
    });
  });

  describe('menu lateral', () => {
    it('abre e fecha o drawer', async () => {
      render(<AdminDashboardScreen />);
      await emitir([]);

      expect(screen.queryByText('drawer-aberto')).toBeNull();

      await act(async () => {
        fireEvent.press(screen.getByTestId('admin-menu'));
      });
      expect(screen.getByText('drawer-aberto')).toBeTruthy();

      // Fechar depende do callback da animação de saída.
      await act(async () => {
        fireEvent.press(screen.getByTestId('admin-menu'));
      });
      await waitFor(() => expect(screen.queryByText('drawer-aberto')).toBeNull());
    });
  });

  it('mostra carregamento enquanto não há usuário', async () => {
    const { getAuth } = require('@react-native-firebase/auth');
    // getAuth é chamado a cada render — mockReturnValueOnce não bastaria.
    getAuth.mockReturnValue({ currentUser: null });

    try {
      render(<AdminDashboardScreen />);

      // A tela sai cedo com um indicador de carregamento: nada da interface
      // do dono aparece antes de haver sessão.
      expect(screen.queryByText('DETAILGO')).toBeNull();
      expect(screen.queryByText('Sem agendamentos')).toBeNull();
      expect(screen.UNSAFE_getAllByType(require('react-native').ActivityIndicator).length).toBe(1);
    } finally {
      getAuth.mockReturnValue({ currentUser: { uid: 'owner-1', displayName: 'Bruno' } });
    }
  });

  it('separa os agendamentos do mesmo dia', async () => {
    render(<AdminDashboardScreen />);
    await emitir([
      doc({}, 'appt-1'),
      doc(
        { serviceLabel: 'Enceramento', startAtMs: HOJE.getTime() + 4 * 60 * 60 * 1000 },
        'appt-2',
      ),
    ]);

    await waitFor(() => expect(screen.getByText('Polimento')).toBeTruthy());
    expect(screen.getByText('Enceramento')).toBeTruthy();
  });

  // Agendamentos antigos gravam só "Cliente"; a tela busca o nome real e
  // aproveita para corrigir o documento, evitando a busca nas próximas vezes.
  describe('nome do cliente ausente', () => {
    it('busca o nome e regrava no agendamento', async () => {
      const { updateDoc } = require('@react-native-firebase/firestore');

      render(<AdminDashboardScreen />);
      await emitir([doc({ customerName: 'Cliente' })]);

      await waitFor(() => expect(mockFetchCustomerName).toHaveBeenCalledWith('user-1'));
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ customerName: 'Ana Silva' }),
      );
    });

    it('falha ao regravar não quebra a lista', async () => {
      const { updateDoc } = require('@react-native-firebase/firestore');
      updateDoc.mockRejectedValueOnce(new Error('permission-denied'));

      render(<AdminDashboardScreen />);
      await emitir([doc({ customerName: 'Cliente', serviceLabel: 'Polimento' })]);

      await waitFor(() => expect(screen.getByText('Polimento')).toBeTruthy());
    });
  });

  it('erro no listener encerra o carregamento', async () => {
    render(<AdminDashboardScreen />);

    await act(async () => {
      mockOnSnapshot.mock.calls[0][2]?.(new Error('permission-denied'));
    });

    // Sai do spinner e mostra o estado vazio em vez de travar carregando.
    await waitFor(() => expect(screen.getByText('Sem agendamentos')).toBeTruthy());
  });

  it('falha na contagem da semana anterior não quebra a tela', async () => {
    const { getCountFromServer } = require('@react-native-firebase/firestore');
    getCountFromServer.mockRejectedValueOnce(new Error('offline'));

    render(<AdminDashboardScreen />);
    await emitir([]);

    expect(screen.getByText('Sem agendamentos')).toBeTruthy();
  });

  it('não registra listener sem shop definido', async () => {
    mockShopApi.shopId = null;

    render(<AdminDashboardScreen />);

    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  // Durante a carência o dono entra direto no painel e nunca passa pela tela de
  // assinatura. Sem este aviso aqui, ele perderia o acesso no sexto dia sem
  // nenhuma pista de que a cobrança falhou. Já aconteceu em teste manual.
  describe('cobrança pendente', () => {
    it('não aparece quando está tudo em dia', async () => {
      render(<AdminDashboardScreen />);
      await emitir([]);

      expect(screen.queryByTestId('aviso-carencia')).toBeNull();
    });

    it('avisa no painel quando o pagamento falhou', async () => {
      mockShopApi.isInGrace = true;

      render(<AdminDashboardScreen />);
      await emitir([]);

      expect(screen.getByTestId('aviso-carencia')).toBeTruthy();
      expect(screen.getByText('Pagamento pendente')).toBeTruthy();
    });

    // Aviso sem saída é só ansiedade: tem que levar para onde se resolve.
    it('leva para a tela de assinatura ao tocar', async () => {
      mockShopApi.isInGrace = true;

      render(<AdminDashboardScreen />);
      await emitir([]);

      fireEvent.press(screen.getByTestId('aviso-carencia'));

      expect(mockNavigate).toHaveBeenCalledWith('SubscriptionRenew');
    });
  });
});
