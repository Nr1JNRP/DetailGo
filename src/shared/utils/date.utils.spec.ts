import { dateUtils } from './date.utils';

// Usa datas construídas no fuso local (new Date(ano, mes, dia)) para os testes
// serem determinísticos independente do timezone da máquina/CI.

describe('dateUtils', () => {
  it('formatDate → dd/MM/yyyy', () => {
    const ms = new Date(2026, 2, 5).getTime(); // 05/03/2026 (mês 2 = março)
    expect(dateUtils.formatDate(ms)).toBe('05/03/2026');
  });

  it('toDayKey → yyyy-MM-dd (aceita Date ou ms)', () => {
    const d = new Date(2026, 0, 9); // 09/01/2026
    expect(dateUtils.toDayKey(d)).toBe('2026-01-09');
    expect(dateUtils.toDayKey(d.getTime())).toBe('2026-01-09');
  });

  it('startOfDay / endOfDay zeram e estouram o horário', () => {
    const d = new Date(2026, 5, 15, 14, 30, 45);
    expect(new Date(dateUtils.startOfDay(d)).getHours()).toBe(0);
    expect(new Date(dateUtils.startOfDay(d)).getMinutes()).toBe(0);
    const end = new Date(dateUtils.endOfDay(d));
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });

  it('startOfWeek cai na segunda-feira 00:00', () => {
    const wednesday = new Date(2026, 6, 15); // 15/07/2026 é uma quarta
    const start = new Date(dateUtils.startOfWeek(wednesday));
    expect(start.getDay()).toBe(1); // 1 = segunda
    expect(start.getHours()).toBe(0);
    expect(start.getDate()).toBe(13); // segunda daquela semana
  });

  it('endOfWeek cai no domingo 23:59, 6 dias após a segunda', () => {
    const anchor = new Date(2026, 6, 15);
    const start = dateUtils.startOfWeek(anchor);
    const end = new Date(dateUtils.endOfWeek(anchor));
    expect(end.getDay()).toBe(0); // 0 = domingo
    expect(end.getHours()).toBe(23);
    expect(Math.floor((end.getTime() - start) / (24 * 60 * 60 * 1000))).toBe(6);
  });

  it('addDays soma dias sem mutar o original', () => {
    const d = new Date(2026, 0, 30);
    const next = dateUtils.addDays(d, 3);
    expect(next.getDate()).toBe(2); // 30/01 + 3 = 02/02
    expect(d.getDate()).toBe(30); // original intacto
  });

  it('isExpired respeita a tolerância de 15 min', () => {
    const now = Date.now();
    expect(dateUtils.isExpired(now - 20 * 60 * 1000)).toBe(true); // 20min atrás
    expect(dateUtils.isExpired(now + 5 * 60 * 1000)).toBe(false); // 5min à frente
    expect(dateUtils.isExpired(now - 5 * 60 * 1000)).toBe(false); // 5min atrás < graça
  });

  it('isToday compara só a data', () => {
    expect(dateUtils.isToday(new Date())).toBe(true);
    expect(dateUtils.isToday(new Date(2000, 0, 1))).toBe(false);
  });

  it('isCurrentWeek verdadeiro para hoje', () => {
    expect(dateUtils.isCurrentWeek(new Date())).toBe(true);
    expect(dateUtils.isCurrentWeek(new Date(2000, 0, 1))).toBe(false);
  });

  it('formatWeekLabel condensa quando mesmo mês', () => {
    const start = new Date(2026, 6, 13).getTime(); // 13 jul
    const end = new Date(2026, 6, 19).getTime(); // 19 jul
    const label = dateUtils.formatWeekLabel(start, end);
    expect(label).toContain('13');
    expect(label).toContain('19');
    expect(label).toContain('2026');
  });
});
