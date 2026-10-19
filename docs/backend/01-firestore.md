# Firestore

## Coleções

| Coleção                 | Finalidade                  | Campos essenciais                                                                        |
| ----------------------- | --------------------------- | ---------------------------------------------------------------------------------------- |
| `events`                | configuração do evento      | `name`, `slug`, `startsAt`, `endsAt`, `isActive`                                         |
| `profiles`              | participante                | `userId`, `eventId`, dados públicos, `qrId`, `xp`, `xpReachedAt`, onboarding, timestamps |
| `adminUsers`            | autorização do painel       | Firebase UID no ID do documento e `isActive`                                             |
| `companies`             | patrocinadores              | `eventId`, nome, descrição, imagens, `qrId`, estado e XP opcional                        |
| `tags`                  | itens escondidos            | `eventId`, nome, descrição, imagem, `qrId`, estado, ordem e XP opcional                  |
| `speakers`              | palestrantes                | `eventId`, nome, empresa, cargo, biografia, foto, redes sociais e visibilidade           |
| `talks`                 | palestras e painéis         | `eventId`, conteúdo, formato, `speakerIds`, estado e liberação manual da avaliação       |
| `schedule`              | atividades do cronograma    | `eventId`, início, fim, trilha e referência à palestra ou atividade geral                |
| `missions`              | missões                     | evento, conteúdo, validação, pré-requisitos, QR opcional, XP, estado e ordem             |
| `ticketTransactions`    | movimentações de tickets    | evento, participante, tipo, quantidade, XP convertido, operador, referência e timestamp  |
| `eventOperations`       | controles operacionais      | evento, conversões, resgates, fechamento e responsável                                   |
| `rewards`               | catálogo de brindes         | evento, conteúdo, custo, estoque, limites e estado                                       |
| `rewardRedemptions`     | resgates de brindes         | evento, participante, brinde, quantidade, custo, operador e timestamp                    |
| `raffleEntryChunks`     | fotografia das chances      | evento, snapshot e blocos de até 100 participantes                                       |
| `raffleWinners`         | exclusões entre sorteios    | evento, participante, prêmio, confirmação e operador                                     |
| `raffleAttempts`        | tentativas dos sorteios     | prêmio, candidato, peso, universo, resultado, operador e timestamps                      |
| `raffleSkippedProfiles` | exclusões por dado inválido | evento, participante, motivo controlado e instante da fotografia                         |
| `raffles`               | sorteios ponderados         | evento, prêmio, estado, fotografia, universo elegível e vencedor                         |
| `raffleTestRuns`        | simulações administrativas  | fotografia isolada, progresso, prêmios, tentativas e resultados                          |
| `connections`           | networking                  | `eventId`, perfis, status, criação, remoção e XP concedida                               |
| `activityCompletions`   | progresso e carimbos        | evento, participante, tipo, entidade, QR, XP concedida e conclusão                       |
| `participantSummaries`  | resumo individual leve      | evento, participante, contadores de conexões e atividades, inicialização e atualização   |
| `scans`                 | histórico de leituras       | `eventId`, perfil, tipo, alvo, QR e timestamp                                            |
| `talk-ratings`          | avaliações de palestras     | `eventId`, palestra, avaliador, respostas e timestamp                                    |

Schemas completos devem existir no código e ser validados com Zod. Este documento registra o modelo conceitual, não substitui os contratos tipados.

Os catálogos ativos de empresas, tags e missões usam cache compartilhado de
15 minutos por evento. Brindes usam cache de 30 segundos porque o estoque é
mutável; um resgate concluído invalida esse cache imediatamente. Dados
individuais, conclusões, saldos, resgates e operações permanecem fora do cache.
Os prazos também limitam a defasagem de alterações feitas pelo painel
administrativo externo. Administradores podem invalidar imediatamente os
quatro catálogos pela Central de Operações após uma alteração no painel.

As ações revalidam somente páginas que consomem os dados alterados. A listagem
de missões deriva conclusões e pré-requisitos de uma única leitura de
`activityCompletions`; o atendimento de brindes também reutiliza o mesmo
contexto autorizado do operador e do participante durante toda a requisição.

