import type { AdminAppointment } from '@features/admin';

import {
  agruparPorServico,
  insightDeFaturamento,
  ordenarPorFaturamento,
  totalDeServicos,
} from './serviceReport';

function agendamento(over: Partial<AdminAppointment> = {}): AdminAppointment {
  return {
    id: Math.random().toString(36).slice(2),
    customerUid: 'cliente-1',
    customerName: 'Cliente',
    vehicleType: 'Carro',
    carCategory: 'Hatch',
    serviceLabel: 'Lavagem simples',
    price: 80,
    startAtMs: Date.now(),
    status: 'done',
    ...over,
  };
}

describe('agruparPorServico', () => {
  it('soma quantidade e faturamento do mesmo serviço', () => {
    const linhas = agruparPorServico([
      agendamento({ serviceLabel: 'Polimento', price: 300 }),
      agendamento({ serviceLabel: 'Polimento', price: 250 }),
    ]);

    expect(linhas).toEqual([{ servico: 'Polimento', quantidade: 2, faturamento: 550 }]);
  });

  it('ordena do serviço mais feito ao menos feito', () => {
    const linhas = agruparPorServico([
      agendamento({ serviceLabel: 'Polimento' }),
      agendamento({ serviceLabel: 'Lavagem' }),
      agendamento({ serviceLabel: 'Lavagem' }),
      agendamento({ serviceLabel: 'Lavagem' }),
      agendamento({ serviceLabel: 'Cera' }),
      agendamento({ serviceLabel: 'Cera' }),
    ]);

    expect(linhas.map(l => l.servico)).toEqual(['Lavagem', 'Cera', 'Polimento']);
  });

  it('desempata pelo faturamento quando a quantidade é igual', () => {
    const linhas = agruparPorServico([
      agendamento({ serviceLabel: 'Barato', price: 50 }),
      agendamento({ serviceLabel: 'Caro', price: 500 }),
    ]);

    expect(linhas.map(l => l.servico)).toEqual(['Caro', 'Barato']);
  });

  // Sem o terceiro critério a ordem dependeria da ordem de chegada, e o gráfico
  // "se mexeria" sozinho ao sair do mês e voltar com os mesmos dados.
  it('desempata pelo nome quando quantidade e faturamento empatam', () => {
    const linhas = agruparPorServico([
      agendamento({ serviceLabel: 'Zebra', price: 100 }),
      agendamento({ serviceLabel: 'Alfa', price: 100 }),
    ]);

    expect(linhas.map(l => l.servico)).toEqual(['Alfa', 'Zebra']);
  });

  // O dono fez o trabalho. Sumir com ele por causa de preço ausente mentiria
  // sobre o volume, que é justamente o que o gráfico existe para mostrar.
  it('conta serviço sem preço, com zero de faturamento', () => {
    const linhas = agruparPorServico([
      agendamento({ serviceLabel: 'Lavagem', price: null }),
      agendamento({ serviceLabel: 'Lavagem', price: 80 }),
    ]);

    expect(linhas).toEqual([{ servico: 'Lavagem', quantidade: 2, faturamento: 80 }]);
  });

  it('agrupa os sem nome sob um rótulo único', () => {
    const linhas = agruparPorServico([
      agendamento({ serviceLabel: null, price: 10 }),
      agendamento({ serviceLabel: '   ', price: 20 }),
    ]);

    expect(linhas).toEqual([{ servico: 'Sem serviço', quantidade: 2, faturamento: 30 }]);
  });

  // Renomear um serviço no catálogo não reescreve o passado: o agendamento
  // guarda o nome do dia em que foi marcado, e as duas linhas estão certas.
  it('mantém separados dois nomes diferentes', () => {
    const linhas = agruparPorServico([
      agendamento({ serviceLabel: 'Lavagem simples' }),
      agendamento({ serviceLabel: 'Lavagem express' }),
    ]);

    expect(linhas).toHaveLength(2);
  });

  it('devolve lista vazia quando não há agendamentos', () => {
    expect(agruparPorServico([])).toEqual([]);
  });
});

