import { validationUtils } from './validation.utils';

describe('validationUtils', () => {
  describe('email', () => {
    it.each(['ana@teste.com', 'a.b+c@sub.dominio.com.br', 'x@y.io'])('aceita %s', email => {
      expect(validationUtils.email(email)).toBe(true);
    });

    it.each(['', 'sem-arroba', 'a@b', 'a@b.', '@teste.com', 'a @teste.com'])(
      'rejeita %s',
      email => {
        expect(validationUtils.email(email)).toBe(false);
      },
    );

    it('ignora espaços nas pontas', () => {
      expect(validationUtils.email('  ana@teste.com  ')).toBe(true);
    });
  });

  describe('phone', () => {
    it('aceita 10 ou 11 dígitos (com ou sem máscara)', () => {
      expect(validationUtils.phone('11999998888')).toBe(true);
      expect(validationUtils.phone('(11) 9999-8888')).toBe(true);
    });

    it('rejeita telefone curto ou longo demais', () => {
      expect(validationUtils.phone('99998888')).toBe(false);
      expect(validationUtils.phone('119999988887777')).toBe(false);
    });
  });

  describe('password', () => {
    it('exige no mínimo 6 caracteres', () => {
      expect(validationUtils.password('123456')).toBe(true);
      expect(validationUtils.password('12345')).toBe(false);
    });
  });

  describe('name', () => {
    it('exige no mínimo 2 caracteres (ignorando espaços)', () => {
      expect(validationUtils.name('Ana')).toBe(true);
      expect(validationUtils.name(' a ')).toBe(false);
    });
  });

  describe('confirmPassword', () => {
    it('só aceita quando iguais e não vazio', () => {
      expect(validationUtils.confirmPassword('123456', '123456')).toBe(true);
      expect(validationUtils.confirmPassword('123456', '1234567')).toBe(false);
      expect(validationUtils.confirmPassword('', '')).toBe(false);
    });
  });

  describe('required', () => {
    it('valida presença de string e outros valores', () => {
      expect(validationUtils.required('x')).toBe(true);
      expect(validationUtils.required('   ')).toBe(false);
      expect(validationUtils.required('')).toBe(false);
      expect(validationUtils.required(null)).toBe(false);
      expect(validationUtils.required(undefined)).toBe(false);
      expect(validationUtils.required(0)).toBe(true);
    });
  });

  describe('minLength / maxLength', () => {
    it('respeita os limites', () => {
      expect(validationUtils.minLength('abc', 3)).toBe(true);
      expect(validationUtils.minLength('ab', 3)).toBe(false);
      expect(validationUtils.maxLength('abc', 3)).toBe(true);
      expect(validationUtils.maxLength('abcd', 3)).toBe(false);
    });
  });
});
