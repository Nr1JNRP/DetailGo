const ALPHA_MINIMO = 0.28;

function componentes(hex: string): [number, number, number] | null {
  const limpo = hex.trim().replace('#', '');
  const cheio =
    limpo.length === 3
      ? limpo
          .split('')
          .map(c => c + c)
          .join('')
      : limpo;

  if (!/^[0-9a-fA-F]{6}$/.test(cheio)) return null;

  return [
    parseInt(cheio.slice(0, 2), 16),
    parseInt(cheio.slice(2, 4), 16),
    parseInt(cheio.slice(4, 6), 16),
  ];
}

/**
 * Tons de uma cor só, do mais forte ao mais fraco.
 *
 * Um tom por fatia, derivado da cor primária do tema em vez de uma lista fixa
 * de cores: no tema claro a primária é outra, e uma paleta chumbada ficaria
 * brigando com o resto do app. Uma matiz só também evita o gráfico arco-íris,
 * em que a cor sugere categoria onde só existe ordem.
 *
 * A opacidade nunca chega perto de zero — a última fatia precisa continuar
 * visível contra o fundo do cartão.
 */
export function escalaDaPrimaria(primaria: string, quantidade: number): string[] {
  if (quantidade <= 0) return [];

  const rgb = componentes(primaria);
  if (!rgb) return Array.from({ length: quantidade }, () => primaria);

  const [r, g, b] = rgb;
  if (quantidade === 1) return [`rgba(${r}, ${g}, ${b}, 1)`];

  const passo = (1 - ALPHA_MINIMO) / (quantidade - 1);

  return Array.from({ length: quantidade }, (_, i) => {
    const alpha = Number((1 - passo * i).toFixed(3));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  });
}
