import type { AdminAppointment } from '@features/admin';

import { rankearClientes } from './clientes';
import { agruparPorServico } from './serviceReport';
import { agruparPorVeiculo } from './veiculos';

export type Destaque = {
  /** O que a linha responde: "Serviço campeão", "Cliente do mês". */
  rotulo: string;
  /** O vencedor. */
  nome: string;
  /** Quantas vezes — já formatado como "12x". */
  contagem: string;
};

export type DestaquesDoMes = {
  servico: Destaque | null;
  veiculo: Destaque | null;
  cliente: Destaque | null;
};

/**
 * As três respostas que o dono quer em três segundos, antes de olhar gráfico
 * nenhum: o que ele mais faz, que veículo mais entra na estética e quem mais
 * voltou no mês.
 *
 * Cada uma é `null` quando não há dado — a tela esconde a linha em vez de
 * mostrar um campeão inventado a partir de nada.
 */
export function destaquesDoMes(agendamentos: AdminAppointment[]): DestaquesDoMes {
  const servicos = agruparPorServico(agendamentos);
  const veiculos = agruparPorVeiculo(agendamentos);
  const clientes = rankearClientes(agendamentos, 1);

  return {
    servico: servicos[0]
      ? {
          rotulo: 'Serviço campeão',
          nome: servicos[0].servico,
          contagem: `${servicos[0].quantidade}x`,
        }
      : null,
    veiculo: veiculos[0]
      ? {
          rotulo: 'Veículo mais atendido',
          nome: veiculos[0].rotulo,
          contagem: `${veiculos[0].quantidade}x`,
        }
      : null,
    cliente: clientes[0]
      ? {
          rotulo: 'Cliente do mês',
          nome: clientes[0].nome,
          contagem: `${clientes[0].visitas}x`,
        }
      : null,
  };
}
