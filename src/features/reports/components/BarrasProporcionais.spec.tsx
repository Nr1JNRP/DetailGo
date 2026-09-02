import React from 'react';
import { render, screen } from '@testing-library/react-native';

import BarrasProporcionais from './BarrasProporcionais';

/** A largura que o componente calculou para cada preenchimento. */
function larguras() {
  return screen
    .getByTestId('barras')
    .findAllByType('View' as never)
    .map(n => (n.props as { style?: { width?: string } }).style)
    .flatMap(s => (Array.isArray(s) ? s : [s]))
    .map(s => (s as { width?: string } | undefined)?.width)
    .filter((w): w is string => typeof w === 'string');
}

describe('BarrasProporcionais', () => {
  it('mostra rótulo e texto de cada barra', () => {
    render(
      <BarrasProporcionais
        testID="barras"
        barras={[
          { rotulo: 'Polimento Comercial', valor: 350, texto: 'R$ 350,00' },
          { rotulo: 'Lavagem Técnica', valor: 270, texto: 'R$ 270,00' },
        ]}
      />,
    );

    expect(screen.getByText('Polimento Comercial')).toBeTruthy();
    expect(screen.getByText('R$ 350,00')).toBeTruthy();
    expect(screen.getByText('Lavagem Técnica')).toBeTruthy();
  });

  it('dá 100% à maior barra e proporção às outras', () => {
    render(
      <BarrasProporcionais
        testID="barras"
        barras={[
          { rotulo: 'Maior', valor: 100, texto: '100' },
          { rotulo: 'Metade', valor: 50, texto: '50' },
        ]}
      />,
    );

    expect(larguras()).toEqual(['100%', '50%']);
  });

  // Uma estética que não preenche preço zera o faturamento inteiro. Sem a
  // guarda, o divisor vira zero e a largura vira NaN%, que o RN não desenha.
  it('não produz largura inválida quando todos os valores são zero', () => {
    render(
      <BarrasProporcionais
        testID="barras"
        barras={[
          { rotulo: 'Lavagem', valor: 0, texto: 'R$ 0,00' },
          { rotulo: 'Cera', valor: 0, texto: 'R$ 0,00' },
        ]}
      />,
    );

    const encontradas = larguras();
    expect(encontradas).toEqual(['0%', '0%']);
    expect(encontradas.some(w => w.includes('NaN'))).toBe(false);
  });

  // Um serviço que rende quase nada precisa continuar visível: uma barra de
  // 0,3% não desenha pixel nenhum e some do gráfico.
  it('garante largura mínima visível para a barra minúscula', () => {
    render(
      <BarrasProporcionais
        testID="barras"
        barras={[
          { rotulo: 'Gigante', valor: 10000, texto: '10000' },
          { rotulo: 'Minúsculo', valor: 1, texto: '1' },
        ]}
      />,
    );

    expect(larguras()).toEqual(['100%', '2%']);
  });

  it('não quebra com lista vazia', () => {
    render(<BarrasProporcionais testID="barras" barras={[]} />);

    expect(screen.getByTestId('barras')).toBeTruthy();
  });
});
