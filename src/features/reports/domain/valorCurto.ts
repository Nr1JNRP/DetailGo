/**
 * Dinheiro sem centavos, para os três números do topo.
 *
 * O `currencyCompact` compartilhado devolve "R$ 4280.00" — dezoito caracteres
 * num cartão que tem um terço da largura da tela, e o texto encolhe até virar
 * ilegível. Num resumo de mês os centavos não mudam decisão nenhuma; o que
 * importa é a ordem de grandeza.
 *
 * Arredonda para o inteiro mais próximo e separa milhar com ponto, como se
 * escreve em português.
 */
export function valorCurto(valor: number): string {
  if (!Number.isFinite(valor)) return 'R$ 0';

  const inteiro = Math.round(valor);
  const negativo = inteiro < 0;
  const digitos = Math.abs(inteiro)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `R$ ${negativo ? '-' : ''}${digitos}`;
}
