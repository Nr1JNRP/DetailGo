import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';

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

const mockGetCurrentPosition = jest.fn();
jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: { getCurrentPosition: (...a: unknown[]) => mockGetCurrentPosition(...a) },
  getCurrentPosition: (...a: unknown[]) => mockGetCurrentPosition(...a),
  requestAuthorization: jest.fn(),
}));

const mockFetchCep = jest.fn();
jest.mock('@shared/utils/cep.utils', () => ({
  ...jest.requireActual('@shared/utils/cep.utils'),
  fetchCep: (...a: unknown[]) => mockFetchCep(...a),
}));

const mockGeocodeAddress = jest.fn();
const mockReverseGeocode = jest.fn();
jest.mock('@shared/utils/geo.utils', () => ({
  ...jest.requireActual('@shared/utils/geo.utils'),
  geocodeAddress: (...a: unknown[]) => mockGeocodeAddress(...a),
  reverseGeocode: (...a: unknown[]) => mockReverseGeocode(...a),
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

/** Preenche os dados pessoais e o nome da estética, no passo 1 do dono. */
function fillOwnerForm({ confirm = VALID.password } = {}) {
  fireEvent.changeText(screen.getByPlaceholderText('Ex: Tirac Auto Detailing'), 'Tirac Detail');
  fillCustomerForm({ confirm });
}

/** Vai do início até o passo de localização do dono. */
function goToLocationStep() {
  render(<RegisterScreen />);
  fireEvent.press(screen.getByText('Dono de estética'));
  fillOwnerForm();
  fireEvent.press(screen.getByTestId('register-submit'));
}

/** Faz o GPS responder com uma posição. */
function gpsResponde(lat = -8.05, lng = -34.9) {
  mockGetCurrentPosition.mockImplementation((onOk: (p: unknown) => void) =>
    onOk({ coords: { latitude: lat, longitude: lng } }),
  );
}

describe('RegisterScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    require('react-native').Platform.OS = 'ios';
    // mockReset limpa também a fila de mockResolvedValueOnce (clearAllMocks não),
    // evitando que um valor não consumido vaze para o próximo teste.
    mockRegister.mockReset();
    mockFetchCep.mockResolvedValue(null);
    mockGeocodeAddress.mockResolvedValue(null);
    mockReverseGeocode.mockResolvedValue(null);
    gpsResponde();
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

  describe('navegação entre os passos', () => {
    it('dono com o formulário válido avança para a localização', () => {
      goToLocationStep();

      expect(screen.getByText('Onde fica sua estética?')).toBeTruthy();
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('a seta volta do formulário para a escolha de perfil', () => {
      render(<RegisterScreen />);
      fireEvent.press(screen.getByText('Cliente'));

      fireEvent.press(screen.UNSAFE_getAllByType(require('react-native').TouchableOpacity)[0]);

      expect(screen.getByText('Dono de estética')).toBeTruthy();
    });

    // Voltar da localização não pode perder os dados já digitados.
    it('a seta volta da localização para o formulário com os dados', () => {
      goToLocationStep();

      fireEvent.press(screen.UNSAFE_getAllByType(require('react-native').TouchableOpacity)[0]);

      expect(screen.getByPlaceholderText('Ex: Tirac Auto Detailing').props.value).toBe(
        'Tirac Detail',
      );
      expect(screen.getByPlaceholderText('seu@email.com').props.value).toBe(VALID.email);
    });
  });

  describe('busca de endereço pelo CEP', () => {
    async function digitarCep(cep: string) {
      goToLocationStep();
      await act(async () => {
        fireEvent.changeText(screen.getByPlaceholderText('00000-000'), cep);
      });
    }

    it('CEP completo preenche endereço e cidade', async () => {
      mockFetchCep.mockResolvedValue({
        logradouro: 'Rua das Flores',
        bairro: 'Boa Viagem',
        localidade: 'Recife',
        uf: 'PE',
      });

      await digitarCep('50000000');

      expect(mockFetchCep).toHaveBeenCalledWith('50000000');
      expect(screen.getByPlaceholderText('Rua, bairro (preenchido pelo CEP)').props.value).toBe(
        'Rua das Flores, Boa Viagem',
      );
      expect(screen.getByPlaceholderText('Cidade - UF (preenchido pelo CEP)').props.value).toBe(
        'Recife - PE',
      );
    });

    // CEP pela metade ainda está sendo digitado: consultar a cada tecla
    // gastaria requisição à toa e piscaria erro no meio da digitação.
    it('CEP incompleto não consulta nada', async () => {
      await digitarCep('50000');

      expect(mockFetchCep).not.toHaveBeenCalled();
    });

    it('CEP inexistente orienta a preencher na mão', async () => {
      mockFetchCep.mockResolvedValue(null);

      await digitarCep('99999999');

      expect(mockShowError).toHaveBeenCalledWith(
        expect.stringContaining('preencha o endereço manualmente'),
        expect.objectContaining({ title: 'CEP não encontrado' }),
      );
    });
  });

  describe('confirmar o endereço digitado', () => {
    /** Preenche endereço e cidade no passo de localização. */
    function preencherEndereco({ endereco = 'Rua das Flores', cidade = 'Recife - PE' } = {}) {
      goToLocationStep();
      fireEvent.changeText(
        screen.getByPlaceholderText('Rua, bairro (preenchido pelo CEP)'),
        endereco,
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Cidade - UF (preenchido pelo CEP)'),
        cidade,
      );
    }

    it('endereço encontrado confirma a localização', async () => {
      mockGeocodeAddress.mockResolvedValue({ lat: -8.05, lng: -34.9 });

      preencherEndereco();
      fireEvent.changeText(screen.getByPlaceholderText('Ex: 123, S/N'), '100');
      await act(async () => {
        fireEvent.press(screen.getByText('Confirmar endereço'));
      });

      expect(mockShowSuccess).toHaveBeenCalledWith(
        expect.stringContaining('Rua das Flores, 100'),
        expect.objectContaining({ title: 'Localização confirmada' }),
      );
      expect(screen.getByText(/Localização definida/)).toBeTruthy();
    });

    // O Nominatim tropeça em endereço brasileiro completo. A tela tenta do mais
    // específico para o mais simples em vez de desistir na primeira falha.
    it('tenta variações do endereço até achar', async () => {
      mockGeocodeAddress.mockResolvedValueOnce(null).mockResolvedValue({ lat: -8, lng: -34 });

      preencherEndereco({ endereco: 'Rua das Flores, Boa Viagem' });
      await act(async () => {
        fireEvent.press(screen.getByText('Confirmar endereço'));
      });

      expect(mockGeocodeAddress.mock.calls.length).toBeGreaterThan(1);
      expect(mockShowSuccess).toHaveBeenCalled();
    });

    it('endereço não encontrado sugere usar o GPS', async () => {
      mockGeocodeAddress.mockResolvedValue(null);

      preencherEndereco();
      await act(async () => {
        fireEvent.press(screen.getByText('Confirmar endereço'));
      });

      expect(mockShowError).toHaveBeenCalledWith(
        expect.stringContaining('Usar minha localização atual'),
        expect.objectContaining({ title: 'Endereço não encontrado' }),
      );
    });

    it('sem endereço nem cidade pede os dados antes de buscar', async () => {
      goToLocationStep();

      await act(async () => {
        fireEvent.press(screen.getByText('Confirmar endereço'));
      });

      expect(mockGeocodeAddress).not.toHaveBeenCalled();
      expect(mockShowError).toHaveBeenCalledWith(
        'Preencha o CEP ou o endereço da estética.',
        expect.objectContaining({ title: 'Atenção' }),
      );
    });
  });

  describe('usar a localização atual', () => {
    async function tocarNoGps() {
      await act(async () => {
        fireEvent.press(screen.getByText('Usar minha localização atual'));
      });
    }

    it('o GPS preenche endereço, cidade e CEP', async () => {
      mockReverseGeocode.mockResolvedValue({
        address: 'Av. Boa Viagem, 500',
        city: 'Recife - PE',
        cep: '51020000',
      });

      goToLocationStep();
      await tocarNoGps();

      expect(screen.getByPlaceholderText('Rua, bairro (preenchido pelo CEP)').props.value).toBe(
        'Av. Boa Viagem, 500',
      );
      expect(screen.getByPlaceholderText('00000-000').props.value).toBe('51020-000');
      expect(mockShowSuccess).toHaveBeenCalledWith(
        expect.stringContaining('Av. Boa Viagem, 500'),
        expect.objectContaining({ title: 'Localização obtida!' }),
      );
    });

    // Sem reverse geocode ainda dá para seguir: as coordenadas são o que
    // importa para o mapa, o texto é só rótulo.
    it('sem reverse geocode usa um rótulo genérico', async () => {
      mockReverseGeocode.mockResolvedValue(null);

      goToLocationStep();
      await tocarNoGps();

      expect(screen.getByText(/Localização atual/)).toBeTruthy();
    });

    it('GPS desligado explica o motivo', async () => {
      mockGetCurrentPosition.mockImplementation(
        (_ok: unknown, onErr: (e: { message: string }) => void) => onErr({ message: 'timeout' }),
      );

      goToLocationStep();
      await tocarNoGps();

      expect(mockShowError).toHaveBeenCalledWith(
        expect.stringContaining('GPS está ativado'),
        expect.objectContaining({ title: 'GPS indisponível' }),
      );
    });

    it('Android sem permissão não chega no GPS', async () => {
      const { PermissionsAndroid, Platform } = require('react-native');
      Platform.OS = 'android';
      jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('denied');

      goToLocationStep();
      await tocarNoGps();

      expect(mockGetCurrentPosition).not.toHaveBeenCalled();
      expect(mockShowError).toHaveBeenCalledWith(
        'Não foi possível acessar sua localização.',
        expect.objectContaining({ title: 'Permissão negada' }),
      );
    });

    it('Android com permissão usa o GPS', async () => {
      const { PermissionsAndroid, Platform } = require('react-native');
      Platform.OS = 'android';
      jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('granted');

      goToLocationStep();
      await tocarNoGps();

      expect(mockGetCurrentPosition).toHaveBeenCalled();
    });

    it('falha ao pedir permissão é tratada como negada', async () => {
      const { PermissionsAndroid, Platform } = require('react-native');
      Platform.OS = 'android';
      jest.spyOn(PermissionsAndroid, 'request').mockRejectedValue(new Error('sem diálogo'));

      goToLocationStep();
      await tocarNoGps();

      expect(mockGetCurrentPosition).not.toHaveBeenCalled();
      expect(mockShowError).toHaveBeenCalledWith(
        'Não foi possível acessar sua localização.',
        expect.objectContaining({ title: 'Permissão negada' }),
      );
    });
  });

  describe('criação da conta de dono', () => {
    /** Vai até a localização e confirma pelo GPS. */
    async function comLocalizacao() {
      mockReverseGeocode.mockResolvedValue({ address: 'Av. Boa Viagem', city: 'Recife - PE' });
      goToLocationStep();
      await act(async () => {
        fireEvent.press(screen.getByText('Usar minha localização atual'));
      });
    }

    it('cria a estética com nome e localização', async () => {
      mockRegister.mockResolvedValue({ ok: true });

      await comLocalizacao();
      await act(async () => {
        fireEvent.press(screen.getByText('Criar estética e conta'));
      });

      expect(mockRegister).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'owner',
          shopName: 'Tirac Detail',
          shopLocation: expect.objectContaining({ lat: -8.05, lng: -34.9, city: 'Recife - PE' }),
        }),
      );
    });

    it('avisa sobre os 7 dias grátis ao criar a estética', async () => {
      mockRegister.mockResolvedValue({ ok: true });

      await comLocalizacao();
      await act(async () => {
        fireEvent.press(screen.getByText('Criar estética e conta'));
      });

      expect(mockShowSuccess).toHaveBeenCalledWith(
        expect.stringContaining('7 dias grátis'),
        expect.objectContaining({ title: 'Estética criada!' }),
      );
    });

    // Depois de criar, a tela volta ao início — senão o próximo cadastro
    // começaria com os dados do anterior.
    it('cadastro concluído volta para a escolha de perfil', async () => {
      mockRegister.mockResolvedValue({ ok: true });

      await comLocalizacao();
      await act(async () => {
        fireEvent.press(screen.getByText('Criar estética e conta'));
      });

      expect(screen.getByText('Como você usa o DetailGo?')).toBeTruthy();
    });

    it('sem localização o botão fica bloqueado', () => {
      goToLocationStep();

      fireEvent.press(screen.getByText('Criar estética e conta'));

      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('erro do service mantém a tela de localização', async () => {
      mockRegister.mockResolvedValue({ ok: false, message: 'Este e-mail já está em uso.' });

      await comLocalizacao();
      await act(async () => {
        fireEvent.press(screen.getByText('Criar estética e conta'));
      });

      expect(mockShowError).toHaveBeenCalledWith('Este e-mail já está em uso.');
      expect(screen.getByText('Onde fica sua estética?')).toBeTruthy();
    });

    it('erro sem mensagem cai no texto padrão', async () => {
      mockRegister.mockResolvedValue({ ok: false });

      await comLocalizacao();
      await act(async () => {
        fireEvent.press(screen.getByText('Criar estética e conta'));
      });

      expect(mockShowError).toHaveBeenCalledWith('Falha ao cadastrar');
    });
  });

  describe('campos do formulário', () => {
    it('o telefone é exibido com máscara e enviado só com dígitos', async () => {
      mockRegister.mockResolvedValue({ ok: true });
      render(<RegisterScreen />);
      selectCustomer();
      fillCustomerForm();

      expect(screen.getByPlaceholderText('(11) 91234-5678').props.value).toBe('(11) 99999-8888');

      fireEvent.press(screen.getByTestId('register-submit'));

      await waitFor(() =>
        expect(mockRegister).toHaveBeenCalledWith(
          expect.objectContaining({ phone: '11999998888' }),
        ),
      );
    });

    it.each([
      ['password-toggle', 'mínimo 6 caracteres'],
      ['confirm-toggle', 'repita a senha'],
    ])('o olho %s revela e esconde o campo', (botao, placeholder) => {
      render(<RegisterScreen />);
      selectCustomer();
      expect(screen.getByPlaceholderText(placeholder).props.secureTextEntry).toBe(true);

      fireEvent.press(screen.getByTestId(botao));
      expect(screen.getByPlaceholderText(placeholder).props.secureTextEntry).toBe(false);

      fireEvent.press(screen.getByTestId(botao));
      expect(screen.getByPlaceholderText(placeholder).props.secureTextEntry).toBe(true);
    });

    // Senhas iguais passam pela primeira checagem, mas o e-mail inválido ainda
    // barra: as duas validações são independentes.
    it('e-mail inválido não cria a conta', async () => {
      render(<RegisterScreen />);
      selectCustomer();
      fillCustomerForm();
      fireEvent.changeText(screen.getByPlaceholderText('seu@email.com'), 'nao-e-email');

      await act(async () => {
        fireEvent.press(screen.getByTestId('register-submit'));
      });

      expect(mockRegister).not.toHaveBeenCalled();
    });

    // A mensagem embaixo do campo precisa das duas coisas: o campo tocado
    // (blur) e o erro, que só nasce na validação do envio.
    it('erro do campo aparece depois do blur e do envio', async () => {
      render(<RegisterScreen />);
      fireEvent.press(screen.getByText('Dono de estética'));
      fillOwnerForm();

      const email = screen.getByPlaceholderText('seu@email.com');
      fireEvent.changeText(email, 'nao-e-email');
      fireEvent(email, 'blur');
      [
        'Ex: Tirac Auto Detailing',
        'Nome',
        'Sobrenome',
        '(11) 91234-5678',
        'mínimo 6 caracteres',
        'repita a senha',
      ].forEach(p => fireEvent(screen.getByPlaceholderText(p), 'blur'));

      await act(async () => {
        fireEvent.press(screen.getByTestId('register-submit'));
      });

      expect(screen.getByText('E-mail inválido')).toBeTruthy();
      expect(screen.queryByText('Onde fica sua estética?')).toBeNull();
    });

    it('sair dos campos de endereço também acusa', () => {
      goToLocationStep();

      [
        '00000-000',
        'Rua, bairro (preenchido pelo CEP)',
        'Ex: 123, S/N',
        'Cidade - UF (preenchido pelo CEP)',
      ].forEach(p => fireEvent(screen.getByPlaceholderText(p), 'blur'));

      expect(screen.getByText('Onde fica sua estética?')).toBeTruthy();
    });

    it('o rodapé do formulário também leva ao login', () => {
      render(<RegisterScreen />);
      selectCustomer();

      fireEvent.press(screen.getByText('Fazer login'));

      expect(mockNavigate).toHaveBeenCalledWith('Login');
    });
  });
});
