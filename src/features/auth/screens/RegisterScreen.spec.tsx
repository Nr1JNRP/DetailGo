import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import RegisterScreen from './RegisterScreen';

// Mocks específicos desta tela (os nativos vêm do jest.setup.js).
const mockRegister = jest.fn();
const mockNavigate = jest.fn();
const mockShowError = jest.fn();
const mockShowSuccess = jest.fn();

jest.mock('@features/auth', () => ({
  useAuth: () => ({ register: mockRegister }),
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

jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn(),
  requestAuthorization: jest.fn(),
}));

const VALID = {
  firstName: 'Ana',
  lastName: 'Silva',
  email: 'ana@teste.com',
  phone: '11999998888',
  password: '123456',
};

function selectCustomer() {
  fireEvent.press(screen.getByText('Cliente'));
}

function fillCustomerForm({ password = VALID.password, confirm = VALID.password } = {}) {
  fireEvent.changeText(screen.getByPlaceholderText('Nome'), VALID.firstName);
  fireEvent.changeText(screen.getByPlaceholderText('Sobrenome'), VALID.lastName);
  fireEvent.changeText(screen.getByPlaceholderText('seu@email.com'), VALID.email);
  fireEvent.changeText(screen.getByPlaceholderText('(11) 91234-5678'), VALID.phone);
  fireEvent.changeText(screen.getByPlaceholderText('mínimo 6 caracteres'), password);
  fireEvent.changeText(screen.getByPlaceholderText('repita a senha'), confirm);
}

describe('RegisterScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // mockReset limpa também a fila de mockResolvedValueOnce (clearAllMocks não),
    // evitando que um valor não consumido vaze para o próximo teste.
    mockRegister.mockReset();
  });

  it('mostra a seleção de tipo de conta (cliente e dono)', () => {
    render(<RegisterScreen />);

    expect(screen.getByText('Cliente')).toBeTruthy();
    expect(screen.getByText('Dono de estética')).toBeTruthy();
  });

  it('ao escolher Cliente, mostra o formulário de cadastro', () => {
    render(<RegisterScreen />);
    selectCustomer();

    expect(screen.getByPlaceholderText('seu@email.com')).toBeTruthy();
    expect(screen.getByPlaceholderText('repita a senha')).toBeTruthy();
  });

  it('bloqueia o cadastro quando as senhas não conferem', async () => {
    mockRegister.mockResolvedValueOnce({ ok: true });
    render(<RegisterScreen />);
    selectCustomer();
    fillCustomerForm({ password: '123456', confirm: '1234567' });

    fireEvent.press(screen.getByTestId('register-submit'));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(
        expect.stringContaining('senhas não conferem'),
        expect.objectContaining({ title: 'Senhas diferentes' }),
      );
    });
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('cria a conta de cliente quando o formulário é válido', async () => {
    mockRegister.mockResolvedValueOnce({ ok: true });
    render(<RegisterScreen />);
    selectCustomer();
    fillCustomerForm();

    fireEvent.press(screen.getByTestId('register-submit'));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: VALID.firstName,
          lastName: VALID.lastName,
          email: VALID.email,
          password: VALID.password,
          role: 'customer',
        }),
      );
    });
  });

  it('mostra feedback de sucesso após criar a conta', async () => {
    mockRegister.mockResolvedValueOnce({ ok: true });
    render(<RegisterScreen />);
    selectCustomer();
    fillCustomerForm();

    fireEvent.press(screen.getByTestId('register-submit'));

    await waitFor(() => {
      expect(mockShowSuccess).toHaveBeenCalled();
    });
  });

  it('mostra erro quando o cadastro falha no service', async () => {
    mockRegister.mockResolvedValueOnce({ ok: false, message: 'Este e-mail já está em uso.' });
    render(<RegisterScreen />);
    selectCustomer();
    fillCustomerForm();

    fireEvent.press(screen.getByTestId('register-submit'));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('Este e-mail já está em uso.');
    });
  });

  it('não chama register com o formulário incompleto (botão desabilitado)', () => {
    render(<RegisterScreen />);
    selectCustomer();
    // Preenche só o nome — os demais campos obrigatórios ficam vazios.
    fireEvent.changeText(screen.getByPlaceholderText('Nome'), VALID.firstName);

    fireEvent.press(screen.getByTestId('register-submit'));

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('navega para o login ao tocar em "Fazer login"', () => {
    render(<RegisterScreen />);

    fireEvent.press(screen.getByText('Fazer login'));

    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });

  it('ao escolher Dono, mostra o campo da estética e o passo de localização', () => {
    render(<RegisterScreen />);

    fireEvent.press(screen.getByText('Dono de estética'));

    expect(screen.getByPlaceholderText('Ex: Tirac Auto Detailing')).toBeTruthy();
    expect(screen.getByText('Próximo · Localização')).toBeTruthy();
  });

  it('bloqueia o dono no passo de localização quando as senhas não conferem', async () => {
    render(<RegisterScreen />);
    fireEvent.press(screen.getByText('Dono de estética'));

    fireEvent.changeText(screen.getByPlaceholderText('Ex: Tirac Auto Detailing'), 'Tirac Detail');
    fireEvent.changeText(screen.getByPlaceholderText('Nome'), VALID.firstName);
    fireEvent.changeText(screen.getByPlaceholderText('Sobrenome'), VALID.lastName);
    fireEvent.changeText(screen.getByPlaceholderText('seu@email.com'), VALID.email);
    fireEvent.changeText(screen.getByPlaceholderText('(11) 91234-5678'), VALID.phone);
    fireEvent.changeText(screen.getByPlaceholderText('mínimo 6 caracteres'), '123456');
    fireEvent.changeText(screen.getByPlaceholderText('repita a senha'), '999999');

    fireEvent.press(screen.getByTestId('register-submit'));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(
        expect.stringContaining('senhas não conferem'),
        expect.objectContaining({ title: 'Senhas diferentes' }),
      );
    });
  });
});
