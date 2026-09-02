import type { AdminAppointment } from '@features/admin';

import { agruparPorVeiculo } from './veiculos';

function agendamento(over: Partial<AdminAppointment> = {}): AdminAppointment {
  return {
    id: Math.random().toString(36).slice(2),
    customerUid: 'c1',
    customerName: 'Cliente',
    vehicleType: 'Carro',
    carCategory: 'Hatch',
    serviceLabel: 'Lavagem',
    price: 90,
    startAtMs: Date.now(),
    status: 'done',
    ...over,
  };
}

describe('agruparPorVeiculo', () => {
  it('conta cada categoria de carro', () => {
    const linhas = agruparPorVeiculo([
      agendamento({ carCategory: 'SUV' }),
      agendamento({ carCategory: 'SUV' }),
      agendamento({ carCategory: 'Sedan' }),
    ]);

    expect(linhas).toEqual([
      { rotulo: 'SUV', quantidade: 2 },
      { rotulo: 'Sedan', quantidade: 1 },
    ]);
  });

  // Moto não tem Hatch nem SUV. Jogá-la numa categoria de carro daria um
  // gráfico que não descreve nada.
  it('separa moto em faixa própria, ignorando a categoria de carro', () => {
    const linhas = agruparPorVeiculo([
      agendamento({ vehicleType: 'Moto', carCategory: 'SUV' }),
      agendamento({ vehicleType: 'Moto', carCategory: null }),
      agendamento({ vehicleType: 'Carro', carCategory: 'SUV' }),
    ]);

    expect(linhas).toEqual([
      { rotulo: 'Moto', quantidade: 2 },
      { rotulo: 'SUV', quantidade: 1 },
    ]);
  });

  it('chama de Carro o que não tem categoria informada', () => {
    const linhas = agruparPorVeiculo([
      agendamento({ carCategory: null }),
      agendamento({ carCategory: '   ' as AdminAppointment['carCategory'] }),
    ]);

    expect(linhas).toEqual([{ rotulo: 'Carro', quantidade: 2 }]);
  });

  it('ordena do mais atendido ao menos atendido', () => {
    const linhas = agruparPorVeiculo([
      agendamento({ carCategory: 'Sedan' }),
      agendamento({ carCategory: 'SUV' }),
      agendamento({ carCategory: 'SUV' }),
      agendamento({ carCategory: 'SUV' }),
      agendamento({ carCategory: 'Hatch' }),
      agendamento({ carCategory: 'Hatch' }),
    ]);

    expect(linhas.map(l => l.rotulo)).toEqual(['SUV', 'Hatch', 'Sedan']);
  });

  // Sem o desempate por nome a ordem mudaria entre execuções com os mesmos
  // dados, e o gráfico pareceria se mexer sozinho.
  it('desempata pelo rótulo', () => {
    const linhas = agruparPorVeiculo([
      agendamento({ carCategory: 'SUV' }),
      agendamento({ carCategory: 'Hatch' }),
    ]);

    expect(linhas.map(l => l.rotulo)).toEqual(['Hatch', 'SUV']);
  });

  it('devolve lista vazia sem agendamentos', () => {
    expect(agruparPorVeiculo([])).toEqual([]);
  });
});
