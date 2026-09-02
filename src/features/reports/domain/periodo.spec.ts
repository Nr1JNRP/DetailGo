import {
  ehMesCorrente,
  limitesDoMes,
  mesAnterior,
  mesSeguinte,
  periodoAtual,
  rotuloDoPeriodo,
} from './periodo';

const EM_SETEMBRO = new Date(2026, 8, 15, 10, 0, 0).getTime();

describe('periodo', () => {
  describe('limitesDoMes', () => {
    // O fim é o início do mês SEGUINTE, exclusivo. Se fosse o último
    // milissegundo do mês, um erro de um milissegundo perderia ou duplicaria
    // um agendamento na virada.
    it('vai do primeiro instante do mês ao primeiro instante do seguinte', () => {
      const { inicioMs, fimMs } = limitesDoMes({ ano: 2026, mes: 8 });

      expect(new Date(inicioMs)).toEqual(new Date(2026, 8, 1, 0, 0, 0, 0));
      expect(new Date(fimMs)).toEqual(new Date(2026, 9, 1, 0, 0, 0, 0));
    });

    it.each([
      [1, 2026, 28],
      [1, 2024, 29],
      [3, 2026, 30],
      [0, 2026, 31],
    ])('cobre o mês %i de %i inteiro (%i dias)', (mes, ano, dias) => {
      const { inicioMs, fimMs } = limitesDoMes({ ano, mes });

      expect(Math.round((fimMs - inicioMs) / 86400000)).toBe(dias);
    });

    it('vira o ano em dezembro', () => {
      const { fimMs } = limitesDoMes({ ano: 2026, mes: 11 });

      expect(new Date(fimMs)).toEqual(new Date(2027, 0, 1, 0, 0, 0, 0));
    });
  });

  describe('navegação', () => {
    it('volta de janeiro para dezembro do ano anterior', () => {
      expect(mesAnterior({ ano: 2026, mes: 0 })).toEqual({ ano: 2025, mes: 11 });
    });

    it('avança de dezembro para janeiro do ano seguinte', () => {
      expect(mesSeguinte({ ano: 2026, mes: 11 })).toEqual({ ano: 2027, mes: 0 });
    });

    it('anda um mês dentro do mesmo ano', () => {
      expect(mesAnterior({ ano: 2026, mes: 8 })).toEqual({ ano: 2026, mes: 7 });
      expect(mesSeguinte({ ano: 2026, mes: 8 })).toEqual({ ano: 2026, mes: 9 });
    });
  });

  describe('rotuloDoPeriodo', () => {
    it('omite o ano quando é o ano corrente', () => {
      expect(rotuloDoPeriodo({ ano: 2026, mes: 8 }, EM_SETEMBRO)).toBe('Setembro');
    });

    // Sem o ano, "Setembro" de 2025 e de 2026 ficariam idênticos na tela e o
    // dono compararia meses errados sem perceber.
    it('mostra o ano quando é outro ano', () => {
      expect(rotuloDoPeriodo({ ano: 2025, mes: 8 }, EM_SETEMBRO)).toBe('Setembro de 2025');
    });
  });

  describe('ehMesCorrente', () => {
    it('reconhece o mês de hoje', () => {
      expect(ehMesCorrente({ ano: 2026, mes: 8 }, EM_SETEMBRO)).toBe(true);
    });

    it('recusa o mesmo mês de outro ano', () => {
      expect(ehMesCorrente({ ano: 2025, mes: 8 }, EM_SETEMBRO)).toBe(false);
    });

    it('recusa outro mês do mesmo ano', () => {
      expect(ehMesCorrente({ ano: 2026, mes: 7 }, EM_SETEMBRO)).toBe(false);
    });
  });

  describe('periodoAtual', () => {
    it('devolve o mês do relógio', () => {
      expect(periodoAtual(EM_SETEMBRO)).toEqual({ ano: 2026, mes: 8 });
    });
  });
});
