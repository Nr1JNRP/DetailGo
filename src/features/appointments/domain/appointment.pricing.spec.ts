import {
  getBasePriceForAppointment,
  CAR_BASE_PRICE_BY_CATEGORY,
  MOTO_BASE_PRICE,
} from './appointment.pricing';

describe('getBasePriceForAppointment', () => {
  it('moto tem preço fixo, independente de categoria', () => {
    expect(getBasePriceForAppointment('Moto', null)).toBe(MOTO_BASE_PRICE);
    expect(getBasePriceForAppointment('Moto', 'Hatch')).toBe(MOTO_BASE_PRICE);
  });

  it.each([
    ['Hatch', 80],
    ['Sedan', 85],
    ['SUV', 90],
    ['Picape cabine dupla', 110],
  ] as const)('carro %s → R$ %d', (categoria, preco) => {
    expect(getBasePriceForAppointment('Carro', categoria)).toBe(preco);
  });

  it('retorna null sem tipo de veículo', () => {
    expect(getBasePriceForAppointment(null, 'Hatch')).toBeNull();
  });

  it('retorna null para carro sem categoria', () => {
    expect(getBasePriceForAppointment('Carro', null)).toBeNull();
  });

  it('a tabela de preços bate com as constantes', () => {
    expect(CAR_BASE_PRICE_BY_CATEGORY.Hatch).toBe(80);
    expect(CAR_BASE_PRICE_BY_CATEGORY['Picape cabine dupla']).toBe(110);
    expect(MOTO_BASE_PRICE).toBe(70);
  });
});
