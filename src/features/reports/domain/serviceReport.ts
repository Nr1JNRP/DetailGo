import type { AdminAppointment } from '@features/admin';

/** Uma barra do gráfico: um serviço, quantas vezes e quanto rendeu. */
export type LinhaDeServico = {
  servico: string;
  quantidade: number;
  faturamento: number;
};

const SEM_NOME = 'Sem serviço';

/**
 * Agrupa os agendamentos concluídos por serviço, do mais feito ao menos feito.
 *
 * Agrupa por `serviceLabel`, o nome copiado no ato do agendamento, e não pelo
 * id do catálogo: renomear um serviço não deve reescrever o passado. O efeito
 * colateral é que um serviço renomeado aparece como duas linhas, o que está
 * certo — foram dois nomes diferentes vendidos em momentos diferentes.
 *
 * Empate em quantidade desempata pelo faturamento, e depois pelo nome. Sem o
 * terceiro critério a ordem mudaria entre execuções com os mesmos dados, e o
 * dono veria o gráfico "se mexer" sozinho ao trocar de mês e voltar.
 */
export function agruparPorServico(agendamentos: AdminAppointment[]): LinhaDeServico[] {
  const porServico = new Map<string, LinhaDeServico>();

  for (const item of agendamentos) {
    const servico = item.serviceLabel?.trim() || SEM_NOME;
    const atual = porServico.get(servico);
    // Preço ausente conta como serviço feito, com zero de faturamento: o dono
    // fez o trabalho, e sumir com ele da contagem seria mentir sobre o volume.
    const valor = typeof item.price === 'number' ? item.price : 0;

    if (atual) {
      atual.quantidade += 1;
      atual.faturamento += valor;
    } else {
      porServico.set(servico, { servico, quantidade: 1, faturamento: valor });
    }
  }

  return [...porServico.values()].sort(
    (a, b) =>
      b.quantidade - a.quantidade ||
      b.faturamento - a.faturamento ||
      a.servico.localeCompare(b.servico, 'pt-BR'),
  );
}

export function totalDeServicos(linhas: LinhaDeServico[]): number {
  return linhas.reduce((soma, l) => soma + l.quantidade, 0);
}

/** Os mesmos serviços, agora do que mais rende ao que menos rende. */
export function ordenarPorFaturamento(linhas: LinhaDeServico[]): LinhaDeServico[] {
  return [...linhas].sort(
    (a, b) =>
      b.faturamento - a.faturamento ||
      b.quantidade - a.quantidade ||
      a.servico.localeCompare(b.servico, 'pt-BR'),
  );
}

function porcentagem(parte: number, todo: number): number {
  return Math.round((parte / todo) * 100);
}

/**
 * A frase que explica por que existem dois gráficos de serviço.
 *
 * O serviço que mais ocupa a agenda quase nunca é o que mais paga as contas, e
 * essa diferença é a decisão de negócio escondida nos dados. Quando os dois são
 * o mesmo serviço, ou quando não há o que comparar, devolve null e a tela
 * simplesmente não mostra frase nenhuma — inventar um texto para todo caso seria
 * ruído.
 */
export function insightDeFaturamento(linhas: LinhaDeServico[]): string | null {
  if (linhas.length < 2) return null;

  const totalQuantidade = totalDeServicos(linhas);
  const totalFaturamento = linhas.reduce((soma, l) => soma + l.faturamento, 0);
  if (totalQuantidade === 0 || totalFaturamento === 0) return null;

  const maisFeito = linhas[0];
  const queMaisRende = ordenarPorFaturamento(linhas)[0];
  if (maisFeito.servico === queMaisRende.servico) return null;

  const fatiaDoTrabalho = porcentagem(queMaisRende.quantidade, totalQuantidade);
  const fatiaDoDinheiro = porcentagem(queMaisRende.faturamento, totalFaturamento);

  return `O ${queMaisRende.servico} é ${fatiaDoTrabalho}% do que você faz e traz ${fatiaDoDinheiro}% do faturamento.`;
}
