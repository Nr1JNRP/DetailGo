const mockSignOut = jest.fn();
const mockCurrentUser: { displayName: string | null } | null = { displayName: 'Bruno Tirac' };

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: mockCurrentUser })),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));
jest.mock('@react-native-firebase/firestore', () => new Proxy({}, { get: () => jest.fn() }));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const mockShowError = jest.fn();
jest.mock('@shared/components/FeedbackProvider', () => ({
  useFeedback: () => ({ showError: mockShowError, showSuccess: jest.fn(), showConfirm: jest.fn() }),
}));

const mockUseShop = jest.fn();
const mockUseShopServices = jest.fn();
jest.mock('@features/shops', () => ({
  useShop: () => mockUseShop(),
  useShopServices: () => mockUseShopServices(),
}));

const mockUseMeStore = jest.fn();
jest.mock('@features/auth', () => ({
  useMeStore: (selector: (s: unknown) => unknown) => mockUseMeStore(selector),
}));

import React from 'react';
import { Animated } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

import AdminDrawer from './AdminDrawer';

function renderDrawer(props: Partial<React.ComponentProps<typeof AdminDrawer>> = {}) {
  const onClose = jest.fn();
  const utils = render(
    <AdminDrawer
      visible
      slideAnim={new Animated.Value(0)}
      onClose={onClose}
      {...(props as object)}
    />,
  );
  return { ...utils, onClose };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentUser!.displayName = 'Bruno Tirac';
  mockUseShop.mockReturnValue({ shop: { name: 'Tirac Auto Detail' }, shopId: 'shop-1' });
  // Com serviços cadastrados o drawer não dispara o aviso de configuração.
  mockUseShopServices.mockReturnValue({ items: [{ id: 'svc-1' }], loading: false });
  mockUseMeStore.mockImplementation(selector => selector({ me: null }));
});

describe('AdminDrawer', () => {
  it('não renderiza nada quando está fechado', () => {
    renderDrawer({ visible: false });

    expect(screen.queryByText('Agendamentos')).toBeNull();
  });

  it('mostra o nome do dono e da estética', () => {
    renderDrawer();

    expect(screen.getByText('Bruno Tirac')).toBeTruthy();
    expect(screen.getByText('Tirac Auto Detail')).toBeTruthy();
  });

  it('usa textos padrão quando dono e loja não têm nome', () => {
    mockCurrentUser!.displayName = null;
    mockUseShop.mockReturnValue({ shop: null, shopId: 'shop-1' });

    renderDrawer();

    expect(screen.getByText('Proprietário')).toBeTruthy();
    expect(screen.getByText('Minha estética')).toBeTruthy();
  });

  it('mostra as iniciais do dono quando não há foto', () => {
    renderDrawer();

    expect(screen.getByText('BT')).toBeTruthy();
  });

  it('usa no máximo duas iniciais', () => {
    mockCurrentUser!.displayName = 'Jorge Nicholas Ribeiro Palma';

    renderDrawer();

    expect(screen.getByText('JN')).toBeTruthy();
  });

  it('mostra a foto no lugar das iniciais quando existe', () => {
    mockUseMeStore.mockImplementation(selector =>
      selector({ me: { photoURL: 'data:image/png;base64,abc' } }),
    );

    renderDrawer();

    expect(screen.queryByText('BT')).toBeNull();
  });

  // Cada item fecha o drawer antes de navegar: sem isso a gaveta fica aberta
  // sobre a tela nova.
  it.each([
    ['Agendamentos', 'AdminDashboard'],
    ['Histórico', 'AdminHistory'],
    ['Gerenciar loja', 'AdminManage'],
    ['Perfil', 'AdminProfile'],
  ] as const)('item %s navega para %s e fecha o drawer', (rotulo, rota) => {
    const { onClose } = renderDrawer();

    fireEvent.press(screen.getByText(rotulo));

    expect(onClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith(rota);
  });

  describe('sair da conta', () => {
    it('pede confirmação antes de deslogar', () => {
      renderDrawer();

      fireEvent.press(screen.getByText('Sair'));

      // Tocar no item só abre a confirmação; ninguém é deslogado por engano.
      expect(screen.getByText('Sair da conta')).toBeTruthy();
      expect(screen.getByText('Deseja realmente sair?')).toBeTruthy();
      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it('desloga ao confirmar', async () => {
      mockSignOut.mockResolvedValueOnce(undefined);
      const { onClose } = renderDrawer();

      fireEvent.press(screen.getByText('Sair'));
      // O rótulo 'Sair' aparece no item do menu e no botão do modal.
      fireEvent.press(screen.getAllByText('Sair')[1]);
      await Promise.resolve();

      expect(onClose).toHaveBeenCalled();
      expect(mockSignOut).toHaveBeenCalled();
    });

    it('avisa quando o logout falha', async () => {
      mockSignOut.mockRejectedValueOnce(new Error('sem rede'));
      renderDrawer();

      fireEvent.press(screen.getByText('Sair'));
      fireEvent.press(screen.getAllByText('Sair')[1]);
      await Promise.resolve();
      await Promise.resolve();

      expect(mockShowError).toHaveBeenCalledWith('Falha ao sair da conta.');
    });

    it('desistir fecha a confirmação sem deslogar', async () => {
      const { onClose } = renderDrawer();

      fireEvent.press(screen.getByText('Sair'));
      expect(screen.getByText('Sair da conta')).toBeTruthy();

      fireEvent.press(screen.getByText('Cancelar'));

      expect(screen.queryByText('Deseja realmente sair?')).toBeNull();
      expect(mockSignOut).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('aviso de serviços não cadastrados', () => {
    // Estética sem serviço não recebe agendamento: o dono precisa saber disso
    // logo ao abrir o menu, não quando estranhar a agenda vazia.
    it('avisa quando a estética não tem serviços', () => {
      mockUseShopServices.mockReturnValue({ items: [], loading: false });

      renderDrawer();

      expect(screen.getByText('Sem serviços cadastrados')).toBeTruthy();
    });

    it('leva para a gestão da loja ao confirmar', () => {
      mockUseShopServices.mockReturnValue({ items: [], loading: false });
      const { onClose } = renderDrawer();

      // 'Gerenciar loja' está no menu e no botão do modal.
      fireEvent.press(screen.getAllByText('Gerenciar loja')[1]);

      expect(onClose).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('AdminManage');
    });

    it('não avisa enquanto os serviços ainda estão carregando', () => {
      mockUseShopServices.mockReturnValue({ items: [], loading: true });

      renderDrawer();

      expect(screen.queryByText('Sem serviços cadastrados')).toBeNull();
    });

    it('não avisa quando já existem serviços', () => {
      renderDrawer();

      expect(screen.queryByText('Sem serviços cadastrados')).toBeNull();
    });

    it('"Agora não" fecha o aviso sem sair da tela', () => {
      mockUseShopServices.mockReturnValue({ items: [], loading: false });
      const { onClose } = renderDrawer();

      fireEvent.press(screen.getByText('Agora não'));

      expect(screen.queryByText('Sem serviços cadastrados')).toBeNull();
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
