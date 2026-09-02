import type { AdminAppointment } from '@features/admin';

import { agruparPorDiaDaSemana, agruparPorHorario } from './agenda';

/** 03/08/2026 é uma segunda-feira. */
function em(dia: number, hora = 9): AdminAppointment {
  return {
    id: Math.random().toString(36).slice(2),
    customerUid: 'c1',
    customerName: 'Cliente',
    vehicleType: 'Carro',
    carCategory: 'Hatch',
    serviceLabel: 'Lavagem',
    price: 90,
    startAtMs: new Date(2026, 7, dia, hora, 0, 0).getTime(),
    status: 'done',
  };
}

describe('agruparPorDiaDaSemana', () => {
  it('conta cada dia da semana', () => {
    const linhas = agruparPorDiaDaSemana([em(3), em(3), em(8)]);

    expect(linhas.find(l => l.rotulo === 'Segunda')?.quantidade).toBe(2);
    expect(linhas.find(l => l.rotulo === 'Sábado')?.quantidade).toBe(1);
  });

  // O gráfico existe para achar o buraco na semana, e buraco só aparece se o
  // dia vazio for desenhado.
  it('mostra os sete dias, inclusive os vazios', () => {
    const linhas = agruparPorDiaDaSemana([em(3)]);

    expect(linhas).toHaveLength(7);
    expect(linhas.find(l => l.rotulo === 'Domingo')?.quantidade).toBe(0);
  });

  // Cronológica, não por volume: ordenar pelo maior esconderia o formato da
  // semana, que é justamente o que se quer ler.
  it('mantém a ordem de segunda a domingo', () => {
    const linhas = agruparPorDiaDaSemana([em(9), em(3)]);

    expect(linhas.map(l => l.rotulo)).toEqual([
      'Segunda',
      'Terça',
      'Quarta',
      'Quinta',
      'Sexta',
      'Sábado',
      'Domingo',
    ]);
  });

  it('devolve a semana zerada sem agendamentos', () => {
    const linhas = agruparPorDiaDaSemana([]);

    expect(linhas).toHaveLength(7);
    expect(linhas.every(l => l.quantidade === 0)).toBe(true);
  });
});

describe('agruparPorHorario', () => {
  it('conta por hora do dia', () => {
    const linhas = agruparPorHorario([em(3, 9), em(4, 9), em(5, 14)]);

    expect(linhas.find(l => l.rotulo === '09h')?.quantidade).toBe(2);
    expect(linhas.find(l => l.rotulo === '14h')?.quantidade).toBe(1);
  });

  // Da primeira à última hora atendida, não de um horário comercial fixo:
  // inventar 07h numa loja que abre 09h só encheria o gráfico de zeros.
  it('vai da primeira à última hora com atendimento', () => {
    const linhas = agruparPorHorario([em(3, 9), em(4, 12)]);

    expect(linhas.map(l => l.rotulo)).toEqual(['09h', '10h', '11h', '12h']);
  });

  // A hora vazia no meio do expediente é a informação: é onde cabe encaixe.
  it('mostra a hora vazia entre a primeira e a última', () => {
    const linhas = agruparPorHorario([em(3, 9), em(4, 11)]);

    expect(linhas.find(l => l.rotulo === '10h')?.quantidade).toBe(0);
  });

  it('formata a hora com dois dígitos', () => {
    expect(agruparPorHorario([em(3, 8)])[0].rotulo).toBe('08h');
  });

  it('devolve uma faixa só quando tudo aconteceu na mesma hora', () => {
    expect(agruparPorHorario([em(3, 15), em(4, 15)])).toEqual([{ rotulo: '15h', quantidade: 2 }]);
  });

  it('devolve lista vazia sem agendamentos', () => {
    expect(agruparPorHorario([])).toEqual([]);
  });
});
