import type { AdminAppointment } from '@features/admin';

import { resumoDoMes } from './resumo';
import { valorCurto } from './valorCurto';

function agendamento(price: number | null = 90): AdminAppointment {
  return {
    id: Math.random().toString(36).slice(2),
    customerUid: 'c1',
    customerName: 'Cliente',
    vehicleType: 'Carro',
    carCategory: 'Hatch',
    serviceLabel: 'Lavagem',
    price,
    startAtMs: Date.now(),
    status: 'done',
  };
}

describe('resumoDoMes', () => {
  it('conta serviços e soma o faturamento', () => {
    expect(resumoDoMes([agendamento(90), agendamento(180)])).toMatchObject({
      servicos: 2,
      faturamento: 270,
    });
  });

  it('divide o faturamento pelo total de serviços', () => {
    expect(resumoDoMes([agendamento(100), agendamento(200)]).ticketMedio).toBe(150);
  });

  // Dividir só pelos que têm preço daria uma média melhor que a realidade. O
  // serviço sem preço aconteceu e ocupou a agenda igual.
  it('inclui o serviço sem preço no divisor do ticket médio', () => {
    expect(resumoDoMes([agendamento(300), agendamento(null)]).ticketMedio).toBe(150);
  });

  it('não divide por zero no mês vazio', () => {
    expect(resumoDoMes([])).toEqual({ servicos: 0, faturamento: 0, ticketMedio: 0 });
  });
});

describe('valorCurto', () => {
  it('separa o milhar com ponto', () => {
    expect(valorCurto(4280)).toBe('R$ 4.280');
  });

  it('separa milhões', () => {
    expect(valorCurto(1234567)).toBe('R$ 1.234.567');
  });

  // Num resumo de mês o centavo não muda decisão nenhuma, e cabe pouco espaço.
  it('arredonda os centavos', () => {
    expect(valorCurto(152.86)).toBe('R$ 153');
    expect(valorCurto(152.4)).toBe('R$ 152');
  });

  it('escreve zero', () => {
    expect(valorCurto(0)).toBe('R$ 0');
  });

  it('mantém o sinal de negativo', () => {
    expect(valorCurto(-1500)).toBe('R$ -1.500');
  });

  it('não quebra com número inválido', () => {
    expect(valorCurto(Number.NaN)).toBe('R$ 0');
    expect(valorCurto(Number.POSITIVE_INFINITY)).toBe('R$ 0');
  });
});