### Perfil implementado

O contrato inicial de `profiles` possui `userId`, `eventId`, `displayName`, `email`, `avatarUrl`, `bio`, `role`, `company`, `link`, `skills`, `qrId`, `onboardingCompleted`, `createdAt` e `updatedAt`. `qrId` é um UUID v4 público e estável, diferente do ID interno do documento. A Pokedex procura primeiro `profiles/{googleSub}` e usa o e-mail normalizado como fallback para encontrar perfis criados pelo painel com Firebase UID. A criação em `profiles/{userId}` ocorre somente quando nenhuma busca encontra resultado. O fallback por e-mail exige um único resultado; o repositório valida documentos lidos com Zod e converte `Timestamp` para `Date` antes de devolvê-los ao domínio.

`displayName` e `skills` são obrigatórios para concluir o perfil. O nome possui no mínimo 3 caracteres; `skills` armazena de 3 a 5 slugs únicos existentes no catálogo estático `data/skills.ts`; `bio` é opcional e aceita no máximo 200 caracteres; `role` é opcional e aceita no máximo 80 caracteres; `company` é opcional e aceita no máximo 100 caracteres; `link` é opcional e aceita uma única URL válida. Antes da conclusão, o documento pode manter `skills` vazio e os campos opcionais nulos.

A edição em `/profile/edit` envia somente esses campos editáveis para uma Server Action autenticada. O serviço valida novamente o contrato e o repositório atualiza o documento existente em transação, preservando identidade, evento, QR Code e datas de criação.

`accessRoles` armazena uma ou mais autorizações internas entre `participant`,
`staff`, `reviewer`, `editor` e `admin`. Novos perfis da Pokedex recebem
`["participant"]`; perfis administrativos provisionados pelo painel recebem
somente `["admin"]`. O campo não participa da edição do perfil. `role` continua
representando somente o cargo público. Participantes concluem normalmente o
onboarding; o painel cria administradores com onboarding concluído. Apenas
`participant` participa das atividades e recebe XP; `reviewer` e `admin` podem
validar missões presenciais.

No setup obrigatório, a mesma transação persiste os campos validados e define `onboardingCompleted: true`. A primeira conclusão de um participante concede 75 XP e atualiza `xpReachedAt`; repetições e perfis sem o papel `participant` não recebem XP. Perfis que já concluíram o onboarding não recebem crédito retroativo. Cancelar o setup não altera o documento; voltar apenas reinicia as etapas introdutórias.

Os campos `xp` e `xpReachedAt` armazenam a pontuação atual e o instante em que
ela foi atingida. Os valores concedidos por cada interação ficam centralizados
em `config/scores.ts`; o cliente não informa nem calcula pontuação.

### Networking

Cada documento de `connections` representa um único par de participantes no
evento. O ID é um hash determinístico do `eventId` e dos dois IDs de participante
em ordem canônica; por isso, leituras em sentidos opostos não criam
documentos duplicados.

O contrato possui `participantIds`, `requesterId`, `recipientId`, `status`,
`requestCount`, `firstRequestedAt`, `lastRequestedAt`, `acceptedAt`,
`rejectedAt`, `removedAt`, `removedBy`, `createdAt` e `updatedAt`. Os estados
`pending` e `rejected` permanecem reconhecidos para compatibilidade com dados
anteriores, mas o fluxo atual cria a conexão diretamente como `accepted`. Uma
nova leitura após remoção reutiliza o documento, incrementa `requestCount` e
preserva o histórico.

O intervalo de um minuto bloqueia somente a recriação do mesmo par após uma
remoção. A leitura de uma conexão já ativa retorna o estado atual de forma
idempotente e não concede XP novamente.

O contrato registra `xpAwardedPerParticipant`, `xpGrantedAt` e `xpRevokedAt`.
Ao criar a conexão, os dois participantes recebem os 5 XP definidos por
`SCORES.PARTICIPANT_CONNECTION`. A conexão e os dois perfis são atualizados na mesma
transação. A remoção por qualquer participante subtrai de ambos exatamente o
valor registrado na conexão, também atomicamente, sem apagar o histórico.

