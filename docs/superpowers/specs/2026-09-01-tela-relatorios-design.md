# Tela de Relatórios do dono

## Problema

O dono da estética não tem como olhar o próprio negócio no app. Ele vê a agenda
do dia e o histórico item a item, mas não consegue responder a pergunta mais
básica: **o que eu mais faço?**

Sem isso ele não sabe qual serviço sustenta a loja, nem qual está parado no
catálogo sem ninguém pedir.

## Escopo

Um gráfico: serviços concluídos no mês, do mais feito ao menos feito.

Ficaram de fora, propostas e adiadas: resumo com faturamento e ticket médio,
no-show e cancelamentos, movimento por dia da semana, retenção de clientes.
Entram depois se o dono quiser — a tela é construída para receber mais cartões.

## Como funciona

### Navegação

Item **Relatórios** no menu lateral do dono, depois de Histórico. Rota `Reports`.

O nome da rota não se repete em nenhum outro grupo do `RootNavigator`. Repetir
um nome entre os grupos faz o React Navigation preservar a rota atual na troca,
que foi o bug do PR #132.

### A tela

Mês corrente por padrão, com setas ‹ › para voltar e avançar meses. A navegação
por mês não é enfeite: no dia 2 do mês o relatório do mês atual está quase
vazio, e sem as setas a tela nasce inútil em boa parte do tempo. A seta de
avançar some no mês corrente — não há futuro para olhar.

Cabeçalho com o mês e o total de serviços concluídos. Abaixo, barras
horizontais ordenadas da maior para a menor, cada uma com o nome do serviço, a
quantidade e quanto rendeu.

### Dados

Uma consulta em `shops/{shopId}/appointments`:

```
where status == 'done'
where startAtMs >= inicioDoMes
where startAtMs <  inicioDoMesSeguinte
orderBy startAtMs
```

Servida pelo índice composto `status ASC + startAtMs ASC` de escopo COLLECTION,
que já existe no projeto.

A agregação acontece no cliente. Uma estética faz dezenas a poucas centenas de
serviços por mês; trazer isso e somar em memória é mais simples e mais barato
que manter contadores agregados, e não corre o risco de o agregado divergir do
histórico real.

### Separação

- `reports/domain/serviceReport.ts` — `agruparPorServico(agendamentos)`, função
  pura. Recebe agendamentos, devolve a lista ordenada com nome, quantidade e
  faturamento. Todas as decisões sobre dado incompleto moram aqui, e todas são
  testáveis sem Firestore e sem React.
- `reports/domain/periodo.ts` — `limitesDoMes(ano, mes)` e o rótulo do mês.
- `reports/data/reportsRepo.ts` — a consulta ao Firestore. Só busca.
- `reports/screens/ReportsScreen.tsx` — só desenha.

### Estado vazio

Quando o mês não tem nada concluído, a tela explica por quê em vez de mostrar um
gráfico em branco:

> Nenhum serviço concluído em setembro. O relatório conta os agendamentos que
> você marcou como concluídos no painel.

Isso importa porque `done` é marcado à mão pelo dono no painel — nenhuma rotina
conclui agendamento automaticamente. Um dono que esquece de marcar veria uma
tela vazia e concluiria que o app está quebrado.

## Decisões

**Agrupar pelo nome do serviço, não pelo id do catálogo.** O agendamento guarda
`serviceLabel`, uma cópia do nome no momento em que foi marcado. Renomear um
serviço no catálogo faz o histórico antigo continuar com o nome antigo e virar
duas barras. É o comportamento certo — o passado não muda quando o catálogo
muda — mas surpreende, então está escrito aqui.

**Só `done` conta.** "Realizado" é o que foi concluído. Cancelado e no-show não
são serviço prestado, e misturá-los inflaria o número que o dono usa para
decidir.

**`react-native-gifted-charts` para desenhar.** Roda sobre `react-native-svg` e
`react-native-linear-gradient`, ambos já instalados: nenhum módulo nativo novo,
o APK e o build Android não mudam.

## Pendência que entra junto

Três índices compostos rodam em produção sem estar no `firestore.indexes.json`:

| Coleção      | Escopo     | Campos                           | Usado por                             |
| ------------ | ---------- | -------------------------------- | ------------------------------------- |
| appointments | COLLECTION | status ASC + startAtMs ASC       | agenda do painel, e agora o relatório |
| appointments | COLLECTION | status ASC + startAtMs DESC      | histórico do dono                     |
| shops        | COLLECTION | isVisibleOnMap ASC + geohash ASC | busca de estéticas no mapa            |

Um `firebase deploy --only firestore:indexes` ofereceria apagar os três, e isso
derrubaria o histórico e o mapa. Os três passam a ser declarados no arquivo.

## Testes

- `agruparPorServico`: ordenação, empate, agendamento sem preço, `serviceLabel`
  nulo, lista vazia, dois nomes diferentes que não devem se fundir.
- `limitesDoMes`: virada de ano, mês com 28/30/31 dias.
- A tela: carrega o mês corrente, troca de mês pelas setas, estado vazio com a
  explicação, erro de consulta, e a seta de avançar ausente no mês corrente.
