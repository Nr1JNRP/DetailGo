export function mapFirebaseAuthError(
  code?: string,
  fallback = 'Ocorreu um erro. Tente novamente.',
): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'E-mail inválido.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'E-mail ou senha inválidos.';
    case 'auth/email-already-in-use':
      return 'Este e-mail já está em uso.';
    case 'auth/weak-password':
      return 'A senha é muito fraca (mínimo 6 caracteres).';
    case 'auth/invalid-credential':
      return 'E-mail ou senha inválidos.';
    case 'auth/network-request-failed':
      return 'Sem conexão. Verifique sua internet e tente novamente.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
    case 'auth/user-disabled':
      return 'Esta conta foi desativada.';
    case 'permission-denied':
      return 'Sem permissão para acessar o banco de dados.';
    default:
      return fallback;
  }
}

export function mapFirestoreError(error: any): string {
  const code = error?.code || '';
  switch (code) {
    case 'permission-denied':
      return 'Você não tem permissão para isso.';
    case 'not-found':
      return 'Registro não encontrado.';
    case 'deadline-exceeded':
      return 'Tempo limite excedido. Tente novamente.';
    default:
      return error?.message || 'Erro ao processar operação. Tente novamente.';
  }
}
