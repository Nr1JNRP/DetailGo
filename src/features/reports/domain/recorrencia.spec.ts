import type { AdminAppointment } from '@features/admin';

import { calcularRecorrencia, clientesSumidos } from './recorrencia';

const DIA = 24 * 60 * 60 * 1000;
const HOJE = new Date(2026, 8, 2, 12, 0, 0).getTime();
const INICIO_DE_SETEMBRO = new Date(2026, 8, 1).getTime();

function visita(over: Partial<AdminAppointment> = {}): AdminAppointment {
  return {
    id: Math.random().toString(36).slice(2),
    customerUid: 'c1',
    customerName: 'Ana Souza',
    vehicleType: 'Carro',
    carCategory: 'Hatch',
    serviceLabel: 'Lavagem',
    price: 90,
    startAtMs: HOJE,
    status: 'done',
    ...over,
  };
}

describe('calcularRecorrencia', () => {
  // "Recorrente" precisa olhar para fora do mês. Contar quem veio duas vezes
  // dentro do próprio mês daria zero em toda estética cujo ciclo de retorno
  // passa de trinta dias.
  it('conta como recorrente quem já vinha antes do mês', () => {
    const doMes = [visita({ customerUid: 'c1' })];
    const historico = [
      visita({ customerUid: 'c1', startAtMs: INICIO_DE_SETEMBRO - 30 * DIA }),
      ...doMes,
    ];

    expect(calcularRecorrencia(doMes, historico, INICIO_DE_SETEMBRO)).toEqual({
      clientes: 1,
      recorrentes: 1,
      novos: 0,
    });
  });

  it('conta como novo quem só aparece dentro do mês', () => {
    const doMes = [visita({ customerUid: 'c9' })];

    expect(calcularRecorrencia(doMes, doMes, INICIO_DE_SETEMBRO)).toEqual({
      clientes: 1,
      recorrentes: 0,
      novos: 1,
    });
  });

  it('não conta duas vezes o cliente que veio várias vezes no mês', () => {
    const doMes = [visita({ customerUid: 'c1' }), visita({ customerUid: 'c1' })];

    expect(calcularRecorrencia(doMes, doMes, INICIO_DE_SETEMBRO).clientes).toBe(1);
  });

  it('separa recorrentes de novos no mesmo mês', () => {
    const doMes = [visita({ customerUid: 'c1' }), visita({ customerUid: 'c2' })];
    const historico = [
      visita({ customerUid: 'c1', startAtMs: INICIO_DE_SETEMBRO - 10 * DIA }),
      ...doMes,
    ];

    expect(calcularRecorrencia(doMes, historico, INICIO_DE_SETEMBRO)).toEqual({
      clientes: 2,
      recorrentes: 1,
      novos: 1,
    });
  });

  // Visita no próprio mês não faz de ninguém recorrente, senão todo cliente do
  // mês seria recorrente por definição.
  it('ignora visitas do próprio mês ao decidir quem já vinha', () => {
    const doMes = [
      visita({ customerUid: 'c1', startAtMs: INICIO_DE_SETEMBRO + DIA }),
      visita({ customerUid: 'c1', startAtMs: INICIO_DE_SETEMBRO + 2 * DIA }),
    ];

    expect(calcularRecorrencia(doMes, doMes, INICIO_DE_SETEMBRO).recorrentes).toBe(0);
  });

  it('ignora agendamento sem uid de cliente', () => {
    const doMes = [visita({ customerUid: '' }), visita({ customerUid: 'c1' })];

    expect(calcularRecorrencia(doMes, doMes, INICIO_DE_SETEMBRO).clientes).toBe(1);
  });

  it('devolve tudo zerado no mês vazio', () => {
    expect(calcularRecorrencia([], [], INICIO_DE_SETEMBRO)).toEqual({
      clientes: 0,
      recorrentes: 0,
      novos: 0,
    });
  });
});

