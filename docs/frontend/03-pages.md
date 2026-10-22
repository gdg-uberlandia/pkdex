# Páginas

## Mapa de páginas

| Rota                          | Objetivo                | Conteúdo essencial                                  |
| ----------------------------- | ----------------------- | --------------------------------------------------- |
| `/login`                      | autenticar com Google   | apresentação, ação de login e erros                 |
| `/onboarding`                 | concluir perfil inicial | etapas, progresso e validação                       |
| `/home`                       | resumir o evento        | progresso, atalhos e atividades                     |
| `/companies`                  | listar patrocinadores   | categorias, busca e cards                           |
| `/companies/[companyId]`      | detalhar empresa        | descrição, links e status de visita                 |
| `/tags`                       | acompanhar descobertas  | progresso, slots bloqueados e tags reveladas        |
| `/missions`                   | missões ou revisão      | catálogo do participante ou seleção do reviewer     |
| `/missions/review/{id}`       | validar missão          | scanner restrito ao QR temporário do participante   |
| `/scan`                       | ler QR Code             | câmera, permissão, leitura e resultado              |
| `/passport`                   | exibir progresso        | resumo, conquistas e coleções da jornada            |
| `/ranking`                    | mostrar classificação   | posição atual, lista e nível                        |
| `/connections`                | gerenciar networking    | conexões criadas pelo scanner e remoção             |
| `/profile`                    | exibir o próprio perfil | dados públicos, progresso e ações                   |
| `/profile/edit`               | editar perfil           | formulário validado e feedback                      |
| `/profile/qr-code`            | compartilhar QR         | código, instrução e alternativa de compartilhamento |
| `/tickets`                    | gerenciar tickets       | saldo, XP conversível, conversão e histórico        |
| `/operations`                 | operar o evento         | atendimento, bloqueios, brindes e sorteios          |
| `/operations/talks`           | liberar avaliações      | palestras, estados e controles administrativos      |
| `/raffles/live`               | projetar os sorteios    | candidato, vencedor e andamento sem controles       |
| `/talks`                      | listar palestras        | conteúdo, palestrantes e status da avaliação        |
| `/talks/[talkId]`             | detalhar palestra       | descrição, horário e avaliação identificada         |
| `/schedule` (futura)          | mostrar o cronograma    | faixas, atividades, salas e sessões paralelas       |
| `/qr/[eventId]/[type]/[qrId]` | tratar deep link de QR  | validação e redirecionamento seguro                 |

O fluxo de perfil já permite consultar os dados persistidos em `/profile` e editar nome, biografia, atuação, empresa, link e de três a cinco habilidades em `/profile/edit`. Somente nome e skills são obrigatórios. Habilidades são pesquisadas por nome ou alias no catálogo estático e persistidas pelo slug. O formulário valida no cliente para feedback imediato e repete a validação na Server Action antes da persistência; erros esperados são apresentados junto ao campo correspondente.

`/profile/qr-code` emite e apresenta o QR temporário do participante, informa a validade restante e renova o token automaticamente. O deep link valida sessão, assinatura, evento, UUID, expiração, existência do perfil e tentativa de auto-scan, mas não executa mutação de networking.

`/` redireciona imediatamente para `/login`. A página de login mantém logo e ilustração montados nas mesmas posições enquanto consulta a sessão sem cache por no mínimo dois segundos. Durante a consulta, exibe “Preparando sua jornada...”. Sem sessão, substitui somente a área inferior pelos textos e ação de login com fade-in; com sessão, segue para `/home`, onde o layout autenticado encaminha perfis incompletos ao onboarding.

`/onboarding` apresenta cinco etapas com imagem WebP otimizada, título, descrição, indicador e ação de avanço. O passo atual permanece no parâmetro `step`, sobrevivendo a refresh. O gesto horizontal para a esquerda avança e para a direita retorna, sem botão visual de voltar; a próxima imagem é pré-carregada. Imagem e textos saem na direção do movimento e a etapa seguinte entra pelo lado oposto em uma transição curta. A última etapa encaminha para `/onboarding/profile`, que reutiliza o formulário de perfil. Voltar do setup retorna ao início das etapas; cancelar encerra a sessão; salvar um perfil válido conclui o onboarding e encaminha para `/home`.

