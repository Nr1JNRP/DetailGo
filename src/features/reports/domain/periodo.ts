const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/** Mês que o relatório está mostrando. `mes` é 0-11, como no Date. */
export type Periodo = { ano: number; mes: number };

export type LimitesDoMes = { inicioMs: number; fimMs: number };

export function periodoAtual(agora = Date.now()): Periodo {
  const d = new Date(agora);
  return { ano: d.getFullYear(), mes: d.getMonth() };
}

/**
 * Início do mês e início do mês seguinte, em milissegundos locais.
 *
 * O fim é exclusivo de propósito: com `startAtMs < fimMs` não existe a dúvida
 * do último milissegundo do mês, que um fim inclusivo mal calculado perde ou
 * conta duas vezes na virada.
 */
export function limitesDoMes({ ano, mes }: Periodo): LimitesDoMes {
  return {
    inicioMs: new Date(ano, mes, 1, 0, 0, 0, 0).getTime(),
    fimMs: new Date(ano, mes + 1, 1, 0, 0, 0, 0).getTime(),
  };
}

/** O Date normaliza mês 12 para janeiro do ano seguinte, e -1 para dezembro. */
export function mesAnterior({ ano, mes }: Periodo): Periodo {
  const d = new Date(ano, mes - 1, 1);
  return { ano: d.getFullYear(), mes: d.getMonth() };
}

export function mesSeguinte({ ano, mes }: Periodo): Periodo {
  const d = new Date(ano, mes + 1, 1);
  return { ano: d.getFullYear(), mes: d.getMonth() };
}

/** "Setembro" no ano corrente, "Setembro de 2025" em qualquer outro. */
export function rotuloDoPeriodo(periodo: Periodo, agora = Date.now()): string {
  const nome = MESES[periodo.mes] ?? '';
  const anoAtual = new Date(agora).getFullYear();
  return periodo.ano === anoAtual ? nome : `${nome} de ${periodo.ano}`;
}

export function ehMesCorrente(periodo: Periodo, agora = Date.now()): boolean {
  const atual = periodoAtual(agora);
  return periodo.ano === atual.ano && periodo.mes === atual.mes;
}
