import type { AdminAppointment } from '@features/admin';

import { rankearClientes } from './clientes';

const BASE = new Date(2026, 7, 10, 9, 0, 0).getTime();

function agendamento(over: Partial<AdminAppointment> = {}): AdminAppointment {
  return {
    id: Math.random().toString(36).slice(2),
    customerUid: 'c1',
    customerName: 'Ana Souza',
    vehicleType: 'Carro',
    carCategory: 'Hatch',
    serviceLabel: 'Lavagem',
    price: 90,
    startAtMs: BASE,
    status: 'done',
    ...over,
  };
}

describe('rankearClientes', () => {
  it('soma visitas e gasto de cada cliente', () => {
    const linhas = rankearClientes([
      agendamento({ customerUid: 'c1', price: 90 }),
      agendamento({ customerUid: 'c1', price: 180 }),
    ]);

    expect(linhas).toEqual([{ clienteId: 'c1', nome: 'Ana Souza', visitas: 2, total: 270 }]);
  });

  it('ordena de quem mais voltou a quem menos voltou', () => {
    const linhas = rankearClientes([
      agendamento({ customerUid: 'c1', customerName: 'Ana' }),
      agendamento({ customerUid: 'c2', customerName: 'Bruno' }),
      agendamento({ customerUid: 'c2', customerName: 'Bruno' }),
      agendamento({ customerUid: 'c2', customerName: 'Bruno' }),
    ]);

    expect(linhas.map(l => l.nome)).toEqual(['Bruno', 'Ana']);
  });

  it('desempata pelo quanto gastou', () => {
    const linhas = rankearClientes([
      agendamento({ customerUid: 'c1', customerName: 'Ana', price: 50 }),
      agendamento({ customerUid: 'c2', customerName: 'Bruno', price: 500 }),
    ]);

    expect(linhas.map(l => l.nome)).toEqual(['Bruno', 'Ana']);
  });

  it('desempata pelo nome quando visitas e gasto empatam', () => {
    const linhas = rankearClientes([
      agendamento({ customerUid: 'c2', customerName: 'Zeca', price: 90 }),
      agendamento({ customerUid: 'c1', customerName: 'Alice', price: 90 }),
    ]);

    expect(linhas.map(l => l.nome)).toEqual(['Alice', 'Zeca']);
  });

  // Dois clientes homônimos são duas pessoas; um cliente que trocou o nome no
  // perfil continua sendo o mesmo. O uid é a identidade.
  it('agrupa pelo uid, não pelo nome', () => {
    const linhas = rankearClientes([
      agendamento({ customerUid: 'c1', customerName: 'Ana Souza' }),
      agendamento({ customerUid: 'c2', customerName: 'Ana Souza' }),
    ]);

    expect(linhas).toHaveLength(2);
  });

  it('exibe o nome do atendimento mais recente', () => {
    const linhas = rankearClientes([
      agendamento({ customerUid: 'c1', customerName: 'Ana', startAtMs: BASE }),
      agendamento({ customerUid: 'c1', customerName: 'Ana Souza', startAtMs: BASE + 86400000 }),
    ]);

    expect(linhas[0].nome).toBe('Ana Souza');
  });

  it('não deixa um atendimento antigo sobrescrever o nome mais novo', () => {
    const linhas = rankearClientes([
      agendamento({ customerUid: 'c1', customerName: 'Ana Souza', startAtMs: BASE + 86400000 }),
      agendamento({ customerUid: 'c1', customerName: 'Ana', startAtMs: BASE }),
    ]);

    expect(linhas[0].nome).toBe('Ana Souza');
  });

  it('usa Cliente quando o nome vem vazio', () => {
    const linhas = rankearClientes([agendamento({ customerName: '  ' })]);

    expect(linhas[0].nome).toBe('Cliente');
  });

  it('ignora agendamento sem uid de cliente', () => {
    const linhas = rankearClientes([
      agendamento({ customerUid: '' }),
      agendamento({ customerUid: 'c1' }),
    ]);

    expect(linhas).toHaveLength(1);
    expect(linhas[0].clienteId).toBe('c1');
  });

  it('conta visita de cliente sem preço, com zero de gasto', () => {
    const linhas = rankearClientes([agendamento({ price: null })]);

    expect(linhas[0]).toMatchObject({ visitas: 1, total: 0 });
  });

  it('respeita o limite pedido', () => {
    const linhas = rankearClientes(
      [
        agendamento({ customerUid: 'c1', customerName: 'A' }),
        agendamento({ customerUid: 'c2', customerName: 'B' }),
        agendamento({ customerUid: 'c3', customerName: 'C' }),
      ],
      2,
    );

    expect(linhas).toHaveLength(2);
  });

  it('devolve três por padrão', () => {
    const linhas = rankearClientes([
      agendamento({ customerUid: 'c1', customerName: 'A' }),
      agendamento({ customerUid: 'c2', customerName: 'B' }),
      agendamento({ customerUid: 'c3', customerName: 'C' }),
      agendamento({ customerUid: 'c4', customerName: 'D' }),
    ]);

    expect(linhas).toHaveLength(3);
  });

  it('devolve lista vazia sem agendamentos', () => {
    expect(rankearClientes([])).toEqual([]);
  });
});