`/home` usa dados reais do perfil para apresentar saudação, avatar, nível e
progresso até o nível máximo. A projeção individual leve fornece as contagens
do participante, enquanto os catálogos públicos em cache fornecem somente seus
totais; a página não repete consultas às conclusões individuais.

O Passaporte é o principal resumo visual e mostra o percentual real de
empresas, tags e missões concluídas. Em seguida, uma recomendação contextual
orienta a primeira conexão e depois prioriza a coleção de empresas ou tags
com maior proporção concluída. Após essas coleções, convida a consultar as
missões restantes sem afirmar que seus pré-requisitos estão liberados.
Recomendações genéricas não prometem XP de atividades específicas. O resumo rápido leva às quatro coleções e uma seção
separada promove palestras, ranking e tickets. Scanner, Missões, Passaporte e
Perfil continuam permanentemente disponíveis na navegação inferior. A página
possui skeleton estrutural e erro recuperável para suas leituras; o logout fica
em `/profile`.

O card de tickets calcula o progresso com `max(0, xp - convertedXp)` e a taxa
configurada em `config/tickets.ts`. Ele respeita o bloqueio de conversões da
organização e direciona para `/tickets`, onde a conversão continua explícita.
A Home consulta somente o estado operacional adicional, sem carregar o ledger
de tickets ou os históricos de conclusões. A ajuda rápida fica em `/profile`, após Aparência e antes de Sair, com seções
expansíveis nativas sobre XP, tickets, sorteios, avaliações e scanner.

O Perfil também oferece as preferências de aparência `Sistema`, `Claro` e
`Escuro`. A escolha é persistida somente no navegador e vale para as rotas que
seguem o tema global; experiências imersivas podem continuar escuras.

A Home também oferece acesso ao catálogo de empresas. `/companies` lista
somente empresas ativas do evento atual, ordenadas pelo nome, e mostra quantas
já foram visitadas. Cada card informa o estado do carimbo e abre
`/companies/[companyId]`. O detalhe apresenta logo, descrição, XP e instrução
para encontrar o QR Code; depois da visita, passa a exibir a imagem do carimbo,
o momento da conquista e a pontuação recebida. O catálogo possui estados de
carregamento, vazio e erro recuperável.

A Home oferece acesso a `/talks`, que lista palestras, painéis e keynotes
ativas, identifica abertura e encerramento com nomes específicos e apresenta
seus palestrantes, o estado da avaliação e a conclusão individual. O
detalhe em `/talks/[talkId]` apresenta conteúdo, participantes e o formulário
quando `evaluationStatus` está `open`. Os três critérios recebem notas
obrigatórias de 1 a 5; o comentário obrigatório possui de 20 a 500 caracteres.
Erros de validação aparecem junto ao respectivo campo. Avaliações bloqueadas ou
encerradas explicam seu estado, enquanto uma conclusão anterior continua
visível mesmo após o encerramento.

Administradores acessam `/operations/talks` por um atalho na Central de
Operações e controlam individualmente `locked`, `open` e `closed`. Reviewers e
demais papéis não recebem esse controle. A Pokédex combina as palestras ativas
com as entradas ativas de `schedule` do evento: os cards e detalhes exibem o
intervalo e a trilha reais, e a listagem segue `startAt` e `order`. Abertura e
encerramento aparecem como atividades gerais quando associados a uma palestra;
intervalos não fazem parte do catálogo de palestras. Uma palestra sem entrada
ativa no cronograma não é exibida ao participante. A alteração de estado
invalida o cache de palestras imediatamente para que o participante consulte o
novo estado sem aguardar o prazo normal do catálogo.

`/scan` inicia a câmera automaticamente, aceita tanto a webcam quanto as câmeras
do smartphone e prioriza a câmera traseira quando ela estiver disponível. O
stream é encerrado ao sair da página, ocultar a aplicação ou obter a primeira
leitura, antes da validação e da navegação. O valor lido passa pelo contrato
central de QR Code. Códigos externos, inválidos, de outro evento ou sem suporte
recebem mensagens específicas; falta de permissão, câmera ocupada, contexto sem
HTTPS e ausência de conexão também possuem estados recuperáveis. Participantes
criam conexões; empresas, tags e missões com validação por QR abrem seus respectivos
deep links. No modo de revisão, a câmera aceita somente o QR temporário de um
participante.

