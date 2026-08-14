const mockAnimateToRegion = jest.fn();
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MapView = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ animateToRegion: mockAnimateToRegion }));
    return React.createElement(View, { testID: 'map', ...props });
  });
  return {
    __esModule: true,
    default: MapView,
    Marker: (props: any) => React.createElement(View, props),
    PROVIDER_GOOGLE: 'google',
  };
});

const mockGetCurrentPosition = jest.fn();
jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: { getCurrentPosition: (...a: unknown[]) => mockGetCurrentPosition(...a) },
}));

const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, canGoBack: mockCanGoBack, navigate: jest.fn() }),
}));

const mockShowError = jest.fn();
const mockFeedbackApi = {
  showError: mockShowError,
  showSuccess: jest.fn(),
  showConfirm: jest.fn(),
};
jest.mock('@shared/components/FeedbackProvider', () => ({ useFeedback: () => mockFeedbackApi }));

const mockDiscover = jest.fn();
jest.mock('@features/shops/services/discoverShops.service', () => ({
  discoverNearbyShops: (...a: unknown[]) => mockDiscover(...a),
}));

import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react-native';

import MapScreen from './MapScreen';
import type { NearbyShop } from '@features/shops/services/discoverShops.service';

const POSICAO = { coords: { latitude: -8.05, longitude: -34.9 } };

const estetica = (over: Partial<NearbyShop> = {}): NearbyShop => ({
  id: 'shop-1',
  name: 'Tirac Auto Detail',
  lat: -8.05,
  lng: -34.9,
  address: 'Rua das Flores, 100',
  city: 'Recife',
  distanceKm: 2.4,
  ...over,
});

/** Faz o GPS responder com sucesso. */
function gpsResponde(pos = POSICAO) {
  mockGetCurrentPosition.mockImplementation((onOk: (p: unknown) => void) => onOk(pos));
}

/** Faz o GPS falhar com o código informado (1 = permissão negada). */
function gpsFalha(code: number) {
  mockGetCurrentPosition.mockImplementation((_ok: unknown, onErr: (e: { code: number }) => void) =>
    onErr({ code }),
  );
}

async function renderizar() {
  const utils = render(<MapScreen />);
  await act(async () => {
    await Promise.resolve();
  });
  return utils;
}

/** Concede ou nega a permissão de localização do Android. */
function permissaoAndroid(resultado: 'granted' | 'denied') {
  const { PermissionsAndroid, Platform } = require('react-native');
  Platform.OS = 'android';
  jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(resultado);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  require('react-native').Platform.OS = 'ios';
  mockCanGoBack.mockReturnValue(true);
  mockDiscover.mockResolvedValue([estetica()]);
  gpsResponde();
});

