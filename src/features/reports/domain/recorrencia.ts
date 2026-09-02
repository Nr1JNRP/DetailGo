import type { AdminAppointment } from '@features/admin';

export type Recorrencia = {
  /** Clientes distintos atendidos no mês. */
  clientes: number;
  /** Desses, quantos já tinham vindo antes do mês. */
  recorrentes: number;
  novos: number;
};

export type ClienteSumido = {
  clienteId: string;
  nome: string;
  visitas: number;
  ultimaVisitaMs: number;
  diasSemVoltar: number;
};

const DIA_MS = 24 * 60 * 60 * 1000;
const SEM_NOME = 'Cliente';

type Visita = { nome: string; visitas: number; ultimaMs: number; primeiraMs: number };

/** Última e primeira visita de cada cliente, a partir de um histórico. */
function consolidar(historico: AdminAppointment[]): Map<string, Visita> {
  const porCliente = new Map<string, Visita>();

  for (const item of historico) {
    const clienteId = item.customerUid?.trim();
    if (!clienteId) continue;

    const nome = item.customerName?.trim() || SEM_NOME;
    const atual = porCliente.get(clienteId);

    if (!atual) {
      porCliente.set(clienteId, {
        nome,
        visitas: 1,
        ultimaMs: item.startAtMs,
        primeiraMs: item.startAtMs,
      });
      continue;
    }

    atual.visitas += 1;
    atual.primeiraMs = Math.min(atual.primeiraMs, item.startAtMs);
    if (item.startAtMs >= atual.ultimaMs) {
      atual.ultimaMs = item.startAtMs;
      atual.nome = nome;
    }
  }

  return porCliente;
}

/**
 * Quantos clientes do mês já eram clientes antes dele.
 *
 * "Recorrente" precisa olhar para fora do mês. Contar quem veio duas vezes
 * dentro do próprio mês responderia outra pergunta — e daria zero recorrentes
 * em toda estética cujo ciclo de retorno é maior que trinta dias, que é a
 * maioria.
 *
 * Cliente que não aparece no histórico conta como novo: o histórico é a única
 * evidência de que ele já existia.
 */
export function calcularRecorrencia(
  doMes: AdminAppointment[],
  historico: AdminAppointment[],
  inicioDoMesMs: number,
): Recorrencia {
  const doMesIds = new Set(
    doMes.map(i => i.customerUid?.trim()).filter((id): id is string => Boolean(id)),
  );

  const jaVinhaAntes = new Set(
    historico
      .filter(i => i.startAtMs < inicioDoMesMs)
      .map(i => i.customerUid?.trim())
      .filter((id): id is string => Boolean(id)),
  );

  let recorrentes = 0;
  for (const id of doMesIds) {
    if (jaVinhaAntes.has(id)) recorrentes += 1;
  }

  return {
    clientes: doMesIds.size,
    recorrentes,
    novos: doMesIds.size - recorrentes,
  };
}

/**
 * Quem já foi cliente e parou de voltar.
 *
 * Conta a partir de agora, não do mês que a tela está mostrando: "há 40 dias
 * sem voltar" só significa alguma coisa em relação a hoje. Por isso este cartão
 * não anda com as setas de mês.
 *
 * Ordena do mais sumido para o menos sumido — é a ordem em que vale a pena
 * ligar.
 */
export function clientesSumidos(
  historico: AdminAppointment[],
  agoraMs: number,
  diasLimite: number,
  limite = 5,
): ClienteSumido[] {
  const porCliente = consolidar(historico);
  const sumidos: ClienteSumido[] = [];

  for (const [clienteId, visita] of porCliente) {
    const diasSemVoltar = Math.floor((agoraMs - visita.ultimaMs) / DIA_MS);
    if (diasSemVoltar < diasLimite) continue;

    sumidos.push({
      clienteId,
      nome: visita.nome,
      visitas: visita.visitas,
      ultimaVisitaMs: visita.ultimaMs,
      diasSemVoltar,
    });
  }

  return sumidos
    .sort(
      (a, b) =>
        b.diasSemVoltar - a.diasSemVoltar ||
        b.visitas - a.visitas ||
        a.nome.localeCompare(b.nome, 'pt-BR'),
    )
    .slice(0, limite);
}