Na criação ou reativação, os perfis já foram validados pelo serviço antes da
transação. O repositório lê somente a conexão para garantir idempotência e usa
`FieldValue.increment()` para creditar atomicamente os dois perfis sem reler
seus saldos. A remoção continua lendo ambos os perfis antes do desconto para
impedir XP negativo caso exista alguma inconsistência.

### Empresas e visitas

Cada documento de `companies` possui `eventId`, um único `qrId` público,
`name`, `description`, `logoUrl`, `stampImageUrl`, `active`, `xpAwarded`,
`createdAt` e `updatedAt`. `stampImageUrl` é opcional; o passaporte usa
`logoUrl` como fallback. `xpAwarded` também é opcional e, quando ausente, a
visita usa `SCORES.COMPANY_VISIT`.

O QR Code identifica a empresa, mas não autoriza nem pontua sozinho. O servidor
valida sessão, evento, perfil concluído, existência e estado ativo dentro do
caso de uso.

A primeira visita cria um documento em `activityCompletions` e soma XP ao
perfil na mesma transação. O ID da conclusão é um hash determinístico de
`eventId`, participante, tipo `company` e ID interno da empresa. Assim,
releituras simultâneas ou posteriores retornam a conclusão existente sem criar
outro carimbo ou conceder XP novamente.

A conclusão registra `activityId`, `qrId`, `xpAwarded` e `completedAt`. Esse
registro representa também o carimbo da empresa e preserva o valor realmente
concedido mesmo que a configuração padrão seja alterada depois.

Visitas e carimbos são permanentes. Não existe operação de remoção, revogação
de XP ou nova conclusão para a mesma empresa.

O catálogo consulta as empresas do evento, filtra somente as ativas e ordena
os resultados por nome. O estado dos carimbos é obtido pelas conclusões do
participante. No detalhe, o ID determinístico permite buscar diretamente a
visita daquela empresa.

### Tags e descobertas

Cada documento de `tags` possui `eventId`, um único `qrId` público, `name`,
`description`, `imageUrl`, `active`, `order`, `xpAwarded`, `createdAt` e
`updatedAt`. Quando `xpAwarded` é nulo, a descoberta usa
`SCORES.TAG_DISCOVERY`.

A primeira leitura cria uma conclusão de tipo `tag` em
`activityCompletions` e soma XP ao perfil na mesma transação. O ID é um hash
determinístico de evento, participante, tipo e ID interno da tag. Descobertas e
XP são permanentes; releituras retornam o registro existente.

A coleção consulta somente tags ativas. Para itens ainda bloqueados, o service
projeta apenas um número de slot, sem enviar ID, nome, descrição ou imagem ao
cliente. Depois da descoberta, esses dados são revelados junto ao XP realmente
concedido.

### Missões

Cada missão possui `validationType` igual a `qr`, `reviewer`, `automatic` ou
`keyword` ou `quiz`. Apenas missões `qr` possuem `qrId`; os outros tipos usam `null`.
Missões QR, presenciais, por palavra-chave e quiz podem declarar pré-requisitos de
visita a empresa ou conclusão de outra missão. Automáticas usam somente
`progressRequirement` com metas de conexões, empresas ou conexões com interesses
em comum (`shared-interests`). Veja [networking por interesse](./08-interest-networking-missions.md).

Missões `keyword` exigem `keywordConfig` com `acceptedAnswers` (1 a 20 respostas
de até 120 caracteres) e `maxAttempts` (1 a 100). Nos outros tipos,
`keywordConfig` deve ser omitido ou `null`, mantendo compatibilidade com os
cadastros existentes. Veja o [contrato de palavra-chave](./07-keyword-missions.md).

Na validação presencial, um usuário `reviewer` ou `admin` escolhe a missão e
escaneia o QR temporário do participante. Não existe submissão pendente: a
aprovação cria diretamente uma conclusão de tipo `mission`, registrando
`validationType`, `validatedBy`, `validatedAt`, `xpAwarded` e `completedAt`.

