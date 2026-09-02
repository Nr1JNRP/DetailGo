import type { AdminAppointment } from '@features/admin';

export type LinhaDeCliente = {
  clienteId: string;
  nome: string;
  visitas: number;
  total: number;
};

const SEM_NOME = 'Cliente';

/**
 * Clientes do mês, do que mais voltou ao que menos voltou.
 *
 * Agrupa por `customerUid`, não pelo nome: dois clientes homônimos são duas
 * pessoas, e um cliente que trocou o nome no perfil continua sendo o mesmo.
 * O nome exibido é o do atendimento mais recente, que é o mais provável de
 * estar atualizado.
 *
 * Empate em visitas desempata pelo quanto gastou, e depois pelo nome — sem o
 * terceiro critério o pódio trocaria de ordem sozinho ao reabrir a tela.
 */
export function rankearClientes(agendamentos: AdminAppointment[], limite = 3): LinhaDeCliente[] {
  const porCliente = new Map<string, LinhaDeCliente & { ultimoAtendimento: number }>();

  for (const item of agendamentos) {
    const clienteId = item.customerUid?.trim();
    if (!clienteId) continue;

    const nome = item.customerName?.trim() || SEM_NOME;
    const valor = typeof item.price === 'number' ? item.price : 0;
    const atual = porCliente.get(clienteId);

    if (!atual) {
      porCliente.set(clienteId, {
        clienteId,
        nome,
        visitas: 1,
        total: valor,
        ultimoAtendimento: item.startAtMs,
      });
      continue;
    }

    atual.visitas += 1;
    atual.total += valor;
    if (item.startAtMs >= atual.ultimoAtendimento) {
      atual.nome = nome;
      atual.ultimoAtendimento = item.startAtMs;
    }
  }

  return [...porCliente.values()]
    .sort(
      (a, b) => b.visitas - a.visitas || b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'),
    )
    .slice(0, limite)
    .map(({ clienteId, nome, visitas, total }) => ({ clienteId, nome, visitas, total }));
}