describe('clientesSumidos', () => {
  it('lista quem passou do limite de dias', () => {
    const historico = [visita({ customerUid: 'c1', startAtMs: HOJE - 60 * DIA })];

    expect(clientesSumidos(historico, HOJE, 45)).toEqual([
      {
        clienteId: 'c1',
        nome: 'Ana Souza',
        visitas: 1,
        ultimaVisitaMs: HOJE - 60 * DIA,
        diasSemVoltar: 60,
      },
    ]);
  });

  it('não lista quem voltou dentro do prazo', () => {
    const historico = [visita({ customerUid: 'c1', startAtMs: HOJE - 10 * DIA })];

    expect(clientesSumidos(historico, HOJE, 45)).toEqual([]);
  });

  // A última visita é que conta. Um cliente antigo que voltou ontem não sumiu.
  it('usa a visita mais recente, não a mais antiga', () => {
    const historico = [
      visita({ customerUid: 'c1', startAtMs: HOJE - 300 * DIA }),
      visita({ customerUid: 'c1', startAtMs: HOJE - 2 * DIA }),
    ];

    expect(clientesSumidos(historico, HOJE, 45)).toEqual([]);
  });

  // O Firestore não garante ordem, e um documento antigo chegando depois de um
  // recente não pode reescrever a última visita — o cliente apareceria como
  // sumido sem estar.
  it('não deixa uma visita antiga que chega depois virar a última', () => {
    const historico = [
      visita({ customerUid: 'c1', customerName: 'Ana Souza', startAtMs: HOJE - 2 * DIA }),
      visita({ customerUid: 'c1', customerName: 'Ana', startAtMs: HOJE - 300 * DIA }),
    ];

    expect(clientesSumidos(historico, HOJE, 45)).toEqual([]);
  });

  it('mantém o nome da visita mais recente mesmo fora de ordem', () => {
    const historico = [
      visita({ customerUid: 'c1', customerName: 'Ana Souza', startAtMs: HOJE - 60 * DIA }),
      visita({ customerUid: 'c1', customerName: 'Ana', startAtMs: HOJE - 300 * DIA }),
    ];

    const [sumido] = clientesSumidos(historico, HOJE, 45);
    expect(sumido.nome).toBe('Ana Souza');
    expect(sumido.diasSemVoltar).toBe(60);
  });

  it('ordena do mais sumido para o menos sumido', () => {
    const historico = [
      visita({ customerUid: 'c1', customerName: 'Ana', startAtMs: HOJE - 50 * DIA }),
      visita({ customerUid: 'c2', customerName: 'Bruno', startAtMs: HOJE - 90 * DIA }),
    ];

    expect(clientesSumidos(historico, HOJE, 45).map(c => c.nome)).toEqual(['Bruno', 'Ana']);
  });

  it('soma todas as visitas do cliente sumido', () => {
    const historico = [
      visita({ customerUid: 'c1', startAtMs: HOJE - 90 * DIA }),
      visita({ customerUid: 'c1', startAtMs: HOJE - 60 * DIA }),
    ];

    expect(clientesSumidos(historico, HOJE, 45)[0]).toMatchObject({
      visitas: 2,
      diasSemVoltar: 60,
    });
  });

  it('exibe o nome do atendimento mais recente', () => {
    const historico = [
      visita({ customerUid: 'c1', customerName: 'Ana', startAtMs: HOJE - 90 * DIA }),
      visita({ customerUid: 'c1', customerName: 'Ana Souza', startAtMs: HOJE - 60 * DIA }),
    ];

    expect(clientesSumidos(historico, HOJE, 45)[0].nome).toBe('Ana Souza');
  });

  it('entra na lista exatamente no dia do limite', () => {
    const historico = [visita({ customerUid: 'c1', startAtMs: HOJE - 45 * DIA })];

    expect(clientesSumidos(historico, HOJE, 45)).toHaveLength(1);
  });

  it('fica de fora um dia antes do limite', () => {
    const historico = [visita({ customerUid: 'c1', startAtMs: HOJE - 44 * DIA })];

    expect(clientesSumidos(historico, HOJE, 45)).toHaveLength(0);
  });

  it('respeita o limite de nomes', () => {
    const historico = Array.from({ length: 8 }, (_, i) =>
      visita({ customerUid: `c${i}`, customerName: `Cliente ${i}`, startAtMs: HOJE - 60 * DIA }),
    );

    expect(clientesSumidos(historico, HOJE, 45)).toHaveLength(5);
    expect(clientesSumidos(historico, HOJE, 45, 2)).toHaveLength(2);
  });

  it('ignora agendamento sem uid de cliente', () => {
    const historico = [visita({ customerUid: '', startAtMs: HOJE - 60 * DIA })];

    expect(clientesSumidos(historico, HOJE, 45)).toEqual([]);
  });

  it('devolve lista vazia sem histórico', () => {
    expect(clientesSumidos([], HOJE, 45)).toEqual([]);
  });
});