O ID determinístico combina evento, participante, tipo `mission` e missão.
Perfil, autorização, estado da missão, pré-requisitos e duplicidade são
validados no servidor. A conclusão e o crédito de XP ocorrem na mesma
transação. Somente perfis com `participant` recebem a conclusão e os pontos.

### Passaporte

O passaporte não possui coleção própria. Ele combina as entidades ativas e as
conclusões de `company`, `tag` e `mission` já armazenadas em
`activityCompletions`. Essa projeção calcula totais, progresso, XP conquistado
nessas atividades e conclusões recentes sem duplicar dados ou executar
gravações.

Somente perfis com `participant` recebem a projeção. Os valores de XP são
obtidos das conclusões persistidas, preservando a recompensa efetivamente
concedida. Tags bloqueadas continuam anônimas.

### Palestrantes, palestras e cronograma

Palestrante, palestra e posição no cronograma são conceitos separados.
`speakers` armazena somente dados da pessoa: `name`, `company`, `title`,
`miniBio`, `photo`, `socialMedia` e `isVisible`. Título, descrição, categoria e
avaliação não pertencem ao palestrante. O ID do documento é a referência
estável; um `speakerSlug` separado só deve existir se representar uma URL
legível e diferente do ID.

`talks` armazena `title`, `description`, `category`, `format`, `speakerIds`,
`evaluationStatus` e `isActive`. `format` aceita `talk`, `panel` ou `keynote`.
A distinção entre keynote de abertura e de encerramento pertence à atividade do
`schedule`, não à palestra. A lista `speakerIds` permite vários participantes
em um painel e permite que a mesma pessoa participe de várias apresentações sem
manter uma lista duplicada de palestras no documento do palestrante.

`evaluationStatus` aceita `locked`, `open` ou `closed`. Somente administradores
alteram esse estado, e a liberação não depende do horário da apresentação. Não
é necessário registrar quem ou quando liberou a avaliação.

Cada documento de `talk-ratings` usa um ID determinístico derivado de evento,
participante e palestra. Ele armazena `speakerRating`, `contentRating`,
`comprehensionRating`, `comment`, `xpAwarded` e `completedAt`. As três notas
são inteiros obrigatórios entre 1 e 5; o comentário é obrigatório e contém de
20 a 500 caracteres. Avaliação e XP são persistidos na mesma transação. Um
reenvio devolve a avaliação existente sem conceder pontuação novamente, e o
estado `open` é validado no documento atual da palestra dentro da transação.

Cada documento de `schedule` representa uma atividade em uma faixa de horário.
Ele usa o mesmo contrato mantido pelo painel administrativo externo:
`startAt`, `endAt`, `track`, `order`, `activity`, `active`, `createdAt` e
`updatedAt`; todas as datas são `Timestamp`.

As trilhas válidas são `MINAS`, `CURADO`, `CANASTRA`, `TRANCA`, `COMUNIDADE` (Arena Comunidade 1),
`COMUNIDADE_2` (Arena Comunidade 2) e `LOUNGE_SENIOR` (Lounge Senior).
Uma atividade de `type: "talk"` possui `talkId` e exige uma trilha. Atividades
de `type: "opening_keynote"` e `closing_keynote` também possuem `talkId`, usam
`track: null` e `order: null`, e exigem uma palestra de `format: "keynote"`.
As atividades gerais `opening`, `break` e `closing` contêm `title`, não
referenciam palestras e também usam `track: null` e `order: null`.

A Pokédex lê somente documentos ativos do evento atual. Os dados da palestra e
dos palestrantes continuam sendo resolvidos em `talks` e `speakers`, evitando
duplicação de conteúdo no cronograma. A listagem de palestras usa `startAt` e
`order` para ordenação e exibe o intervalo e a trilha reais. Palestras sem uma
entrada ativa em `schedule` não são publicadas na experiência do participante.

### Resumo individual

`participantSummaries` é uma projeção leve usada por telas que precisam apenas
dos totais do participante. Ela armazena `connectionsCount`,
`companiesVisitedCount`, `tagsDiscoveredCount` e
`missionsCompletedCount`. XP, nível, tickets e posição no ranking não são
duplicados: continuam sendo obtidos de suas fontes de verdade.

