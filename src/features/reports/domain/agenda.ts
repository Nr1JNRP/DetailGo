import type { AdminAppointment } from '@features/admin';

export type FaixaDaAgenda = {
  rotulo: string;
  quantidade: number;
};

/** Índice do `Date.getDay()` (0 = domingo) na ordem em que a semana é lida. */
const DIAS = [
  { indice: 1, rotulo: 'Segunda' },
  { indice: 2, rotulo: 'Terça' },
  { indice: 3, rotulo: 'Quarta' },
  { indice: 4, rotulo: 'Quinta' },
  { indice: 5, rotulo: 'Sexta' },
  { indice: 6, rotulo: 'Sábado' },
  { indice: 0, rotulo: 'Domingo' },
];

/**
 * Movimento por dia da semana, de segunda a domingo.
 *
 * Ordem cronológica, não por volume: aqui o que interessa é o formato da
 * semana. Ordenado do maior para o menor você descobre qual é o dia cheio, mas
 * perde o buraco — e é o buraco que vira promoção de terça-feira.
 *
 * Dia sem movimento aparece com zero, pela mesma razão.
 */
export function agruparPorDiaDaSemana(agendamentos: AdminAppointment[]): FaixaDaAgenda[] {
  const contagem = new Map<number, number>();

  for (const item of agendamentos) {
    const dia = new Date(item.startAtMs).getDay();
    contagem.set(dia, (contagem.get(dia) ?? 0) + 1);
  }

  return DIAS.map(({ indice, rotulo }) => ({
    rotulo,
    quantidade: contagem.get(indice) ?? 0,
  }));
}

/**
 * Movimento por hora do dia.
 *
 * A faixa vai da primeira à última hora em que a estética atendeu, e não de um
 * horário comercial fixo: inventar 7h e 20h numa loja que abre 9h e fecha 17h
 * encheria o gráfico de zeros que não dizem nada. As horas vazias no meio do
 * expediente continuam aparecendo — essas são justamente a informação.
 */
export function agruparPorHorario(agendamentos: AdminAppointment[]): FaixaDaAgenda[] {
  if (agendamentos.length === 0) return [];

  const contagem = new Map<number, number>();
  let primeira = 23;
  let ultima = 0;

  for (const item of agendamentos) {
    const hora = new Date(item.startAtMs).getHours();
    contagem.set(hora, (contagem.get(hora) ?? 0) + 1);
    primeira = Math.min(primeira, hora);
    ultima = Math.max(ultima, hora);
  }

  const faixas: FaixaDaAgenda[] = [];
  for (let hora = primeira; hora <= ultima; hora++) {
    faixas.push({
      rotulo: `${String(hora).padStart(2, '0')}h`,
      quantidade: contagem.get(hora) ?? 0,
    });
  }

  return faixas;
}
