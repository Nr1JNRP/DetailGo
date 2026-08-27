# Migração do pagamento para o Asaas

**Data:** 27/08/2026
**Objetivo:** trocar o MercadoPago pelo Asaas na assinatura mensal do dono de
estética (R$ 89/mês), com Pix e cartão de crédito recorrente.

---

## Por que

Hoje não existe recorrência. O `createPixCharge` gera uma cobrança avulsa e o
webhook soma 30 dias no `activeUntil` — o dono precisa lembrar de pagar todo mês.
Quem esquece perde o acesso ao painel, e o produto perde receita por desatenção,
não por decisão.

O Asaas tem assinatura nativa: gera a cobrança sozinho e, no cartão, **cobra
automaticamente**.

---

## Decisões tomadas

| Decisão                     | Escolha                             | Motivo                                                                                                                                |
| --------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Dados do cartão             | Checkout hospedado no Asaas         | O número do cartão nunca toca o app nem as functions — tira o projeto do escopo de PCI-DSS e elimina a tela de cartão                 |
| Onde o checkout abre        | Navegador do sistema, via `Linking` | WebView exigiria `react-native-webview`, uma dependência nativa permanente, para o dono não sair do app por 40 segundos. Não compensa |
| Convivência com MercadoPago | Nenhuma — remoção completa          | Ninguém paga pelo MercadoPago hoje. Código de convivência seria complexidade sem beneficiário                                         |
| Inadimplência               | Carência de 5 dias                  | Cartão vencido é problema banal; derrubar a agenda no meio do expediente perde cliente por nada. O Asaas retenta nesse intervalo      |
| Cancelamento pelo app       | Fora de escopo                      | O dono cancela pelo próprio Asaas. Ninguém pediu                                                                                      |

---

## Fluxo

```
App (SubscriptionScreen)
  │  "Assinar" → POST createAsaasCheckout   (Bearer: Firebase ID token)
  ▼
createAsaasCheckout  [Cloud Function]
  │  valida o token, resolve o uid, confere que é o dono do shop
  │  POST /v3/checkouts
  │    billingTypes: ["PIX", "CREDIT_CARD"]
  │    chargeTypes:  ["RECURRENT"]
  │    subscription: { cycle: "MONTHLY", nextDueDate }
  │  devolve { link }
  ▼
App abre o link (Linking.openURL)
  │  o dono escolhe Pix ou cartão e informa o próprio CPF/CNPJ no Asaas
  ▼
asaasWebhook  [Cloud Function]
     valida o cabeçalho asaas-access-token (comparação em tempo constante)
     PAYMENT_CONFIRMED / PAYMENT_RECEIVED → activeUntil += 30 dias, status active
     PAYMENT_OVERDUE                      → registra a falha
```

### Duas regras que a documentação do Asaas impõe

**A confirmação vem só pelo webhook.** O `successUrl` do checkout redireciona o
navegador e nada mais. Liberar acesso com base nele deixaria qualquer um ativar
a assinatura abrindo a URL de sucesso na mão.

**O CPF/CNPJ é digitado no checkout.** Nada muda no cadastro do app nem no
modelo de dados por causa disso.

---

## Modelo de dados

Um campo novo em `shops/{shopId}`:

```ts
asaasSubscriptionId?: string; // referência da assinatura: suporte e trava
                              // contra criar assinatura duplicada
```

`subscriptionStatus` (`trial` | `active` | `inactive`) e `activeUntil` continuam
como estão. Cada pagamento confirmado soma 30 dias, igual hoje.

A coleção `payments` segue existindo, agora alimentada pelo Asaas. As regras do
Firestore corrigidas em 27/08 (leitura só do dono do shop) valem sem alteração.

### Carência

A regra entra em um lugar só, o `computeSubscription` em
`src/features/shops/state/shop.store.ts`, que passa a devolver `isInGrace`:

- `now <= activeUntil` → ativo, sem aviso
- `activeUntil < now <= activeUntil + 5 dias` → ativo, com aviso de pendência e
  botão para regularizar
- depois disso → bloqueado

Concentrar isso numa função pura mantém o teste sem rede e sem Firestore.

---

## O que é removido

```
functions/src/payment/createPixCharge.ts       → createAsaasCheckout.ts
functions/src/payment/mercadoPagoWebhook.ts    → asaasWebhook.ts
dependência "mercadopago" em functions/        → removida
```

O PR #122, que adiciona validação HMAC ao webhook do MercadoPago, é fechado sem
merge: ele nunca chegou à `main` e o webhook que ele protege deixa de existir. A
ideia de validar a origem antes de qualquer trabalho, e de comparar em tempo
constante, é reaproveitada no `asaasWebhook` — o Asaas usa token estático no
cabeçalho `asaas-access-token`, não HMAC.

O `SubscriptionScreen` perde a tela de QR Code — o Pix passa a ser gerado dentro
do checkout. Sobra o status da assinatura e o botão de assinar.

---

## Testes

| Camada                        | Como                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| Validação do token do webhook | Teste unitário da função pura, incluindo token errado, ausente e malformado             |
| Renovação e carência          | `computeSubscription` com relógio falso: dentro do prazo, dentro da carência, fora dela |
| Processamento dos eventos     | Função pura que recebe o evento e devolve o que gravar — testada sem Firestore          |
| Ponta a ponta                 | Sandbox do Asaas, que emite cobrança de mentira e dispara webhook real                  |

Nenhum teste automatizado move dinheiro nem depende de rede.

---

## Configuração (fora do repositório)

Duas credenciais, ambas no Firebase Secrets Manager. Nenhuma delas entra no
código, no Git ou em log:

```
firebase functions:secrets:set ASAAS_API_KEY
firebase functions:secrets:set ASAAS_WEBHOOK_TOKEN
```

A URL base da API fica configurável, porque muda entre sandbox e produção.

No painel do Asaas: criar o webhook apontando para a function, guardar o
`authToken` gerado, e assinar os eventos `PAYMENT_CONFIRMED`,
`PAYMENT_RECEIVED` e `PAYMENT_OVERDUE`.

**O deploy depende dos segredos existirem.** Sem eles a function recusa tudo e
nenhuma assinatura ativa.

---

## Riscos

**Webhook perdido.** Se o Asaas entregar e a function falhar, o dono paga e não
libera. Mitigação: o Asaas reenvia em caso de erro, e a function responde 200
apenas depois de gravar. A carência de 5 dias também cobre o atraso.

**Pagamento duplicado.** O mesmo evento pode chegar duas vezes. Mitigação: o
processamento é idempotente — soma 30 dias apenas se o `paymentId` ainda não
estiver marcado como confirmado, o mesmo padrão que o webhook atual já usa com
`previousPaymentStatus`.

**Sandbox e produção trocados.** Chave de sandbox em produção não cobra
ninguém, e ninguém percebe até o fim do mês. Mitigação: a URL base vem de
configuração explícita, não de padrão implícito.
