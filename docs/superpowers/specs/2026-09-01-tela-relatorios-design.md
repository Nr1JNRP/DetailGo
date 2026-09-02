# Tela de Relatórios do dono

## Problema

O dono da estética não tem como olhar o próprio negócio no app. Ele vê a agenda
do dia e o histórico item a item, mas não consegue responder a pergunta mais
básica: **o que eu mais faço?**

Sem isso ele não sabe qual serviço sustenta a loja, nem qual está parado no
catálogo sem ninguém pedir.

## Escopo

> **Revisado em 02/09/2026.** A primeira versão entregou um gráfico de barras
> verticais com o nome do serviço truncado no eixo, mais uma lista de números.
> O dono achou pobre, e com razão: barra vertical não comporta nome de serviço,
> e uma lista de quantidades não é análise. Esta seção descreve o que a tela é
> agora; o restante do documento continua valendo.

A tela responde, em ordem, do mais imediato ao mais analítico:

1. **Resumo** — serviços, faturamento e ticket médio do mês.
2. **Destaques** — serviço campeão, veículo mais atendido e cliente do mês, cada
   um como uma frase com o vencedor, não como gráfico.
3. **Serviços realizados** — rosca com legenda ao lado. O nome vai na legenda
   inteiro; é o que resolve o truncamento.
4. **O que mais rende** — os mesmos serviços ordenados por faturamento, com uma
   frase comparando com o volume.
5. **Movimento por dia** — a semana inteira, em ordem cronológica.
6. **Horários mais procurados** — da primeira à última hora atendida.
7. **Veículos atendidos** — barras por categoria, com moto em faixa própria.
8. **Quem voltou** — quantos clientes do mês já eram clientes antes dele.
9. **Melhores clientes** — pódio de três, com visitas e total gasto.
10. **Clientes sumidos** — quem parou de voltar, contado de hoje.

Os cartões ficam em quatro seções: o mês, Serviços, Agenda e Clientes.

Continuam de fora: no-show e cancelamentos. A tela é uma pilha de cartões
independentes e recebe mais quando o dono quiser.

### Dois cartões que não pertencem ao mês

"Quem voltou" e "Clientes sumidos" precisam de histórico anterior ao mês que a
tela está mostrando. "Recorrente" só significa alguma coisa em relação ao que
veio antes, e "há 40 dias sem voltar" só se conta a partir de hoje — se contasse
a partir do fim do mês escolhido, o número mudaria a cada seta e não diria nada.

Por isso existe uma segunda consulta, dos últimos doze meses, buscada uma vez e
independente da navegação por mês. Uma falha nela esvazia esses dois cartões e
deixa o resto do relatório de pé.

"Clientes sumidos" é o cartão mais acionável da tela: é a lista de quem ligar. O
corte é 45 dias, escolhido pelo dono.

### Dia da semana e horário em ordem cronológica

Os dois são os únicos gráficos que não ordenam do maior para o menor. Ordenados
por volume, respondem qual é o dia cheio — mas escondem o formato da semana, e o
formato é onde está o buraco. Terça de manhã vazia é o que vira promoção de
terça. Pela mesma razão, dia e hora sem movimento aparecem com zero em vez de
sumir.

### Por que "O que mais rende" existe

É o cartão que justifica a tela. O serviço que mais ocupa a agenda quase nunca é
o que mais paga as contas, e essa diferença é decisão de negócio: onde subir
preço, o que divulgar, o que talvez não compense. Na massa de agosto a Lavagem é
43% do volume e 25% do faturamento; o Polimento é 11% do volume e 25% do
faturamento.

A frase só aparece quando os dois são serviços diferentes. Quando coincidem, não
há o que dizer e a tela não diz nada — texto para todo caso vira ruído.

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

Abaixo do seletor vêm os cartões, na ordem descrita no Escopo, separados pelos
títulos de seção. O cartão de clientes sumidos é o último e o único que não
responde ao seletor.

### Dados

Duas consultas em `shops/{shopId}/appointments`, ambas servidas pelo índice
composto `status ASC + startAtMs ASC` de escopo COLLECTION, que já existe no
projeto.

A do mês, refeita a cada troca de seta:

```
where status == 'done'
where startAtMs >= inicioDoMes
where startAtMs <  inicioDoMesSeguinte
orderBy startAtMs
```

A do histórico de clientes, buscada uma vez:

```
where status == 'done'
where startAtMs >= hoje menos 12 meses
orderBy startAtMs DESC
```

As duas têm teto de 2000 documentos, e é por isso que a segunda vai em ordem
decrescente: quando o teto cortar, é a ordem que decide o que sobra. Crescente
guardaria os atendimentos mais antigos e descartaria os recentes — numa loja com
mais de 2000 serviços no ano, todo cliente ativo apareceria como sumido. A do
mês não corre esse risco porque já está limitada pelo intervalo do mês.

A segunda é servida pelo índice `status ASC + startAtMs DESC`, o mesmo que o
Histórico do dono usa.

A agregação acontece no cliente: uma estética faz dezenas a poucas centenas de
serviços por mês, e somar em memória é mais simples e mais barato que manter
contadores agregados — sem o risco de o agregado divergir do histórico real.

### Separação

Cada cartão vem de uma função pura sobre as listas buscadas, testável sem
Firestore e sem React:

- `domain/serviceReport.ts` — `agruparPorServico`, `ordenarPorFaturamento` e
  `insightDeFaturamento` (a frase do cartão 4).
- `domain/veiculos.ts` — `agruparPorVeiculo`, com moto em faixa própria.
- `domain/clientes.ts` — `rankearClientes`, agrupando por uid.
- `domain/resumo.ts` — os três números do topo.
- `domain/destaques.ts` — compõe os três acima e devolve os campeões.
- `domain/periodo.ts` — limites e navegação de mês.
- `domain/paleta.ts` — tons derivados da cor primária do tema.
- `domain/valorCurto.ts` — dinheiro sem centavos, para os cartões estreitos.
- `domain/agenda.ts` — `agruparPorDiaDaSemana` e `agruparPorHorario`.
- `domain/recorrencia.ts` — `calcularRecorrencia` e `clientesSumidos`.
- `data/reportsRepo.ts` — as duas consultas. Só busca.
- `components/` — `RoscaDeServicos`, `BarrasProporcionais`, `PodioDeClientes` e
  `CartaoDeSumidos`. Só desenham.
- `screens/ReportsScreen.tsx` — monta os cartões. Não calcula nada.

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

**A identidade do cliente é o `customerUid`, nunca o nome.** Dois clientes
homônimos são duas pessoas e contam separado; um cliente que trocou o nome no
perfil continua sendo o mesmo. O nome é só um rótulo copiado para exibir. O
efeito visível é que dois homônimos aparecem como duas linhas iguais no pódio, e
isso está certo.

O caso inverso não tem solução aqui: a mesma pessoa com duas contas no app vira
dois clientes, e o relatório subestima a recorrência. Resolver exigiria casar
contas por telefone ou documento, que é decisão de produto e não de relatório.

**"Já era cliente" significa "já fez serviço nesta loja".** Não é cadastro no
app. A consulta lê `shops/{shopId}/appointments`, então alguém que se cadastrou
no DetailGo e nunca foi atendido aqui não aparece em lugar nenhum deste
relatório.

**A janela de 12 meses é definição, não limitação.** Quem sumiu há mais de um ano
não é candidato a ligação de retorno, e quem volta depois de um ano se comporta
como cliente novo. Alargar a janela traria mais dados para piorar os dois
números.

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
