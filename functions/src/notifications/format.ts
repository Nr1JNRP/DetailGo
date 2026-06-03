const TZ = 'America/Sao_Paulo';

function parts(startAtMs: number) {
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const map = new Map(fmt.formatToParts(new Date(startAtMs)).map(p => [p.type, p.value]));
  return {
    day: map.get('day') ?? '',
    month: map.get('month') ?? '',
    hour: map.get('hour') ?? '',
    minute: map.get('minute') ?? '',
  };
}

/** "dd/MM • HH:mm" no fuso de Sao Paulo. */
export function formatWhen(startAtMs?: number): string {
  if (!startAtMs) return '';
  const p = parts(startAtMs);
  return `${p.day}/${p.month} • ${p.hour}:${p.minute}`;
}

/** "HH:mm" no fuso de Sao Paulo. */
export function formatHour(startAtMs?: number): string {
  if (!startAtMs) return '';
  const p = parts(startAtMs);
  return `${p.hour}:${p.minute}`;
}
