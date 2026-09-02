import type { AdminAppointment } from '@features/admin';

import { destaquesDoMes } from './destaques';

function agendamento(over: Partial<AdminAppointment> = {}): AdminAppointment {
  return {
    id: Math.random().toString(36).slice(2),
    customerUid: 'c1',
    customerName: 'Ana Souza',
    vehicleType: 'Carro',
    carCategory: 'SUV',
    serviceLabel: 'Lavagem Técnica',
    price: 90,
    startAtMs: Date.now(),
    status: 'done',
    ...over,
  };
}

describe('destaquesDoMes', () => {
  it('elege o serviço mais feito', () => {
    const { servico } = destaquesDoMes([
      agendamento({ serviceLabel: 'Polimento' }),
      agendamento({ serviceLabel: 'Lavagem' }),
      agendamento({ serviceLabel: 'Lavagem' }),
    ]);

    expect(servico).toEqual({
      rotulo: 'Serviço campeão',
      nome: 'Lavagem',
      contagem: '2x',
    });
  });

  it('elege o veículo mais atendido', () => {
    const { veiculo } = destaquesDoMes([
      agendamento({ carCategory: 'Sedan' }),
      agendamento({ carCategory: 'SUV' }),
      agendamento({ carCategory: 'SUV' }),
    ]);

    expect(veiculo).toEqual({
      rotulo: 'Veículo mais atendido',
      nome: 'SUV',
      contagem: '2x',
    });
  });

  it('elege o cliente que mais voltou', () => {
    const { cliente } = destaquesDoMes([
      agendamento({ customerUid: 'c1', customerName: 'Ana' }),
      agendamento({ customerUid: 'c1', customerName: 'Ana' }),
      agendamento({ customerUid: 'c2', customerName: 'Bruno' }),
    ]);

    expect(cliente).toEqual({
      rotulo: 'Cliente do mês',
      nome: 'Ana',
      contagem: '2x',
    });
  });

  // Mês vazio não tem campeão. Melhor esconder a linha que anunciar um
  // vencedor construído a partir de nada.
  it('devolve tudo nulo quando não há agendamento', () => {
    expect(destaquesDoMes([])).toEqual({ servico: null, veiculo: null, cliente: null });
  });

  it('mantém o cliente nulo quando nenhum agendamento tem uid', () => {
    const { cliente, servico } = destaquesDoMes([agendamento({ customerUid: '' })]);

    expect(cliente).toBeNull();
    expect(servico).not.toBeNull();
  });
});
