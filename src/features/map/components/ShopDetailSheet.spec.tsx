const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import ShopDetailSheet from './ShopDetailSheet';
import type { NearbyShop } from '@features/shops/services/discoverShops.service';

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

const onClose = jest.fn();

function renderizar(over: Partial<NearbyShop> = {}) {
  return render(<ShopDetailSheet shop={estetica(over)} onClose={onClose} />);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ShopDetailSheet', () => {
  it('mostra nome, endereço e distância da estética', () => {
    renderizar();

    expect(screen.getByText('Tirac Auto Detail')).toBeTruthy();
    expect(screen.getByText('Rua das Flores, 100')).toBeTruthy();
    expect(screen.getByText('2.4km de você')).toBeTruthy();
  });

  // Nem toda estética cadastra endereço; a cidade evita um card sem referência
  // nenhuma de onde ela fica.
  it('sem endereço mostra a cidade', () => {
    renderizar({ address: '' });

    expect(screen.getByText('Recife')).toBeTruthy();
  });

  it('estética a menos de 1km aparece em metros', () => {
    renderizar({ distanceKm: 0.35 });

    expect(screen.getByText('350m de você')).toBeTruthy();
  });

  it('leva para o perfil da estética', () => {
    renderizar();

    fireEvent.press(screen.getByText('Ver detalhes da estética'));

    expect(mockNavigate).toHaveBeenCalledWith('ShopProfile', { shopId: 'shop-1' });
  });

  // O card fecha antes de navegar: voltando do perfil, o mapa não aparece com
  // o card de outra estética ainda aberto.
  it('fecha o card antes de navegar', () => {
    renderizar();

    fireEvent.press(screen.getByText('Ver detalhes da estética'));

    expect(onClose).toHaveBeenCalled();
  });

  it('fecha ao tocar no X', () => {
    renderizar();

    fireEvent.press(screen.getByTestId('shop-sheet-close'));

    expect(onClose).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // O card encosta na borda de baixo: no Android sem safe area ele precisa de
  // uma folga própria para não ficar embaixo da barra de navegação.
  it.each(['android', 'ios'])('reserva folga inferior no %s', plataforma => {
    const { Platform } = require('react-native');
    const original = Platform.OS;
    Platform.OS = plataforma;

    try {
      renderizar();

      expect(screen.getByText('Tirac Auto Detail')).toBeTruthy();
    } finally {
      Platform.OS = original;
    }
  });
});