Novos perfis recebem o resumo zerado na mesma transação de criação. Para
participantes anteriores à projeção, a primeira leitura reconstrói os
contadores a partir de `activityCompletions` e `connections` e persiste o
resultado. Essa inicialização também é transacional: uma conclusão ou conexão
concorrente provoca uma nova tentativa, evitando perda ou duplicação.

Depois da inicialização, a Home lê somente um documento de resumo. Visitas,
tags, missões e conexões atualizam seus contadores na mesma transação da
operação principal. A remoção de uma conexão decrementa as duas partes. As
coleções detalhadas continuam sendo a fonte auditável e alimentam as páginas
que precisam de IDs, datas ou conteúdo completo.

### Níveis e ranking

As dez faixas ficam centralizadas em `config/levels.ts`. O nível é derivado do
XP atual e não é persistido no perfil. A interface sempre combina número e
título, de `Nível 1 · Newbie` até `Nível 10 · Mestre do Endgame`. O último
nível começa em 4.000 XP; valores superiores continuam válidos para diferenciar
participantes no ranking.

O ranking consulta somente perfis concluídos do evento com `accessRoles`
contendo `participant`. A ordem usa `xp` decrescente, `xpReachedAt` crescente e
`userId` crescente. O identificador resolve o caso raro de XP e timestamp
idênticos.

Participantes entre os três primeiros recebem a lista das dez primeiras
posições. Os demais recebem o Top 3 e uma janela contextual com até três
posições anteriores e três posteriores, sem repetir o pódio.

O ranking usa uma consulta composta ordenada e `count()` até o cursor do
participante para calcular a posição sem carregar os perfis anteriores. Em
seguida, busca somente o Top 10 para participantes no pódio ou o Top 3 e os
vizinhos necessários para os demais. O perfil autenticado já fornece o cursor
atual e não é lido novamente pelo repositório.

A consulta completa anterior permanece temporariamente em cache por 60
segundos como fallback exclusivo para o erro `failed-precondition`, permitindo
que a aplicação continue funcionando enquanto o índice ainda estiver
indisponível. Outros erros não acionam o fallback e continuam visíveis para
diagnóstico.

#### Índice composto do ranking

A consulta paginada do ranking exige um índice estruturado composto na coleção
`profiles`. No Firebase Console em português:

1. abra **Build → Firestore Database → Índices**;
2. selecione a aba de índices compostos e clique em **Criar índice**;
3. escolha **Estruturado**, não **Vetorial**;
4. informe `profiles` como ID da coleção;
5. selecione **Coleção** como escopo da consulta;
6. adicione os campos na ordem abaixo;
7. crie o índice e aguarde o estado mudar de **Criando** para **Ativado**.

| Campo                 | Configuração no Console |
| --------------------- | ----------------------- |
| `accessRoles`         | Matrizes                |
| `eventId`             | Crescente               |
| `onboardingCompleted` | Crescente               |
| `xp`                  | Decrescente             |
| `xpReachedAt`         | Crescente               |
| `userId`              | Crescente               |

Nesse formulário, **Matrizes** corresponde ao modo `array-contains` utilizado
para selecionar somente perfis cujo `accessRoles` contém `participant`.
`eventId` limita a consulta ao evento atual e `onboardingCompleted` exclui
perfis incompletos. Os três últimos campos reproduzem a ordem e o desempate do
ranking.

A paginação para as posições anteriores usa `limitToLast` e exige também
um segundo índice composto. Mantenha `accessRoles`, `eventId` e
`onboardingCompleted` como acima; no segundo índice, configure `xp` como
**Crescente**, `xpReachedAt` como **Decrescente** e `userId` como
**Decrescente**. Ambos têm escopo **Coleção**. No ambiente de testes,
crie os dois índices para `test_profiles`; em produção, para `profiles`.
A definição versionada inclui as duas direções em ambas as coleções.

O índice pode ser criado no plano Spark. A definição versionada fica em
`firestore.indexes.json`; antes de implantações pela CLI, ela deve ser comparada
com os demais índices remotos para evitar remoções não intencionais.

