import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import { DotStream } from './DotStream';

/** Estilo final de um ponto, com o array de estilos achatado. */
function estilo(ponto: any): Record<string, unknown> {
  return StyleSheet.flatten(ponto.props.style) as Record<string, unknown>;
}

/** Os pontos são as Animated.View da fileira. */
function pontos() {
  return screen.UNSAFE_getAllByType(Animated.View);
}

describe('DotStream', () => {
  it('mostra três pontos por padrão', () => {
    render(<DotStream />);

    expect(pontos()).toHaveLength(3);
  });

  it('respeita a quantidade pedida', () => {
    render(<DotStream count={5} />);

    expect(pontos()).toHaveLength(5);
  });

  it('usa o tamanho e a cor informados', () => {
    render(<DotStream count={1} size={6} color="#FF0000" />);

    expect(estilo(pontos()[0])).toMatchObject({
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#FF0000',
    });
  });

  // O primeiro ponto não leva margem: senão a fileira nasce deslocada.
  it('separa os pontos a partir do segundo', () => {
    render(<DotStream count={2} size={4} gap={10} />);

    const [primeiro, segundo] = pontos();
    expect(estilo(primeiro).marginLeft).toBeUndefined();
    expect(estilo(segundo).marginLeft).toBe(10);
  });

  // É decoração dentro de um card tocável — não pode roubar o toque.
  it('não captura toque', () => {
    render(<DotStream />);

    expect(screen.UNSAFE_getByProps({ pointerEvents: 'none' })).toBeTruthy();
  });

  it('para as animações ao desmontar', () => {
    const loop = jest.spyOn(Animated, 'loop');

    const { unmount } = render(<DotStream count={3} />);
    const paradas = loop.mock.results.map(r => jest.spyOn(r.value, 'stop'));
    unmount();

    paradas.forEach(stop => expect(stop).toHaveBeenCalled());
    loop.mockRestore();
  });
});
