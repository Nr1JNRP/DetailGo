import { useEffect, useState } from 'react';

/**
 * Retorna `Date.now()` e o atualiza a cada `intervalMs` (padrão 30s). Use quando
 * a UI deriva algo do RELÓGIO (ex.: agendamento vencido = passou do horário +
 * tolerância): como o dado no banco não muda nesse instante, sem um tick os
 * `useMemo`/filtros nunca recalculam e a tela fica "presa" no estado antigo.
 *
 * Inclua o valor retornado nas dependências do `useMemo`/`useEffect` que
 * dependem do tempo.
 */
export function useNowTick(intervalMs = 30000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