### Tickets, brindes e sorteios

Concluir o onboarding concede um ticket inicial. A concessão também é
retroativa para participantes existentes. Depois disso, cada 200 XP ainda não
convertidos pode gerar um ticket. A conversão manual permanece disponível
enquanto `eventOperations.ticketConversionEnabled` estiver ativo.

O perfil mantém `ticketBalance`, `convertedXp` e
`onboardingTicketGranted` como projeções controladas pelo servidor. O último
campo começa em `false` e muda para `true` na mesma transação que concede o
ticket inicial. O contrato não aceita `null`, pois a produção começa sem
perfis legados. Converter XP incrementa `convertedXp` sem reduzir `xp`; assim,
nível e ranking continuam representando a participação. Se uma conexão
removida fizer o XP ficar abaixo do total já convertido, novas conversões
permanecem indisponíveis até que o participante recupere a diferença.

`ticketTransactions` é o histórico auditável. Concessões, conversões, resgates
e ajustes nunca são representados somente por uma alteração de saldo. O ticket
inicial usa ID determinístico; conversões usam uma chave de idempotência
validada pelo servidor.

Brindes possuem custo e estoque. Reviewer e admin podem escanear o QR pessoal
do participante para converter XP ou resgatar brindes. Somente admin pode
bloquear conversões e resgates, liberar avaliações, fechar o evento e realizar
sorteios.

Cada documento de `rewards` possui nome, descrição, imagem, custo em tickets,
estoque, limite opcional por participante, estado e ordem. O agregado
determinístico em `rewardRedemptions` registra quantidade e custo total daquele
brinde para o participante. Cada entrega também cria uma movimentação negativa
em `ticketTransactions`.

Saldo, estoque, limite, agregado e movimentação são validados e atualizados na
mesma transação. Uma chave de idempotência impede que a repetição da confirmação
consuma tickets ou estoque novamente.

O fechamento é uma operação administrativa irreversível pela interface. Ao
iniciá-lo, o servidor bloqueia conversões e resgates e define
`raffleClosureStatus` como `processing`. Os participantes são processados em
lotes retomáveis de até 100 documentos, evitando depender de uma única
requisição longa para um evento com milhares de pessoas. O cursor e as
gravações do lote avançam juntos; se a requisição falhar antes do commit, o
mesmo lote pode ser tentado novamente sem duplicar tickets.

O limite de 100 também é o tamanho máximo de um `raffleEntryChunk`. No pior
caso, cada participante gera uma atualização de perfil, a concessão inicial e
uma conversão final; somadas ao chunk e ao cursor, as gravações permanecem
abaixo do limite de 500 operações por batch do Firestore. Aumentar o lote não
reduziria leituras e diminuiria essa margem de segurança.

Novos fechamentos reutilizam o índice composto do ranking para filtrar no
Firestore somente perfis com onboarding concluído e `participant`. A paginação
segue `xp` decrescente, `xpReachedAt` crescente e `userId` crescente. Essa
ordem não influencia as chances: ela serve apenas para produzir uma fotografia
retomável, e o sorteio ponderado continua usando uma posição aleatória sobre os
tickets congelados. Fechamentos iniciados com o cursor antigo por ID continuam
nesse formato até terminar, evitando reinício ou duplicação durante uma
atualização da aplicação.

Chunks usam IDs determinísticos baseados no último perfil do lote. Se dois
processadores tentarem confirmar o mesmo cursor, apenas um batch consegue criar
o chunk; o outro falha por duplicidade sem aplicar gravações parciais.

Um perfil indexado que não satisfaça o contrato é excluído da fotografia sem
interromper os demais participantes. O fechamento cria no mesmo batch um
registro determinístico em `raffleSkippedProfiles`, incrementa
`raffleSkippedParticipants` e avança o cursor. A Central de Operações mostra o
total ignorado para conferência. A simulação usa a subcoleção
`skippedProfiles` da própria execução, sem misturar ensaios com a auditoria do
fechamento real.

