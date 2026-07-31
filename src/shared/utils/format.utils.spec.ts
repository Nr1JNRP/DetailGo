import { formatUtils } from './format.utils';

describe('formatUtils', () => {
  describe('currency / currencyCompact', () => {
    it('retorna "--" para null/undefined', () => {
      expect(formatUtils.currency(null)).toBe('--');
      expect(formatUtils.currencyCompact(null)).toBe('--');
    });

    it('currencyCompact formata em reais com vírgula', () => {
      expect(formatUtils.currencyCompact(80)).toBe('R$ 80,00');
      expect(formatUtils.currencyCompact(100.5)).toBe('R$ 100,50');
    });

    it('currency inclui o valor formatado em pt-BR', () => {
      expect(formatUtils.currency(80)).toContain('80,00');
    });
  });

  describe('phone', () => {
    it('formata 11 dígitos como celular', () => {
      expect(formatUtils.phone('11999998888')).toBe('(11) 99999-8888');
    });

    it('formata 10 dígitos como fixo', () => {
      expect(formatUtils.phone('1133334444')).toBe('(11) 3333-4444');
    });

    it('devolve original quando tamanho inesperado', () => {
      expect(formatUtils.phone('123')).toBe('123');
    });
  });

  describe('phoneMask / phoneDigits', () => {
    it('phoneMask aplica máscara progressiva', () => {
      expect(formatUtils.phoneMask('11999998888')).toBe('(11) 99999-8888');
    });

    it('phoneDigits extrai só números', () => {
      expect(formatUtils.phoneDigits('(11) 99999-8888')).toBe('11999998888');
    });
  });

  describe('helpers de texto', () => {
    it('capitalize deixa só a primeira maiúscula', () => {
      expect(formatUtils.capitalize('jORGE')).toBe('Jorge');
    });

    it('truncate corta e adiciona reticências', () => {
      expect(formatUtils.truncate('Polimento técnico completo', 10)).toBe('Polimento ...');
      expect(formatUtils.truncate('curto', 10)).toBe('curto');
    });

    it('normalizeEmail apara e minusculiza', () => {
      expect(formatUtils.normalizeEmail('  Ana@Teste.COM ')).toBe('ana@teste.com');
    });

    it('padZero preenche com zero à esquerda', () => {
      expect(formatUtils.padZero(8)).toBe('08');
      expect(formatUtils.padZero(12)).toBe('12');
    });
  });
});
