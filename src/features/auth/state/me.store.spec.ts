import { useMeStore, type MeDoc } from './me.store';

const me: MeDoc = { uid: 'user-1', firstName: 'Ana', role: 'customer', shopId: 'shop-1' };

beforeEach(() => {
  useMeStore.setState({ me: null, loadingMe: true });
});

describe('me.store', () => {
  it('começa vazio e carregando', () => {
    expect(useMeStore.getState().me).toBeNull();
    expect(useMeStore.getState().loadingMe).toBe(true);
  });

  // Receber o documento já encerra o carregamento: quem lê a store não precisa
  // desligar a flag na mão e arriscar deixar a tela presa no spinner.
  it('guardar o documento encerra o carregamento', () => {
    useMeStore.getState().setMe(me);

    expect(useMeStore.getState().me).toBe(me);
    expect(useMeStore.getState().loadingMe).toBe(false);
  });

  // Usuário sem documento em users/{uid} também é resposta: o listener chama
  // setMe(null) e a tela precisa sair do carregamento.
  it('documento inexistente também encerra o carregamento', () => {
    useMeStore.getState().setMe(null);

    expect(useMeStore.getState().me).toBeNull();
    expect(useMeStore.getState().loadingMe).toBe(false);
  });

  it('religar o carregamento não apaga o documento', () => {
    useMeStore.getState().setMe(me);

    useMeStore.getState().setLoadingMe(true);

    expect(useMeStore.getState().loadingMe).toBe(true);
    expect(useMeStore.getState().me).toBe(me);
  });

  // No logout o documento tem que sumir — senão o próximo usuário abre o app
  // com o nome e o shopId do anterior.
  it('reset limpa o documento e sai do carregamento', () => {
    useMeStore.getState().setMe(me);

    useMeStore.getState().reset();

    expect(useMeStore.getState().me).toBeNull();
    expect(useMeStore.getState().loadingMe).toBe(false);
  });
});
