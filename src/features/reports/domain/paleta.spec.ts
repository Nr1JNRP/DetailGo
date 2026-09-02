import { escalaDaPrimaria } from './paleta';

describe('escalaDaPrimaria', () => {
  it('devolve um tom por fatia', () => {
    expect(escalaDaPrimaria('#D4FF3D', 5)).toHaveLength(5);
  });

  it('começa opaco e vai clareando', () => {
    const tons = escalaDaPrimaria('#D4FF3D', 3);

    expect(tons[0]).toBe('rgba(212, 255, 61, 1)');
    expect(tons[2]).toBe('rgba(212, 255, 61, 0.28)');
  });

  // A última fatia precisa continuar visível contra o fundo do cartão.
  it('nunca chega perto de invisível', () => {
    const alphas = escalaDaPrimaria('#23B5D3', 8).map(t =>
      Number(t.split(',')[3].replace(')', '')),
    );

    expect(Math.min(...alphas)).toBeGreaterThanOrEqual(0.28);
  });

  it('usa a cor cheia quando há uma fatia só', () => {
    expect(escalaDaPrimaria('#23B5D3', 1)).toEqual(['rgba(35, 181, 211, 1)']);
  });

  it('aceita hex de três dígitos', () => {
    expect(escalaDaPrimaria('#FFF', 1)).toEqual(['rgba(255, 255, 255, 1)']);
  });

  it('aceita hex sem cerquilha', () => {
    expect(escalaDaPrimaria('D4FF3D', 1)).toEqual(['rgba(212, 255, 61, 1)']);
  });

  // Se a cor do tema mudar de formato, o gráfico fica de uma cor só em vez de
  // sumir da tela.
  it('cai para a cor original quando não consegue interpretar o hex', () => {
    expect(escalaDaPrimaria('rgb(1,2,3)', 2)).toEqual(['rgb(1,2,3)', 'rgb(1,2,3)']);
  });

  it('devolve lista vazia quando não há fatias', () => {
    expect(escalaDaPrimaria('#D4FF3D', 0)).toEqual([]);
  });
});