Ao reconhecer um QR Code válido de participante, o scanner chama a Server
Action que repete a validação de evento, assinatura e expiração e cria a
conexão automaticamente. Os dois participantes recebem 5 XP. Abrir diretamente
o deep link apenas apresenta sua validade e não executa a mutação.

`/qr/[eventId]/company/[qrId]` aceita tanto navegação pelo scanner interno
quanto abertura pela câmera do smartphone. Sem sessão, preserva o caminho no
login. Depois da autenticação, apresenta “Validando sua visita” enquanto uma
Server Action registra a primeira conclusão. O sucesso informa XP e carimbo;
releituras informam que a empresa já pertence ao passaporte sem pontuar
novamente. Empresa inexistente, inativa, evento inválido, perfil incompleto e
falha inesperada possuem resultados específicos. Visitas e carimbos não podem
ser removidos pelo participante.

`/tags` apresenta o total encontrado e uma grade da coleção. Tags bloqueadas
usam slots anônimos e não expõem nome, imagem, descrição ou localização. Depois
do scan, o slot revela esses dados e o XP concedido. O deep link
`/qr/[eventId]/tag/[qrId]` funciona pelo scanner interno ou pela câmera externa,
preserva o destino no login e trata descoberta nova, releitura, tag inativa,
tag inexistente, outro evento, perfil incompleto e erro inesperado. Descobertas
não podem ser removidas.

`/connections` apresenta as conexões ativas e o e-mail do outro participante.
Qualquer uma das partes pode remover uma conexão após confirmação; os dois
participantes perdem a XP concedida por ela, e o documento permanece armazenado
para preservar o histórico e permitir uma futura reconexão. A página possui
skeleton estrutural durante a consulta e erro recuperável para falhas de
carregamento.

`/missions` projeta a experiência conforme as permissões do perfil.
Participantes veem disponibilidade, pré-requisitos, conclusão e XP.
Reviewers/admins escolhem uma missão presencial e escaneiam o QR temporário do
participante. A primeira missão disponível recebe destaque; na ausência dela, o
destaque explica qual missão está mais próxima de ser desbloqueada. A lista
compacta mantém disponíveis e bloqueadas na ordem configurada e leva as
concluídas ao final.

Tocar no destaque ou em qualquer linha abre um dialog com descrição, XP, modo
de validação e todos os pré-requisitos. Missões presenciais disponíveis
oferecem nele um atalho para o QR do participante, preservando `/missions` como
destino de retorno. A interface não apresenta cronômetro nem progresso parcial,
pois o contrato atual registra somente conclusão binária.

`/passport` agrega empresas visitadas, Tags descobertas e missões concluídas.
O cabeçalho apresenta progresso geral e XP registrado nessas atividades; o
resumo separa os totais por categoria e as últimas conquistas são ordenadas
pela data real de conclusão. As abas exibem carimbos de empresas, slots de Tags
e o estado das missões sem revelar Tags bloqueadas. Empresas visitadas recebem
borda, brilho e um selo visual com ícone de carimbo; as pendentes permanecem em
escala de cinza e com menor contraste. A página é somente leitura e fica
disponível exclusivamente para contas com papel `participant`. Os cards do
resumo ativam a aba relacionada e navegam até a seção de coleções; a seleção
permanece no parâmetro `collection` após refresh. A rolagem usa transição suave
quando o dispositivo não solicita redução de movimento.

`/ranking` apresenta o nível, XP, progresso total até os 4.000 XP do nível
máximo e posição do participante. O indicador funciona como um termômetro da
jornada completa, acompanhado pelos valores atual e máximo. Quem
está no Top 3 vê as dez primeiras posições; os demais veem o Top 3 e uma
janela contextual com até três posições acima e três abaixo da própria
colocação. Ouro, prata e bronze
diferenciam o pódio, enquanto a linha do participante usa marcador, borda e
fundo próprios. A projeção pública contém apenas nome, avatar, XP, nível e
posição. Contas sem papel `participant` recebem um estado informativo. A
classificação usa posição agregada e cursores indexados para carregar somente o
Top 3 ou Top 10 e a janela contextual necessária.

`/tickets` concede retroativamente o ticket inicial do onboarding e apresenta
saldo, XP conversível, quantidade de tickets possíveis e histórico auditável.
O participante escolhe quantos tickets deseja gerar; cada unidade consome 200
XP do saldo conversível sem alterar XP, nível ou ranking. A interface informa
quando a organização bloqueia temporariamente novas conversões.

