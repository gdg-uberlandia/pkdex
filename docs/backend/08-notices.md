# Avisos e notificações Web Push

O painel externo publica em `/admin/notices`. A Pokedex lista em `/notices` e
abre cada mensagem em `/notices/{uuid}`. O sino na home e nos cabeçalhos mostra
não lidos, atualizados na navegação, ao retornar à janela e a cada minuto com a
página visível. O histórico independe da permissão de notificações.

Na lista, “Marcar todas como lidas” aparece quando existem avisos não lidos.
A ação marca os avisos disponíveis no momento para o perfil autenticado,
atualiza a lista e o contador do sino e mantém o histórico para consulta.
Novos avisos publicados depois continuam não lidos. A operação usa transações
em grupos de até 400 leituras, preservando o primeiro `readAt` e permitindo
repetir após uma falha sem duplicar registros. Identidade e evento vêm da
sessão, e o estado de leitura dos demais usuários não é alterado.

## Dados compartilhados

Todas as coleções recebem `test_` com `DEVMODE=true` na Pokedex e `DEV_MODE=true`
no site. Os projetos precisam apontar para o mesmo Firebase e evento.

- `notices/{uuid}`: `eventId`, `title` (3–100), `body` (1–3.000), `link`
  (caminho interno opcional), `sendPush`, `createdAt` (Timestamp), `createdBy`
  (UID administrativo), `pushStatus` (`disabled`, `sending`, `completed`,
  `partial`), `sent`, `failed`, `skipped` e `pushFinishedAt` quando concluído.
- `noticeReaders/{sha256(eventId:userId)}/reads/{noticeId}`: `eventId`, `userId`,
  `readAt`. A abertura grava o primeiro acesso em transação, sem alterar o
  timestamp nas aberturas seguintes. GET e prefetch não marcam leitura.
- `pushSubscriptions/{sha256(eventId:endpoint)}`: `eventId`, `userId`, `endpoint`,
  `keys.p256dh`, `keys.auth`, `updatedAt`. Há uma inscrição por navegador e
  evento; vários dispositivos podem pertencer ao mesmo perfil. Reativar ou
  visitar o perfil ou os avisos sincroniza uma inscrição existente com a sessão atual.

Não há acesso direto pelo Firebase Client SDK. As regras atuais do projeto de
infraestrutura (`site-devfest/firestore.rules`) já negam acesso a essas coleções.
Endpoints de leitura exigem sessão; identidade e evento são derivados do perfil.
A exclusão de inscrição verifica seu proprietário. Inscrições aceitam somente
HTTPS e provedores conhecidos para impedir requisições a destinos arbitrários.
Avisos ficam disponíveis para todos os perfis autenticados do evento. O push
coletivo considera somente perfis com `participant` no momento do envio.

## Publicação

A API administrativa `GET/POST /api/v1/notices` exige `requireAdmin` no site.
O POST valida novamente os campos, cria o aviso em transação e só então envia
push com `web-push`. O UUID da publicação funciona como chave de idempotência:
repetir a mesma publicação não inicia outro disparo. Não há edição, agendamento ou reenvio automático nesta versão; a exclusão administrativa é descrita abaixo.

O envio é aguardado na requisição, em grupos de até 25, com timeout de socket de
5 segundos por envio. Novos grupos deixam de começar após 40 segundos de envio;
o restante é registrado em `skipped`. Falhas individuais não interrompem os
outros dispositivos. Respostas 404/410 removem inscrições expiradas desde que
não tenham sido atualizadas durante o envio. O push expira no provedor após uma
hora e inclui apenas título, resumo e ID do aviso. O clique abre o aviso salvo.

Não há fila, FCM ou novas tentativas automáticas. O servidor deve permitir
requisições de pelo menos 60 segundos. Se a plataforma encerrar o processo,
o aviso continua publicado, e `sending` pode permanecer com contagens parciais.
Uma resposta perdida pode ser consultada no histórico do painel antes de uma
nova publicação. Envio aceito pelo provedor não comprova entrega nem leitura.

## Configuração