A consulta seleciona somente identidade, nome, filtros de participação, XP,
cursor e saldos necessários ao fechamento. E-mail, avatar, biografia, empresa,
skills, QR Code e demais campos públicos não são transferidos. A projeção não
reduz o número faturado de documentos lidos, mas diminui tráfego, memória e
exposição de dados que não participam do sorteio.

Cada participante concluído recebe retroativamente o ticket de onboarding caso
a movimentação determinística ainda não exista. Todo XP restante conversível é
transformado em tickets, e `raffleEntryChunks` congela nome, saldo final e peso
do participante no instante do fechamento. Cada lote gera um documento com até
100 entradas. Pesos zero permanecem auditáveis, mas não participam do universo
elegível.

Somente quando todos os lotes terminam o estado muda para `closed`. Cada
documento ativo em `raffles` representa um prêmio. O sorteio gera
criptograficamente uma posição inteira entre zero e o total de tickets
elegíveis menos um e percorre os intervalos cumulativos das entradas; portanto,
cada ticket representa exatamente uma chance.

A primeira seleção deixa o prêmio em `awaiting_confirmation` e cria uma
`raffleAttempt` pendente com candidato, peso, universo, posição aleatória,
operador e horário. Se a pessoa estiver ausente, a tentativa recebe `absent` e
ela é retirada apenas das novas tentativas daquele prêmio; permanece elegível
para outros prêmios. A próxima seleção acontece sobre os participantes ainda
disponíveis.

Somente a confirmação de presença transforma a tentativa em `confirmed`, o
prêmio em `drawn` e o candidato em vencedor. A exclusão é criada em
`raffleWinners` na mesma transação e vale para todos os sorteios seguintes. Os formulários
carregam o ID da tentativa exibida, impedindo que uma ação repetida ou uma tela
desatualizada resolva acidentalmente uma tentativa posterior.

`config/raffles.ts` centraliza `CONSUME_RAFFLE_WINNER_TICKETS`. Quando a chave
está ativa, o sorteio também zera atomicamente o saldo atual do vencedor e cria
uma movimentação de ajuste negativa em `ticketTransactions`; a fotografia do
sorteio não é alterada. Quando está desativada, o vencedor mantém o saldo.
Depois que todos os sorteios ativos terminam, o administrador pode reabrir
somente os resgates de brindes. Conversões continuam encerradas e os resultados
permanecem congelados.

### Simulação dos sorteios

`raffleTestRuns` permite ensaiar o fluxo sem alterar o evento. Ativar o modo de
teste cria uma execução identificada por UUID e registra sua referência em
`eventOperations.raffleSimulationRunId`. A preparação lê os dados reais, mas
grava a fotografia calculada nas subcoleções `entryChunks`, `raffles`,
`winners` e `attempts`
da execução. Para suportar milhares de participantes, essa preparação também é
retomável em lotes de até 100 perfis.

Os novos lotes usam a mesma consulta indexada do fechamento real, com cursor e
`limit`; portanto, descartam perfis administrativos no Firestore e não releem
toda a coleção a cada avanço. Para 2.000 participantes elegíveis, a preparação
ainda consome aproximadamente 2.000 leituras de perfis, pois cada saldo precisa
entrar na fotografia. Como `onboardingTicketGranted` é sempre booleano, a
preparação calcula a concessão inicial diretamente do perfil e não consulta
`ticketTransactions` para reconstruir estado legado.

A fotografia dos participantes é imutável depois da preparação e permanece em
cache compartilhado por até 24 horas. A conclusão do fechamento ou da
preparação de uma simulação invalida o cache antes do primeiro sorteio. Assim,
os cerca de 20 blocos de uma fotografia com 2.000 participantes são lidos na
primeira seleção e reutilizados nas seguintes.

Vencedores e tentativas permanecem fora do cache porque mudam durante
confirmações e re-rolagens. Cada seleção combina a fotografia em cache com
esses registros atuais. Na simulação, a consulta de tentativas filtra
`raffleId` no Firestore, em vez de carregar tentativas de todos os prêmios. Os
cálculos ponderados acontecem em memória e não geram gravações adicionais.

