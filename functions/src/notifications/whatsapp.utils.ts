/**
 * Converte um telefone armazenado (só dígitos, ex.: "11999998888") no formato
 * que o Twilio/WhatsApp espera: "whatsapp:+55DDDNUMERO".
 *
 * - < 10 dígitos → inválido (retorna null).
 * - 10-11 dígitos (DDD + número, padrão BR) → adiciona o código do país 55.
 * - 12-13 dígitos → assume que já veio com o código do país.
 */
export function toWhatsAppNumber(rawPhone: string | undefined | null): string | null {
  const digits = (rawPhone ?? '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return `whatsapp:+${withCountry}`;
}

/**
 * Monta o corpo da chamada `client.messages.create` do Twilio.
 *
 * O WhatsApp exige **template** (contentSid) para mensagens iniciadas pela
 * empresa — texto livre só vale dentro da janela de 24h e nem sempre é aceito.
 * Então: se houver `contentSid`, manda via template (com as variáveis); senão,
 * cai no texto livre (`fallbackBody`).
 */
export type TwilioMessagePayload = {
  from: string;
  to: string;
  body?: string;
  contentSid?: string;
  contentVariables?: string;
};

export function buildTwilioMessage(params: {
  from: string;
  to: string;
  contentSid?: string | null;
  contentVariables?: Record<string, string>;
  fallbackBody: string;
}): TwilioMessagePayload {
  const { from, to, contentSid, contentVariables, fallbackBody } = params;

  if (contentSid) {
    return {
      from,
      to,
      contentSid,
      contentVariables: JSON.stringify(contentVariables ?? {}),
    };
  }

  return { from, to, body: fallbackBody };
}