1. No site, gere um par usando `npx web-push generate-vapid-keys`.
2. Configure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` (por
   exemplo, `mailto:contato@devfesttriangulo.com.br`) no servidor do site.
3. Configure a mesma `VAPID_PUBLIC_KEY` no servidor da Pokedex. A chave privada
   não pertence à Pokedex nem ao cliente.
4. Reinicie os serviços. Na Pokedex, abra Perfil → Notificações e clique em Ativar notificações.

Sem chaves VAPID, o histórico funciona e o painel permite publicar sem push
quando `PUSH_ENABLED=true`. Com `PUSH_ENABLED=false`, a seção do painel fica
indisponível. O GET autenticado `/api/notices/subscription` fornece
somente a chave pública. POST/DELETE nessa rota exigem sessão e origem igual à
da aplicação. `/api/notices/unread` consulta somente IDs e marcadores de exclusão, sem baixar o corpo
dos avisos. Mutações não aceitam identidade ou evento enviados pelo navegador.

O Service Worker `/sw.js` trata apenas push e clique; não armazena páginas ou
respostas autenticadas em cache. A permissão só é solicitada após clique. O
suporte depende do navegador e de contexto seguro (HTTPS ou localhost).

## Verificação manual

- Use o mesmo ambiente de teste nos dois projetos.
- Publique sem push; confirme lista, detalhe, indicador Novo e leitura persistente.
- Confirme que um segundo perfil mantém seu próprio estado de leitura.
- Ative push no dispositivo, publique com push e aguarde o resultado no painel.
- Dispense a notificação e encontre a mesma mensagem em Avisos.
- Clique em outro push: deve abrir seu detalhe e permitir acessar o link interno.
- Desative no dispositivo; confirme que a inscrição foi removida no servidor.
- Teste permissão negada e ausência de VAPID; o histórico deve continuar acessível.

Não publicar mensagens de teste no ambiente de produção. Os dados e inscrições
seguem o prazo de retenção de dois anos do evento, incluindo as subcoleções de
leitura na rotina de exclusão.

## Controle global do push

Configure `PUSH_ENABLED=true` nos dois projetos para habilitar push. Use
`PUSH_ENABLED=false` para desabilitar, preservando as chaves e inscrições. A
ausência da variável também desabilita; somente `true` (ignorando maiúsculas e
espaços) habilita. Reinicie os serviços ou faça novo deploy após alterar.

No site, a variável oculta Avisos do menu e da busca e bloqueia a tela e a API
com resposta 404, inclusive para publicação sem push. Na Pokedex, ela oculta a ativação e bloqueia novas inscrições,
inclusive chamadas diretas à API. A remoção de inscrições permanece permitida.
Na Pokedex, histórico, leitura e contador continuam funcionando. Ao
reativar, inscrições existentes podem voltar a receber push. Notificações já
aceitas pelo provedor antes da desativação ainda podem ser entregues.

## Convite após onboarding e preferências

Depois de concluir o perfil, a Server Action redireciona para
`/notifications/enable` quando push está habilitado e há chave pública. A tela
ocupa toda a área da aplicação, sem cabeçalho ou navegação inferior, e oferece
Permitir notificações e Agora não. O navegador só recebe a solicitação de
permissão após o clique. Ao ativar com sucesso ou pular, a navegação usa replace
para `/home`. Dispositivos já inscritos ou sem suporte seguem para a home;
permissão bloqueada é explicada sem tentar solicitar novamente automaticamente.
O convite não é exibido nos próximos logins.

O controle por dispositivo fica em `/profile#notifications`, onde é possível
ativar e desativar push. A lista de Avisos não possui mais controles de
permissão: mostra apenas o botão Configurar notificações no perfil quando a
verificação identifica push não ativo e existe chave pública disponível. O
botão fica oculto durante a verificação, com push ativo e com push desativado
globalmente ou sem chave. O status é verificado novamente ao retornar à janela,
sem pedir permissão automaticamente.

A seção de notificações do perfil identifica sistema, navegador e execução como
app instalado no próprio dispositivo, sem persistir esses dados. As instruções
mudam entre Android, iPhone/iPad e computador, com orientações específicas para
Chrome, Safari e Firefox e alternativa para navegadores internos de outros apps.
A identificação é uma heurística para ajuda; a disponibilidade de push continua
baseada nos recursos reais do navegador. Apps instalados não repetem os passos
de instalação; permissões bloqueadas recebem orientação para as configurações.
Os passos incluem links para a documentação oficial de Apple, Google e Mozilla.

## Exclusão administrativa

O painel permite excluir após confirmação. `DELETE /api/v1/notices/{id}` recebe
somente o UUID na URL, sem corpo, exige administrador e `PUSH_ENABLED=true`, valida UUID e
confere o evento dentro da transação. O servidor grava `deletedAt` e `deletedBy`
no aviso; repetir a exclusão preserva a auditoria original. O registro é mantido
para auditoria e idempotência, sujeito ao mesmo prazo de retenção do evento.

Site e Pokedex ocultam documentos com `deletedAt` preenchido, incluindo avisos
legados que não possuem esse campo. A abertura de um aviso removido informa que
ele não está disponível e oferece retorno à lista. Novas leituras são bloqueadas.
O contador usa a interseção dos IDs visíveis com as leituras do participante,
para não descontar leituras de avisos já excluídos. Nenhum novo índice é exigido.

Push já aceito não pode ser recolhido, e envios em andamento podem terminar.
A exclusão não dispara push nem modifica as inscrições. As duas aplicações
precisam desta atualização para respeitar a remoção; telas já abertas devem ser
recarregadas para obter o novo estado.