describe('totalDeServicos', () => {
  it('soma as quantidades de todas as linhas', () => {
    const linhas = agruparPorServico([
      agendamento({ serviceLabel: 'Lavagem' }),
      agendamento({ serviceLabel: 'Lavagem' }),
      agendamento({ serviceLabel: 'Cera' }),
    ]);

    expect(totalDeServicos(linhas)).toBe(3);
  });

  it('é zero sem linhas', () => {
    expect(totalDeServicos([])).toBe(0);
  });
});

describe('ordenarPorFaturamento', () => {
  it('põe na frente quem mais rende, mesmo fazendo menos', () => {
    const linhas = agruparPorServico([
      agendamento({ serviceLabel: 'Lavagem', price: 90 }),
      agendamento({ serviceLabel: 'Lavagem', price: 90 }),
      agendamento({ serviceLabel: 'Lavagem', price: 90 }),
      agendamento({ serviceLabel: 'Polimento', price: 350 }),
    ]);

    expect(linhas.map(l => l.servico)).toEqual(['Lavagem', 'Polimento']);
    expect(ordenarPorFaturamento(linhas).map(l => l.servico)).toEqual(['Polimento', 'Lavagem']);
  });

  it('não altera a lista recebida', () => {
    const linhas = agruparPorServico([
      agendamento({ serviceLabel: 'Lavagem', price: 90 }),
      agendamento({ serviceLabel: 'Polimento', price: 350 }),
    ]);
    const antes = linhas.map(l => l.servico);

    ordenarPorFaturamento(linhas);

    expect(linhas.map(l => l.servico)).toEqual(antes);
  });

  it('desempata pela quantidade e depois pelo nome', () => {
    const linhas = agruparPorServico([
      agendamento({ serviceLabel: 'Zeta', price: 100 }),
      agendamento({ serviceLabel: 'Alfa', price: 100 }),
    ]);

    expect(ordenarPorFaturamento(linhas).map(l => l.servico)).toEqual(['Alfa', 'Zeta']);
  });
});

describe('insightDeFaturamento', () => {
  // A frase existe justamente porque o serviço que enche a agenda quase nunca
  // é o que paga as contas.
  it('compara o mais feito com o que mais rende', () => {
    const linhas = agruparPorServico([
      ...Array.from({ length: 3 }, () => agendamento({ serviceLabel: 'Lavagem', price: 100 })),
      agendamento({ serviceLabel: 'Polimento', price: 700 }),
    ]);

    expect(insightDeFaturamento(linhas)).toBe(
      'O Polimento é 25% do que você faz e traz 70% do faturamento.',
    );
  });

  it('cala a boca quando o mais feito também é o que mais rende', () => {
    const linhas = agruparPorServico([
      agendamento({ serviceLabel: 'Lavagem', price: 500 }),
      agendamento({ serviceLabel: 'Lavagem', price: 500 }),
      agendamento({ serviceLabel: 'Cera', price: 50 }),
    ]);

    expect(insightDeFaturamento(linhas)).toBeNull();
  });

  it('cala a boca quando só existe um serviço', () => {
    const linhas = agruparPorServico([agendamento({ serviceLabel: 'Lavagem' })]);

    expect(insightDeFaturamento(linhas)).toBeNull();
  });

  it('cala a boca sem serviço nenhum', () => {
    expect(insightDeFaturamento([])).toBeNull();
  });

  it('não divide por zero quando nada tem preço', () => {
    const linhas = agruparPorServico([
      agendamento({ serviceLabel: 'Lavagem', price: null }),
      agendamento({ serviceLabel: 'Cera', price: null }),
    ]);

    expect(insightDeFaturamento(linhas)).toBeNull();
  });
});