`/operations` substitui o acesso ao Passaporte para contas `reviewer` e
`admin`. Ambos podem abrir um scanner dedicado ao QR pessoal, consultar saldo e
XP conversível, realizar a conversão assistida e resgatar brindes. A tela de
atendimento mostra custo, estoque, limite e disponibilidade de cada item, e
exige confirmação antes da entrega. Somente `admin` pode bloquear ou liberar
conversões e resgates. O QR temporário é validado novamente no servidor antes
da operação; códigos expirados exigem uma nova leitura.

O administrador também inicia o fechamento definitivo do evento pela mesma
tela. A confirmação explica que conversões e resgates serão bloqueados. Durante
o processamento, o cliente envia sequencialmente lotes de até 100 participantes
e apresenta a quantidade já congelada. Não existe polling: uma nova requisição
só começa quando a anterior termina. Falhas interrompem a sequência e oferecem
uma ação de retomada a partir do último cursor confirmado.
Quando o fechamento termina, a lista de prêmios é liberada. Cada sorteio exige
nova confirmação e apresenta primeiro um candidato. O administrador confirma
que a pessoa está presente ou informa a ausência para sortear novamente. Uma
pessoa ausente é ignorada somente nas próximas tentativas daquele prêmio. Ao
confirmar a presença, a interface exibe o vencedor registrado e o remove dos
próximos sorteios. Reviewers não visualizam nem executam essas ações.

Depois do último sorteio ativo, a tela permite liberar novamente o resgate dos
tickets restantes e encerrá-lo mais tarde. Essa reabertura não libera novas
conversões nem recalcula chances. Conforme a configuração do evento, o vencedor
pode ter todo o seu saldo consumido no momento em que recebe o prêmio.

Antes do fechamento real, o administrador pode iniciar um modo de teste. Um
banner persistente diferencia a simulação da operação definitiva; o scanner,
os bloqueios reais e o fechamento real ficam indisponíveis. A preparação
isolada avança em lotes e, quando concluída, permite testar seleção ponderada,
ausência, re-rolagem, confirmação, consumo configurável dos tickets e liberação
de resgates. Encerrar a simulação restaura imediatamente a visualização real
sem aplicar seus resultados.

`/raffles/live` é uma apresentação widescreen autenticada e exclusiva para
administradores. Ela não usa o shell móvel nem expõe controles, saldo,
operações ou dados privados. A tela destaca o prêmio atual, o candidato
aguardando presença, o vencedor confirmado, os próximos prêmios e o modo de
simulação quando ativo.

Ao iniciar uma seleção ou re-rolagem, a Central publica o estado transitório
`raffle-drawing`. O telão substitui o conteúdo central por uma animação de
carregamento até a ação terminar. Em caso de sucesso, atualiza os dados antes
de revelar o candidato; em caso de erro, remove o carregamento sem apresentar
um resultado inexistente.

Quando a Central de operações e o telão estão em abas ou janelas do mesmo
navegador, um `BroadcastChannel` solicita uma nova renderização somente após
uma ação administrativa concluída. Não existe polling periódico. Em
navegadores ou dispositivos diferentes, a atualização automática local não é
compartilhada e a página deve ser recarregada manualmente.

## Composição

Páginas são Server Components por padrão e coordenam carregamento, metadata e composição. Interações como formulários, câmera e filtros locais devem ser isoladas em Client Components.

O layout autenticado é responsável pelo único `AppShell` das rotas funcionais. Ele escolhe tema, retorno seguro e presença de header e navegação inferior com base na rota. As páginas renderizam somente seu conteúdo e não criam shells ou elementos `main` adicionais.

Cada página deve tratar:

- carregamento e erro;
- ausência de dados;
- sessão e autorização;
- navegação de retorno quando aplicável;
- responsividade e acessibilidade;
- dados inválidos em rotas dinâmicas.

## Regras de experiência

- a ação principal deve estar clara e acessível com uma mão;
- preserve contexto ao retornar de detalhes;
- não revele IDs internos ou dados privados;
- confirme ações irreversíveis;
- ao remover uma conexão, informe que a XP recebida será revogada;
- permita avaliar palestra somente enquanto a liberação administrativa estiver aberta;
- após mutações, atualize a interface e revalide os dados relacionados.

## Próximo documento

➡️ [Navegação](./04-navigation.md)

## Feedback de leitura

