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