describe('MapScreen', () => {
  it('busca as estéticas ao redor da posição do usuário', async () => {
    await renderizar();

    expect(mockDiscover).toHaveBeenCalledWith({ lat: -8.05, lng: -34.9 }, 50);
    await waitFor(() => expect(screen.getByText('1 encontrada')).toBeTruthy());
  });

  it('centraliza o mapa na posição do usuário', async () => {
    await renderizar();

    expect(mockAnimateToRegion).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: -8.05, longitude: -34.9 }),
    );
  });

  describe('contador do cabeçalho', () => {
    it('nenhuma estética por perto', async () => {
      mockDiscover.mockResolvedValue([]);

      await renderizar();

      await waitFor(() => expect(screen.getByText('Nenhuma próxima')).toBeTruthy());
    });

    it('mais de uma vai para o plural', async () => {
      mockDiscover.mockResolvedValue([estetica({ id: 'a' }), estetica({ id: 'b' })]);

      await renderizar();

      await waitFor(() => expect(screen.getByText('2 encontradas')).toBeTruthy());
    });

    it('mostra carregamento enquanto busca', async () => {
      mockDiscover.mockReturnValue(new Promise(() => {}));

      await renderizar();

      expect(
        screen.UNSAFE_getAllByType(require('react-native').ActivityIndicator).length,
      ).toBeGreaterThan(0);
    });
  });

  describe('permissão de localização', () => {
    // Sem localização não há o que mostrar: a tela precisa dizer o motivo, não
    // ficar num mapa vazio sem explicação.
    it('GPS negado explica o motivo', async () => {
      gpsFalha(1);

      await renderizar();

      expect(mockShowError).toHaveBeenCalledWith(
        expect.stringMatching(/localiza(ç|c)(ã|a)o/i),
        expect.objectContaining({ title: 'Permissão negada' }),
      );
    });

    // Erro de GPS que não é permissão (sinal fraco, timeout) não vira alerta:
    // só encerra o carregamento e deixa o mapa no fallback.
    it('outro erro de GPS não alerta', async () => {
      gpsFalha(2);

      await renderizar();

      expect(mockShowError).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.getByText('Nenhuma próxima')).toBeTruthy());
    });

    it('Android sem permissão orienta a liberar nas configurações', async () => {
      permissaoAndroid('denied');

      await renderizar();

      expect(mockGetCurrentPosition).not.toHaveBeenCalled();
      expect(mockShowError).toHaveBeenCalledWith(
        expect.stringMatching(/configura(ç|c)(õ|o)es do celular/i),
        expect.objectContaining({ title: 'Localização necessária' }),
      );
    });

    it('Android com permissão busca a posição', async () => {
      permissaoAndroid('granted');

      await renderizar();

      expect(mockGetCurrentPosition).toHaveBeenCalled();
      expect(mockDiscover).toHaveBeenCalled();
    });

    it('falha ao pedir permissão não trava a tela', async () => {
      const { PermissionsAndroid, Platform } = require('react-native');
      Platform.OS = 'android';
      jest.spyOn(PermissionsAndroid, 'request').mockRejectedValue(new Error('sem diálogo'));

      await renderizar();

      await waitFor(() => expect(screen.getByText('Nenhuma próxima')).toBeTruthy());
      expect(mockShowError).not.toHaveBeenCalled();
    });
  });

  it('avisa quando a busca de estéticas falha', async () => {
    mockDiscover.mockRejectedValue(new Error('offline'));

    await renderizar();

    await waitFor(() =>
      expect(mockShowError).toHaveBeenCalledWith('Não foi possível buscar estéticas próximas.'),
    );
  });

  describe('botões flutuantes', () => {
    it('recarregar busca a posição de novo', async () => {
      await renderizar();
      mockGetCurrentPosition.mockClear();

      await act(async () => {
        fireEvent.press(screen.getByTestId('map-refresh'));
      });

      expect(mockGetCurrentPosition).toHaveBeenCalled();
    });

    it('centralizar volta o mapa para o usuário', async () => {
      await renderizar();
      mockAnimateToRegion.mockClear();

      await act(async () => {
        fireEvent.press(screen.getByTestId('map-center'));
      });

      expect(mockAnimateToRegion).toHaveBeenCalledWith(
        expect.objectContaining({ latitude: -8.05, longitude: -34.9 }),
      );
    });

    // Sem posição conhecida não há para onde centralizar.
    it('centralizar sem posição não faz nada', async () => {
      gpsFalha(1);

      await renderizar();
      mockAnimateToRegion.mockClear();

      await act(async () => {
        fireEvent.press(screen.getByTestId('map-center'));
      });

      expect(mockAnimateToRegion).not.toHaveBeenCalled();
    });
  });

  describe('card da estética', () => {
    /** Toca no marcador da estética no mapa. */
    async function tocarNoMarcador() {
      await waitFor(() => expect(screen.getByText('1 encontrada')).toBeTruthy());
      const { Pressable } = require('react-native');
      const marcador = screen
        .UNSAFE_getAllByType(require('react-native').View)
        .find(v => typeof v.props.onPress === 'function' && v.props.coordinate);
      await act(async () => {
        marcador!.props.onPress();
      });
      return Pressable;
    }

    it('tocar no marcador abre o card da estética', async () => {
      await renderizar();

      await tocarNoMarcador();

      expect(screen.getByText('Ver detalhes da estética')).toBeTruthy();
    });

    it('fechar o card tira ele da tela', async () => {
      await renderizar();
      await tocarNoMarcador();

      await act(async () => {
        fireEvent.press(screen.getByTestId('shop-sheet-close'));
      });

      expect(screen.queryByText('Ver detalhes da estética')).toBeNull();
    });
  });

  describe('voltar', () => {
    it('volta ao tocar na seta', async () => {
      await renderizar();

      fireEvent.press(screen.getByTestId('map-back'));

      expect(mockGoBack).toHaveBeenCalled();
    });

    // Aberto como tela inicial não há para onde voltar: a seta some em vez de
    // ficar lá sem fazer nada.
    it('sem histórico não mostra a seta', async () => {
      mockCanGoBack.mockReturnValue(false);

      await renderizar();

      expect(screen.queryByTestId('map-back')).toBeNull();
      expect(screen.getByTestId('map-refresh')).toBeTruthy();
    });
  });
});