O scanner mantém o resultado de networking na própria tela, distingue uma
nova conexão de uma conexão já existente e oferece “Ler outro QR” e
“Ver conexões”. Leituras repetidas não exibem uma nova recompensa.
Falhas de transporte e operações de networking ou revisão sem resposta por
15 segundos liberam uma tentativa explícita. O timeout não cancela a operação
no servidor; uma nova leitura continua sujeita à idempotência existente.
A câmera permanece parada durante a validação e enquanto um resultado ou erro
está aberto, inclusive ao alternar entre aplicativos. Somente uma nova tentativa
reativa a leitura nesses estados; callbacks de sessões antigas são ignorados.

Resultados de empresas, tags e missões oferecem retorno ao scanner e acesso
ao passaporte, à coleção ou às missões, respectivamente. Erros também permitem
ler o código novamente. O atendimento por QR de participante preserva sua rota
operacional e os controles de autorização existentes.

As revelações de tags, empresas e missões usam o `ActivityRevealCard`: imagem
em destaque sobre fundo escuro, painel inferior com título, status e descrição,
seguido por duas colunas de recompensa e confirmação. O visual acompanha os
modais das coleções, independentemente do tema do dispositivo. Leituras repetidas
mostram o XP já recebido, sem nova celebração. Os botões preservam `replace`.
Carregamento e erros continuam usando `QrResult`.

## Programação informativa

`/schedule` apresenta a programação publicada do evento do perfil autenticado,
incluindo abertura, keynotes, intervalos e encerramento. A página agrupa por
faixa de horário, ordena as sete trilhas na ordem oficial e usa suas cores em
cards empilhados no celular e duas colunas a partir de telas maiores. As
atividades gerais ocupam toda a largura. Títulos, descrições e palestrantes são
resolvidos no servidor; não há controles de avaliação nesta página.
`/talks` mantém a experiência de avaliações.
A rota inclui estados de carregamento, erro e programação ainda não publicada.

## Tema sazonal no produto

O tema Halloween está habilitado por `SEASONAL_THEME` em
`config/seasonal-theme.ts`. Ele aplica tokens na raiz da aplicação, respeitando
a preferência claro/escuro e o tema escuro forçado do scanner. Login, onboarding
e páginas autenticadas compartilham a paleta laranja/roxo nos componentes,
com os fundos claro e escuro originais, sem degradês laranja de fundo.
O passaporte da Home preserva seu layout original e o ícone de carimbo;
missões, notificações e navegação recebem ornamentos decorativos, sem alterar
ações, textos de estado ou recompensas.

A classe do tema, os estilos do shell e todos os ornamentos são condicionados à
mesma configuração. Ao defini-la como `null`, o produto usa novamente os tokens
de `app/globals.css` e a apresentação habitual. Os tokens, estilos e ornamentos
ficam concentrados em `modules/seasonal-theme`.

O passaporte da Home mantém sua composição original, sem mascote.
O card de próximo objetivo mantém a teia no
canto. Telas autenticadas recebem uma faixa decorativa com morcegos e teia;
essa faixa não aparece nos scanners, para preservar a área de câmera. Todos
os ornamentos ignoram eventos de ponteiro e somem ao desativar o tema sazonal.

## Recuperar notificações

A verificação inicial de notificações não registra nem aguarda o service worker
para usuários que ainda não deram permissão. O registro ocorre após o clique
em permitir. Falhas de configuração/rede oferecem “Tentar novamente” em vez
de deixar o botão de permissão desabilitado sem recuperação. As requisições
de push e a ativação do worker têm timeout de 15 segundos. Permissões negadas
continuam dependendo das configurações do navegador.

Os ornamentos sazonais incluem fantasmas, abóboras e esqueletos vetoriais, além
dos morcegos e teias. Aparecem na faixa superior e no rodapé das telas
autenticadas; a Home também tem um separador temático entre seções. Todos são
decorativos, estáticos, ocultos para leitores de tela e não interceptam cliques.
As áreas de scanner continuam sem esses elementos.

## Atendimento por funcionários de empresas

Sponsors usam `/missions` com lista restrita à empresa e
`/missions/review/{missionId}` para ler o QR temporário do participante.
`/sponsor/account` mostra identidade, empresa e saída. A navegação não apresenta
recursos de participante nem Central de Operações. Consulte
[Validação de missões por empresas](../backend/10-sponsor-missions.md).
