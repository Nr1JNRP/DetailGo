import type { AdminAppointment } from '@features/admin';

export type ResumoDoMes = {
  servicos: number;
  faturamento: number;
  /** Média por serviço prestado, não por serviço com preço. */
  ticketMedio: number;
};

/**
 * Os três números do topo.
 *
 * O ticket médio divide pelo total de serviços, incluindo os sem preço. Dividir
 * só pelos que têm preço inflaria a média e daria ao dono um número melhor que
 * a realidade — o serviço sem preço aconteceu e ocupou a agenda igual.
 */
export function resumoDoMes(agendamentos: AdminAppointment[]): ResumoDoMes {
  const servicos = agendamentos.length;

  const faturamento = agendamentos.reduce(
    (soma, item) => soma + (typeof item.price === 'number' ? item.price : 0),
    0,
  );

  return {
    servicos,
    faturamento,
    ticketMedio: servicos === 0 ? 0 : faturamento / servicos,
  };
}
