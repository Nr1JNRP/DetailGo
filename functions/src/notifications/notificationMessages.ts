/**
 * Monta o corpo da notificacao de "servico concluido" enviada ao cliente.
 *
 * Prefixa sempre com "Seu servico" para a concordancia ficar correta
 * independentemente do genero do nome do servico — evita o bug
 * "Seu Lavagem tecnica foi concluido" (o "Seu"/"concluido" passa a
 * concordar com "servico", nao com o nome do servico).
 *
 * Inclui o nome da estetica quando disponivel e usa "em" (neutro) para
 * funcionar com qualquer nome de shop, sem assumir genero.
 *
 * Fallbacks:
 *  - sem nome do servico  -> "Seu servico foi concluido em {estetica}. ..."
 *  - sem nome da estetica -> "Seu servico de {servico} foi concluido. ..."
 *  - sem ambos            -> "Seu servico foi concluido. ..."
 */
export function buildServiceDoneBody(params: {
  serviceLabel?: string | null;
  shopName?: string | null;
}): string {
  const service = params.serviceLabel?.trim();
  const shop = params.shopName?.trim();

  const servicePart = service ? `Seu serviço de ${service}` : 'Seu serviço';
  const shopPart = shop ? ` em ${shop}` : '';

  return `${servicePart} foi concluído${shopPart}. Aguardamos seu retorno. Obrigado pela preferência!`;
}
