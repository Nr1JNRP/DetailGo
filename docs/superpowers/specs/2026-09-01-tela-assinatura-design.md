# Tela de assinatura do dono

**Data:** 01/09/2026
**Objetivo:** dar ao dono um lugar para ver a situação da assinatura e cancelar,
sem precisar do painel do Asaas.

---

## Por que

A cobrança pelo Asaas já funciona, mas o dono não tem visibilidade nenhuma: não
sabe qual forma de pagamento está ativa, quando é a próxima cobrança, nem como
cancelar. Hoje a única saída é entrar no painel do Asaas — que ele nem sabe que
existe.

Cancelamento foi adiado de propósito na migração (ver
`2026-08-27-pagamento-asaas-design.md`); esta é a entrega que faltava.

---

## Decisões

| Decisão            | Escolha                           | Motivo                                                                                                       |
| ------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Acesso ao cancelar | Vale até o fim do período pago    | Ele pagou por aqueles dias. Cortar na hora gera pedido de estorno e derruba agenda com cliente marcado       |
| Pix                | Mostra a situação, oferece cartão | Não há assinatura para cancelar. É o único momento em que ele pensa no assunto — vale oferecer a recorrência |
| Pausar assinatura  | Fora de escopo                    | Existe na API (`status: INACTIVE`), mas ninguém pediu                                                        |
| Dados do cartão    | Não prometidos                    | O `GET /v3/subscriptions/{id}` não devolve bandeira nem últimos dígitos                                      |

---

## O que a tela mostra

O Asaas **não devolve dados do cartão**. O `GET /v3/subscriptions/{id}` traz
apenas `billingType`, `status`, `value`, `cycle`, `nextDueDate` e `endDate`.

| Campo              | Origem                      |
| ------------------ | --------------------------- |
| Forma de pagamento | `billingType` da assinatura |
| Situação           | `status` da assinatura      |
| Valor              | `value`                     |
| Próxima cobrança   | `nextDueDate`               |
| Acesso válido até  | `activeUntil`, do Firestore |

Resultado: _"Cartão de crédito · R$ 89,00/mês · próxima cobrança em 12/10"_.

Bandeira e últimos quatro dígitos podem existir no payload do pagamento
(`payment.creditCard`), mas não está confirmado: no evento de Pix que
registramos esse campo não vinha, e o de cartão não foi inspecionado. Fica como
verificação posterior, não como promessa.

---

## Fluxo

```
Menu lateral → Assinatura
  │
  ├── tem asaasSubscriptionId?
  │     sim → GET /v3/subscriptions/{id} via Cloud Function
  │            mostra forma, valor, próxima cobrança + botão Cancelar
  │     não → pagamento avulso (Pix)
  │            mostra "válido até <activeUntil>" + botão "Mudar para cartão"
  │
  └── Cancelar → confirmação → DELETE /v3/subscriptions/{id}
                 limpa asaasSubscriptionId no shop
                 NÃO mexe no activeUntil
```

### Por que o acesso continua sem código extra

Cancelar não altera `activeUntil`. O Asaas para de cobrar, e o acesso expira
sozinho na data que já estava gravada — o `computeSubscription` cuida disso.
Sem campo novo, sem agendador, sem estado intermediário.

O `DELETE` também apaga as cobranças pendentes da assinatura; as já pagas
permanecem registradas. Quem pagou não perde nada.

---

## Componentes

**`getAsaasSubscription`** (Cloud Function) — recebe `shopId`, confere que o
requisitante é o dono, lê o `asaasSubscriptionId` do shop e consulta o Asaas.
Existe porque a chave de API não pode ir para o app.

**`cancelAsaasSubscription`** (Cloud Function) — mesma trava de dono, faz o
`DELETE` e limpa o `asaasSubscriptionId`. Sem a trava, qualquer autenticado
cancelaria a assinatura de outra estética.

**`SubscriptionDetailScreen`** — a tela, no stack do dono, alcançável pelo menu
lateral logo após "Perfil".

**`subscription.service.ts`** — o que o app usa para falar com as duas
functions, no mesmo padrão do `checkout.service.ts`.

---

## Testes

| Camada                        | Como                                                                              |
| ----------------------------- | --------------------------------------------------------------------------------- |
| Trava de dono                 | Unitário: dono de outra estética recebe 403                                       |
| Tradução da resposta          | Função pura: resposta do Asaas → o que a tela mostra, incluindo campos ausentes   |
| Tela                          | Com assinatura, sem assinatura (Pix), erro de carregamento, e o fluxo de cancelar |
| Cancelamento não corta acesso | Teste garantindo que o `activeUntil` não é tocado                                 |

---

## Riscos

**Cancelar por engano.** É definitivo. Mitigação: confirmação explícita dizendo
até quando o acesso continua valendo, para a decisão ser informada.

**Falha no meio do cancelamento.** Se o `DELETE` funcionar e a limpeza do
`asaasSubscriptionId` falhar, a tela mostraria uma assinatura que não existe
mais. Mitigação: o `GET` seguinte devolve 404 ou `deleted: true`, e a tela trata
isso como "sem assinatura".
