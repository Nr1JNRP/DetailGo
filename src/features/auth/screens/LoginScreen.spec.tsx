import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { darkColors } from '@shared/theme';

import LoginScreen from './LoginScreen';

// Mocks especificos desta tela (o resto — nativos — vem do jest.setup.js).
const mockSignIn = jest.fn();
const mockNavigate = jest.fn();
const mockShowError = jest.fn();
const mockShowSuccess = jest.fn();

jest.mock('@features/auth', () => ({
  useAuth: () => ({ signIn: mockSignIn }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('@shared/components/FeedbackProvider', () => ({
  useFeedback: () => ({
    showError: mockShowError,
    showSuccess: mockShowSuccess,
    showConfirm: jest.fn(),
  }),
}));

const VALID_EMAIL = 'jorge@detailgo.com';
const VALID_PASSWORD = 'senha123';

function fillValidForm() {
  fireEvent.changeText(screen.getByPlaceholderText('seu@email.com'), VALID_EMAIL);
  fireEvent.changeText(screen.getByPlaceholderText('••••••••'), VALID_PASSWORD);
}

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renderiza os campos de e-mail, senha e o botão Entrar', () => {
    render(<LoginScreen />);

    expect(screen.getByText('E-mail')).toBeTruthy();
    expect(screen.getByText('Senha')).toBeTruthy();
    expect(screen.getByText('Entrar')).toBeTruthy();
  });

  it('não chama signIn quando o formulário está inválido', () => {
    render(<LoginScreen />);

    fireEvent.press(screen.getByText('Entrar'));

    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('chama signIn com e-mail e senha quando o formulário é válido', async () => {
    mockSignIn.mockResolvedValueOnce({ ok: true });
    render(<LoginScreen />);

    fillValidForm();
    fireEvent.press(screen.getByText('Entrar'));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith(VALID_EMAIL, VALID_PASSWORD);
    });
  });

  it('mostra modal de erro quando o login falha', async () => {
    mockSignIn.mockResolvedValueOnce({ ok: false, message: 'Email ou senha incorretos' });
    render(<LoginScreen />);

    fillValidForm();
    fireEvent.press(screen.getByText('Entrar'));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(
        'Email ou senha incorretos',
        expect.objectContaining({ title: 'Erro ao acessar' }),
      );
    });
  });

  it('navega para o cadastro ao tocar em "Criar agora"', () => {
    render(<LoginScreen />);

    fireEvent.press(screen.getByText('Criar agora'));

    expect(mockNavigate).toHaveBeenCalledWith('Register');
  });

  it('abre o modal de recuperar senha ao tocar em "Esqueceu?"', () => {
    render(<LoginScreen />);

    fireEvent.press(screen.getByText('Esqueceu?'));

    expect(mockShowSuccess).toHaveBeenCalledWith(
      'Enviaremos um link de recuperação para seu e-mail.',
      expect.objectContaining({ title: 'Recuperar senha' }),
    );
  });

  it('alterna mostrar/ocultar a senha ao tocar no olho', () => {
    render(<LoginScreen />);
    const senha = screen.getByPlaceholderText('••••••••');

    // Começa mascarada
    expect(senha.props.secureTextEntry).toBe(true);

    fireEvent.press(screen.getByTestId('toggle-password'));
    expect(senha.props.secureTextEntry).toBe(false); // revelada

    fireEvent.press(screen.getByTestId('toggle-password'));
    expect(senha.props.secureTextEntry).toBe(true); // mascarada de novo
  });

  it('destaca a senha em erro só depois do blur (touched) quando inválida', () => {
    render(<LoginScreen />);
    const senha = screen.getByPlaceholderText('••••••••');
    const field = screen.getByTestId('password-field');
    const errorStyle = { borderColor: darkColors.accent };

    // Digita uma senha inválida (< 6) — ainda sem erro, pois não saiu do campo
    fireEvent.changeText(senha, '123');
    expect(field).not.toHaveStyle(errorStyle);

    // Sai do campo (blur) → agora sim marca o erro
    fireEvent(senha, 'blur');
    expect(field).toHaveStyle(errorStyle);
  });
});
