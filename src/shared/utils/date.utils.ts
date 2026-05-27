// src/shared/utils/date.utils.ts
export const dateUtils = {
  formatDate: (ms: number): string => {
    const d = new Date(ms);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  },

  formatHour: (ms: number): string => {
    return new Date(ms).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  },

  formatDateTime: (ms: number): string => {
    return `${dateUtils.formatDate(ms)} • ${dateUtils.formatHour(ms)}`;
  },

  toDayKey: (dateOrMs: Date | number): string => {
    const d = typeof dateOrMs === 'number' ? new Date(dateOrMs) : dateOrMs;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  },

  startOfDay: (date: Date): number => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  },

  endOfDay: (date: Date): number => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  },

  startOfWeek: (anchor: Date = new Date()): number => {
    const d = new Date(anchor);
    const day = d.getDay();
    const diffToMonday = (day + 6) % 7;
    d.setDate(d.getDate() - diffToMonday);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  },

  endOfWeek: (anchor: Date = new Date()): number => {
    const start = dateUtils.startOfWeek(anchor);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end.getTime();
  },

  formatWeekLabel: (startMs: number, endMs: number): string => {
    const s = new Date(startMs);
    const e = new Date(endMs);

    const ddS = String(s.getDate()).padStart(2, '0');
    const ddE = String(e.getDate()).padStart(2, '0');

    const monthS = s.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
    const monthE = e.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');

    const yyyyS = s.getFullYear();
    const yyyyE = e.getFullYear();

    if (yyyyS === yyyyE && s.getMonth() === e.getMonth()) {
      return `${ddS}–${ddE} ${monthS} ${yyyyS}`;
    }
    if (yyyyS === yyyyE) {
      return `${ddS} ${monthS} – ${ddE} ${monthE} ${yyyyS}`;
    }
    return `${ddS} ${monthS} ${yyyyS} – ${ddE} ${monthE} ${yyyyE}`;
  },

  isCurrentWeek: (anchor: Date = new Date()): boolean => {
    return dateUtils.startOfWeek(anchor) === dateUtils.startOfWeek(new Date());
  },

  addDays: (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  },

  isExpired: (startAtMs: number, graceMs: number = 15 * 60 * 1000): boolean => {
    return Date.now() >= startAtMs + graceMs;
  },

  isToday: (date: Date): boolean => {
    const now = new Date();
    return (
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  },
} as const;
