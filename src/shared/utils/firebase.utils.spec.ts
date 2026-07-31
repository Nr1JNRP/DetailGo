import { mapFirebaseAuthError, mapFirestoreError } from './firebase.utils';

describe('mapFirebaseAuthError', () => {
  it.each([
    ['auth/invalid-email', 'E-mail inválido.'],
    ['auth/user-not-found', 'E-mail ou senha inválidos.'],
    ['auth/wrong-password', 'E-mail ou senha inválidos.'],
    ['auth/invalid-credential', 'E-mail ou senha inválidos.'],
    ['auth/email-already-in-use', 'Este e-mail já está em uso.'],
    ['auth/network-request-failed', 'Sem conexão. Verifique sua internet e tente novamente.'],
    ['auth/user-disabled', 'Esta conta foi desativada.'],
  ])('traduz %s', (code, message) => {
    expect(mapFirebaseAuthError(code)).toBe(message);
  });

  it('usa o fallback para código desconhecido', () => {
    expect(mapFirebaseAuthError('auth/unknown', 'Erro ao criar conta.')).toBe(
      'Erro ao criar conta.',
    );
    expect(mapFirebaseAuthError(undefined)).toBe('Ocorreu um erro. Tente novamente.');
  });

  it('nunca vaza o código cru em inglês', () => {
    expect(mapFirebaseAuthError('auth/too-many-requests')).not.toContain('auth/');
  });
});

describe('mapFirestoreError', () => {
  it('traduz códigos conhecidos', () => {
    expect(mapFirestoreError({ code: 'permission-denied' })).toBe(
      'Você não tem permissão para isso.',
    );
    expect(mapFirestoreError({ code: 'not-found' })).toBe('Registro não encontrado.');
  });

  it('cai na mensagem do erro ou no fallback genérico', () => {
    expect(mapFirestoreError({ message: 'boom' })).toBe('boom');
    expect(mapFirestoreError({})).toBe('Erro ao processar operação. Tente novamente.');
  });
});
