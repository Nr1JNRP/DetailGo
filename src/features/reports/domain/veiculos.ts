import type { AdminAppointment } from '@features/admin';

export type LinhaDeVeiculo = {
  rotulo: string;
  quantidade: number;
};

const MOTO = 'Moto';
const CARRO_SEM_CATEGORIA = 'Carro';

/**
 * Rótulo do veículo de um agendamento.
 *
 * Moto vira uma faixa própria em vez de cair numa categoria de carro: moto não
 * tem Hatch nem SUV, e misturar as duas coisas daria um gráfico que não
 * descreve nada. Carro sem categoria informada aparece como "Carro" — some com
 * ele seria esconder atendimento que aconteceu.
 */
function rotuloDoVeiculo(item: AdminAppointment): string {
  if (item.vehicleType === MOTO) return MOTO;
  return item.carCategory?.trim() || CARRO_SEM_CATEGORIA;
}

/**
 * Quantos veículos de cada tipo entraram na estética, do mais ao menos comum.
 *
 * Empate desempata pelo rótulo, para a ordem não mudar entre execuções com os
 * mesmos dados.
 */
export function agruparPorVeiculo(agendamentos: AdminAppointment[]): LinhaDeVeiculo[] {
  const contagem = new Map<string, number>();

  for (const item of agendamentos) {
    const rotulo = rotuloDoVeiculo(item);
    contagem.set(rotulo, (contagem.get(rotulo) ?? 0) + 1);
  }

  return [...contagem.entries()]
    .map(([rotulo, quantidade]) => ({ rotulo, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade || a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
}
