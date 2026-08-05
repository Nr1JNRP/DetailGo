import { toWhatsAppNumber } from './whatsapp.utils';

describe('toWhatsAppNumber', () => {
  it('adiciona o código do país (55) para celular BR de 11 dígitos', () => {
    expect(toWhatsAppNumber('11999998888')).toBe('whatsapp:+5511999998888');
  });

  it('adiciona o código do país para fixo de 10 dígitos', () => {
    expect(toWhatsAppNumber('1133334444')).toBe('whatsapp:+551133334444');
  });

  it('mantém o número quando já vem com o código do país', () => {
    expect(toWhatsAppNumber('5511999998888')).toBe('whatsapp:+5511999998888');
  });

  it('ignora máscara/caracteres não numéricos', () => {
    expect(toWhatsAppNumber('(11) 99999-8888')).toBe('whatsapp:+5511999998888');
  });

  it('retorna null para telefone inválido ou vazio', () => {
    expect(toWhatsAppNumber('99998888')).toBeNull();
    expect(toWhatsAppNumber('')).toBeNull();
    expect(toWhatsAppNumber(undefined)).toBeNull();
    expect(toWhatsAppNumber(null)).toBeNull();
  });
});
