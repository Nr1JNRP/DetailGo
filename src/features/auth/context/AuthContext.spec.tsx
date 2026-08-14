const mockSubscribeAuth = jest.fn();
const mockSignIn = jest.fn();
const mockRegister = jest.fn();
const mockSignOutUser = jest.fn();

jest.mock('../services/auth.service', () => ({
  subscribeAuth: (...a: unknown[]) => mockSubscribeAuth(...a),
  signIn: (...a: unknown[]) => mockSignIn(...a),
  register: (...a: unknown[]) => mockRegister(...a),
  signOutUser: (...a: unknown[]) => mockSignOutUser(...a),
}));

import React from 'react';
import { Text } from 'react-native';
import { render, screen, act, renderHook } from '@testing-library/react-native';

import { AuthProvider, useAuth } from './AuthContext';
import { useAuthStore } from '../state/auth.store';

const usuario = { uid: 'user-1', email: 'ana@teste.com' } as any;

beforeEach(() => {
  jest.clearAllMocks();
  mockSubscribeAuth.mockReturnValue(jest.fn());
  useAuthStore.setState({ user: null, initializing: true });
});

describe('AuthProvider', () => {
  it('renderiza os filhos', () => {
    render(
      <AuthProvider>
        <Text>conteúdo do app</Text>
      </AuthProvider>,
    );

    expect(screen.getByText('conteúdo do app')).toBeTruthy();
  });

  it('assina o auth ao montar', () => {
    render(
      <AuthProvider>
        <Text>app</Text>
      </AuthProvider>,
    );

    expect(mockSubscribeAuth).toHaveBeenCalledTimes(1);
  });

  it('grava o usuário no store quando a sessão chega', () => {
    render(
      <AuthProvider>
        <Text>app</Text>
      </AuthProvider>,
    );

    act(() => {
      mockSubscribeAuth.mock.calls[0][0](usuario);
    });

    expect(useAuthStore.getState().user).toEqual(usuario);
    // Só depois do primeiro retorno do Firebase é que a navegação pode
    // decidir para onde mandar o usuário.
    expect(useAuthStore.getState().initializing).toBe(false);
  });

  it('encerra a inicialização mesmo sem usuário logado', () => {
    render(
      <AuthProvider>
        <Text>app</Text>
      </AuthProvider>,
    );

    act(() => {
      mockSubscribeAuth.mock.calls[0][0](null);
    });

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().initializing).toBe(false);
  });

  it('cancela a assinatura ao desmontar', () => {
    const unsub = jest.fn();
    mockSubscribeAuth.mockReturnValueOnce(unsub);

    const { unmount } = render(
      <AuthProvider>
        <Text>app</Text>
      </AuthProvider>,
    );
    unmount();

    // Sem isso o listener continuaria vivo depois de sair da tela.
    expect(unsub).toHaveBeenCalled();
  });
});

describe('useAuth', () => {
  it('expõe usuário e estado de inicialização do store', () => {
    useAuthStore.setState({ user: usuario, initializing: false });

    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toEqual(usuario);
    expect(result.current.initializing).toBe(false);
  });

  // As ações devolvem sempre { ok } — a tela decide o que mostrar sem
  // precisar conhecer os códigos de erro do Firebase.
  describe('signIn', () => {
    it('devolve ok no sucesso', async () => {
      mockSignIn.mockResolvedValueOnce({ ok: true, user: usuario });
      const { result } = renderHook(() => useAuth());

      await expect(result.current.signIn('ana@teste.com', '123456')).resolves.toEqual({ ok: true });
      expect(mockSignIn).toHaveBeenCalledWith('ana@teste.com', '123456');
    });

    it('repassa a mensagem na falha', async () => {
      mockSignIn.mockResolvedValueOnce({ ok: false, message: 'Senha incorreta.' });
      const { result } = renderHook(() => useAuth());

      await expect(result.current.signIn('ana@teste.com', 'errada')).resolves.toEqual({
        ok: false,
        message: 'Senha incorreta.',
      });
    });
  });

  describe('register', () => {
    const dados = { email: 'ana@teste.com', password: '123456', role: 'customer' } as any;

    it('devolve ok no sucesso', async () => {
      mockRegister.mockResolvedValueOnce({ ok: true, user: usuario });
      const { result } = renderHook(() => useAuth());

      await expect(result.current.register(dados)).resolves.toEqual({ ok: true });
      expect(mockRegister).toHaveBeenCalledWith(dados);
    });

    it('repassa a mensagem na falha', async () => {
      mockRegister.mockResolvedValueOnce({ ok: false, message: 'E-mail já usado.' });
      const { result } = renderHook(() => useAuth());

      await expect(result.current.register(dados)).resolves.toEqual({
        ok: false,
        message: 'E-mail já usado.',
      });
    });
  });

  it('signOut chama o serviço', async () => {
    mockSignOutUser.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useAuth());

    await result.current.signOut();

    expect(mockSignOutUser).toHaveBeenCalled();
  });
});
