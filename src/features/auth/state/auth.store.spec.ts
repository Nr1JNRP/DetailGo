jest.mock('@react-native-firebase/auth', () => new Proxy({}, { get: () => jest.fn() }));

import { useAuthStore } from './auth.store';

const usuario = { uid: 'user-1' } as never;

beforeEach(() => {
  useAuthStore.setState({ user: null, initializing: true });
});

describe('auth.store', () => {
  // Começa inicializando: até o Firebase responder, a UI não pode decidir se
  // manda para o login ou para o app.
  it('começa sem usuário e inicializando', () => {
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().initializing).toBe(true);
  });

  it('guarda o usuário logado', () => {
    useAuthStore.getState().setUser(usuario);

    expect(useAuthStore.getState().user).toBe(usuario);
  });

  it('limpa o usuário no logout', () => {
    useAuthStore.getState().setUser(usuario);

    useAuthStore.getState().setUser(null);

    expect(useAuthStore.getState().user).toBeNull();
  });

  // Trocar o usuário não pode ligar o initializing de novo, senão a tela
  // volta para o carregamento no meio da sessão.
  it('guardar o usuário não mexe no initializing', () => {
    useAuthStore.getState().setUser(usuario);

    expect(useAuthStore.getState().initializing).toBe(true);
  });

  it('encerra a inicialização', () => {
    useAuthStore.getState().setInitializing(false);

    expect(useAuthStore.getState().initializing).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });
});
