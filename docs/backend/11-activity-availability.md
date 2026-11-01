# Bloqueio global de tags e missões

O perfil de administradores apresenta controles independentes para tags e
missões, com o mesmo padrão de bloquear/liberar usado nos serviços de tickets.
Sponsors e revisores não podem alterar esses controles.

## Dados

O documento `eventOperations/{eventId}` recebe `tagsEnabled` e `missionsEnabled`.
Campos ou documento ausentes equivalem a `true`, preservando o comportamento das
edições existentes. As coleções usam o prefixo `test_` em DEVMODE.

As alterações usam transação, validam novamente o papel admin e o evento do
operador e registram `updatedBy` e `updatedAt`. O merge preserva os controles de
tickets, resgates, fechamento e simulação de sorteios.

## Efeito do bloqueio

O bloqueio pausa novas descobertas de tags ou novas conclusões de missões.
Não altera o campo `active` dos cadastros e não remove XP, conquistas ou
históricos. Ao liberar, cada entidade mantém sua configuração individual.

A transação de descoberta ou conclusão relê o controle global antes de escrever:

- tags bloqueadas retornam `TAGS_DISABLED` sem descoberta ou XP;
- missões bloqueadas retornam `MISSIONS_DISABLED` sem conclusão, XP ou consumo
  de tentativas;
- QR Code, revisão presencial por admin/reviewer/sponsor, palavra-chave e quiz
  respeitam o mesmo bloqueio;
- missões automáticas não são concluídas enquanto bloqueadas; ao liberar, as
  metas são verificadas normalmente;
- releituras de conclusões existentes preservam o resultado e a auditoria,
  sem nova pontuação.

A lista do participante mantém missões concluídas e marca as pendentes como
bloqueadas, com explicação. A área de revisão não oferece links de validação
quando as missões estão pausadas. A coleção de tags permanece consultável e
informa a pausa. Formulários e scanners já abertos também são bloqueados pelo
servidor. Esses controles não modificam visitas a empresas nem a liberação
individual de avaliações de palestras.

## Verificação

Testes cobrem autorização administrativa e evento, atualização independente dos
controles, preservação de outros campos, bloqueio dos formatos de missão,
tentativas, XP, retomada de missões automáticas e manutenção de conquistas.

No celular, conferir os controles no perfil admin e testar uma leitura com a
câmera aberta durante a mudança de estado por outro dispositivo.

## Encerramento do evento

O painel administrativo do site oferece “Encerrar evento”, com confirmação.
Ele grava `eventClosed: true`, `eventClosedAt` e `eventClosedBy` no mesmo documento,
por merge, preservando configurações anteriores. A operação é idempotente e não
oferece reabertura. Campo ausente significa evento aberto.

O encerramento prevalece sobre `tagsEnabled` e `missionsEnabled`; controles
individuais não podem liberar atividades depois dele. Missões (incluindo
conclusões automáticas), tags, avaliações e conexões consultam o documento dentro
da transação que concede a realização e o XP. Transações concorrentes ao
encerramento são revalidadas pelo Firestore. Realizações e avaliações existentes
continuam idempotentes; histórico, XP e tickets não são recalculados ou apagados.
Visitas a empresas, consultas, resgates e sorteios mantêm suas regras próprias.

A aplicação exibe um aviso global aos usuários. Publicar o site e a Pokédex com
este suporte antes de usar o controle em produção; a interface administrativa
sozinha não instala os bloqueios no servidor da Pokédex.