Enquanto a referência estiver ativa, as ações administrativas de sorteio,
re-rolagem, confirmação, consumo de saldo e liberação de resgates são
direcionadas exclusivamente à simulação. O scanner de atendimento, os controles
reais e as respectivas operações diretas ficam indisponíveis para evitar
gravações acidentais. Perfis, movimentações, prêmios, estoques, sorteios e
operações reais permanecem inalterados.

Encerrar o modo marca a execução como `archived` e remove somente a referência
ativa. As subcoleções são preservadas para auditoria e uma nova simulação parte
de uma fotografia atualizada.

Simulações arquivadas permanecem armazenadas até o encerramento operacional do
evento. Elas não entram nas consultas normais: a aplicação resolve somente o
UUID ativo em `eventOperations`, portanto o histórico não aumenta o custo de
leitura dos sorteios seguintes.

A limpeza acontece somente depois do evento e deve usar exclusão recursiva do
documento de `raffleTestRuns`, incluindo `entryChunks`, `raffles`, `winners`,
`attempts` e `skippedProfiles`. Excluir apenas o documento pai ou configurar
TTL nele deixaria subcoleções órfãs. A limpeza deve registrar evento, execução,
data e responsável e não faz parte de uma ação automática do MVP.

## Relacionamentos e IDs

- documentos relacionados ao evento carregam `eventId`;
- `eventId` vem da variável privada `EVENT_ID` configurada por implantação;
- referências usam IDs simples quando não houver benefício claro em `DocumentReference`;
- IDs internos do Firestore não são colocados em QR Codes;
- entidades escaneáveis possuem `qrId` público, aleatório e único no evento;
- conexões, scans e conclusões devem possuir chave ou regra que impeça duplicidade lógica;
- `xpReachedAt` registra quando o participante atingiu a pontuação atual e resolve empates no ranking.

## Datas e exclusão

- use `Timestamp` do Firestore e horário gerado no servidor;
- mantenha `createdAt` e `updatedAt` quando relevantes;
- prefira desativação ou arquivamento para conteúdo com histórico;
- exclusão definitiva exige verificar relações e requisitos de privacidade.

## Consultas e índices

Modele consultas antes de criar índices. Casos previstos incluem:

- dados por `eventId` e estado;
- empresas e missões ordenadas;
- submissões pendentes por evento e revisor;
- scans e conexões por perfil;
- ranking por evento, papel de participante, XP e `xpReachedAt`;
- avaliações por palestra e perfil;
- busca de entidades por `eventId`, tipo e `qrId`.

Use paginação em listas potencialmente grandes e selecione somente os dados necessários.

## Integridade e segurança

- pontuação, scans, conexões e tickets são escritos pelo servidor;
- criar uma conexão concede XP uma única vez; removê-la revoga a XP na mesma operação, sem apagar o histórico;
- o onboarding e as movimentações de tickets usam chaves idempotentes e histórico auditável;
- avaliações são liberadas manualmente por administradores, concluem sua missão e são únicas por participante e palestra;
- operações concorrentes usam transações ou atualizações atômicas;
- regras de segurança seguem menor privilégio;
- dados públicos e privados do perfil devem ser separados na leitura ou projeção;
- nenhuma entrada do cliente é persistida sem validação e autorização.

## Próximo documento

➡️ [Autenticação](./02-authentication.md)

## Avisos

As coleções `notices`, `noticeReaders` e `pushSubscriptions` são compartilhadas
com o painel externo. Consulte [Avisos e Web Push](./08-notices.md) para contratos,
isolamento por evento, leitura individual e configuração.

Avisos excluídos administrativamente recebem `deletedAt` e `deletedBy`. Esses
documentos permanecem para auditoria, mas não aparecem na listagem, nos detalhes
ou no contador de não lidos. Leituras antigas são preservadas e desconsideradas
para avisos removidos.

A programação informativa `/schedule` também consulta
`schedule_publications/{eventId}`, mantido pelo painel externo. Somente quando
`published` é `true` ela carrega as atividades ativas. A ausência do documento
significa programação ainda não publicada. Essa leitura ocorre exclusivamente
no servidor, com o evento obtido do perfil autenticado, e não consulta avaliações.
