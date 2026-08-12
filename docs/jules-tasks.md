# Tarefas recorrentes para o Jules

Prompts prontos para colar no [Jules](https://jules.google). Foram escritos para
serem **repetíveis**: o agente escolhe os alvos a cada execução, em vez de seguir
uma lista fixa que envelhece. Todos assumem que o `AGENTS.md` da raiz é lido.

---

## 1. Testes unitários

> Siga o AGENTS.md.
>
> Sua tarefa é aumentar a proteção real do projeto com testes unitários.
>
> **Escolha você os alvos.** Rode `npm run test:cov`, leia o relatório e
> identifique a lógica de maior risco que hoje está sem proteção. Priorize
> nesta ordem:
>
> 1. autorização e autenticação (quem pode fazer o quê)
> 2. isolamento entre shops (multi-tenant)
> 3. regras de negócio de agendamento (cancelamento, no-show, disponibilidade,
>    preço)
> 4. assinatura e pagamento
> 5. services e repositórios que falam com o Firestore
> 6. hooks com lógica de estado
> 7. validações e utilitários
>
> **Barreira de qualidade — um teste só entra se protege comportamento:**
>
> - Teste o que quebraria em produção: caminho feliz, falha, e casos-limite.
> - Asserte resultado e efeito (o service certo foi chamado com os argumentos
>   certos), não a existência do mock.
> - Nome do teste descreve o comportamento. `it('impede cancelar agendamento
apos o horario de inicio')`, não `it('funciona')`.
> - Proibido: teste trivial só para subir percentual, snapshot sem asserção,
>   teste que valida o mock em vez do código, teste de cor/margem/tema.
> - Se para testar algo você precisaria alterar produção, prefira não alterar —
>   e explique o obstáculo no relatório.
>
> **Escopo por execução:** concentre em UMA área (uma feature ou uma camada) e
> abra um PR revisável. É melhor entregar 8 testes bons numa área do que 60
> espalhados por todo o projeto.
>
> **Antes de finalizar:** rode `npx tsc --noEmit`, `npm run lint`,
> `npm run format:check`, `npm test` e `npm run test:cov`. Não baixe o
> `coverageThreshold`.
>
> **Relate:** área escolhida e por quê, comportamentos agora protegidos,
> cobertura antes/depois, e as áreas de maior risco que continuam sem teste
> (para a próxima execução).

---

## 2. Auditoria de segurança

> Siga o AGENTS.md. Faça uma auditoria de segurança do DetailGo.
>
> **NÃO altere código nesta tarefa.**
>
> Investigue pelo menos:
>
> - credenciais expostas no código e no histórico do Git
> - dados sensíveis em log (tokens, telefone, e-mail, payload de pagamento)
> - `firestore.rules` e `storage.rules`
> - autenticação nas Cloud Functions e no webhook do MercadoPago
> - ativação de assinatura e estado de pagamento
> - escalação de papel (`customer` virando `owner`)
> - travessia entre tenants: um customer ou owner alcançando dados de outra
>   estética
> - validação de entrada
> - armazenamento local inseguro
>
> Entregue relatório com os achados classificados em CRÍTICO, ALTO, MÉDIO e
> BAIXO. Para cada um: arquivo afetado, comportamento vulnerável, impacto
> possível, correção recomendada e se cabe teste de regressão.
>
> Se não encontrar nada em alguma categoria, diga explicitamente — não invente
> achado para preencher o relatório.

---

## 3. Vulnerabilidades de dependência

> Siga o AGENTS.md.
>
> Analise o estado atual de segurança das dependências do projeto. Rode
> `npm audit` e avalie **todas** as vulnerabilidades reportadas no momento da
> execução — esta tarefa é recorrente, então não assuma nenhuma lista fixa.
>
> **Restrições:**
>
> - NÃO rode `npm audit fix --force`.
> - NÃO atualize o núcleo React / React Native nem o toolchain
>   `@react-native/*`. O `renovate.json` os trava de propósito, por
>   compatibilidade com RN 0.81 / React 19. Upgrade desses é manual e planejado.
> - NÃO faça upgrade amplo de pacotes como efeito colateral.
>
> **Para cada vulnerabilidade:** pacote, severidade, se é dependência direta ou
> transitiva, qual caminho a puxa, se a correção tem breaking change, e qual o
> risco **real neste app** (uma falha numa ferramenta de build não tem o mesmo
> peso que uma em código que roda no dispositivo do cliente).
>
> **Aplique apenas** as correções seguras, sem breaking change e verificáveis.
> Rode a suíte completa depois. As demais, liste como recomendação para decisão
> humana, com o motivo de não terem sido aplicadas.
>
> Se o `npm audit` não reportar nada, diga isso e encerre — não force mudança.

---

## Ordem sugerida no início

Comece pela **auditoria (2)**, que não altera código e mostra a qualidade do
agente sem risco. Depois **testes (1)**. Deixe **dependências (3)** por último,
por ser a de maior chance de quebrar o build.

Só ligue execução automática recorrente depois de alguns PRs revisados na mão,
quando você já confiar no padrão das entregas.
