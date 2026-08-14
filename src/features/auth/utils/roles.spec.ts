import { isOwner, isCustomer } from './roles';

// O papel decide qual app o usuário vê. Um valor estranho vindo do Firestore
// não pode virar dono por acidente.
describe('papéis do usuário', () => {
  it.each([
    ['owner', true, false],
    ['customer', false, true],
  ])('%s é reconhecido', (role, dono, cliente) => {
    expect(isOwner(role)).toBe(dono);
    expect(isCustomer(role)).toBe(cliente);
  });

  it.each([
    ['sem papel', undefined],
    ['papel nulo', null],
    ['string vazia', ''],
    ['papel desconhecido', 'admin'],
    ['maiúscula', 'OWNER'],
  ])('%s não é nem dono nem cliente', (_nome, role) => {
    expect(isOwner(role)).toBe(false);
    expect(isCustomer(role)).toBe(false);
  });
});
