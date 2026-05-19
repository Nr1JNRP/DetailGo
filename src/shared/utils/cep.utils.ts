export type CepResult = {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
};

/**
 * Remove tudo que não for dígito do CEP
 */
export function cepOnlyDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8);
}

/**
 * Formata o CEP: 00000-000
 */
export function cepMask(value: string): string {
  const digits = cepOnlyDigits(value);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/**
 * Busca endereço pelo CEP usando ViaCEP (gratuito, sem chave)
 * Retorna null se o CEP for inválido ou não encontrado
 */
export async function fetchCep(cep: string): Promise<CepResult | null> {
  const digits = cepOnlyDigits(cep);

  if (digits.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) return null;

    const data: CepResult = await res.json();

    if (data.erro) return null;

    return data;
  } catch {
    return null;
  }
}

/**
 * Monta o endereço completo a partir do resultado do ViaCEP
 */
export function formatCepAddress(data: CepResult): { address: string; city: string } {
  const parts = [data.logradouro, data.bairro].filter(Boolean);
  return {
    address: parts.join(', '),
    city: `${data.localidade} - ${data.uf}`,
  };
}
