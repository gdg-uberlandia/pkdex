# Validação de missões por empresas

Cada perfil possui exatamente um papel em `accessRoles`. O papel `sponsor`
permite somente confirmar missões presenciais da empresa vinculada à conta.
Não concede participação, XP próprio, ranking, tickets, resgates, sorteios ou
acesso ao painel administrativo.

## Dados

- `profiles.sponsorCompanyId`: ID da empresa representada pelo funcionário;
  ausente em registros antigos equivale a `null`.
- `missions.companyId`: empresa responsável pela missão; ausente equivale a
  `null`, representando uma missão da organização. Não substitui pré-requisitos.
- `activityCompletions.validatedBy` e `validatedAt`: identificam o funcionário
  e o instante da primeira confirmação. Releituras preservam o registro.

O painel exige empresa ativa do mesmo evento ao atribuir `sponsor`. Outros
papéis devem ficar com vínculo nulo. A edição pública de perfil não aceita
nenhum dos campos de autorização. Funcionários usam contas individuais e
vários perfis podem representar a mesma empresa.

## Autorização

`review-company-missions` é uma permissão separada de `review-missions`,
reservada à validação global de revisores e administradores. A lista de missões
filtra pelo vínculo e consulta os dados atuais, sem usar o cache compartilhado
do catálogo. O contexto de validação reúne empresa e missões em uma única
operação de serviço. A transação de conclusão relê missão, perfil do operador
e empresa antes de qualquer escrita e recusa papel revogado, vínculo alterado,
empresa inativa/inexistente, evento diferente ou missão de outra empresa.
Pré-requisitos atuais, participante, idempotência e concessão de XP continuam
sendo validados. A identidade do operador vem da sessão, nunca do formulário.

A empresa é responsável por conferir a execução da atividade presencial.
Não há controles adicionais de fiscalização dessa confirmação.

## Navegação

Sponsors entram diretamente em `/missions`, sem onboarding de participante.
O menu contém validação e `/sponsor/account`, que apresenta a identidade, a
empresa, o seletor de tema e a opção de sair. O scanner existente em `/missions/review/{missionId}`
é reaproveitado. Uma empresa indisponível deixa a lista vazia e mostra orientação
para procurar a organização.

O proxy sobrescreve `x-pokedex-pathname` para que `requireAuth` redirecione
acessos a outras páginas para `/missions`. A proteção antecipada de sessão em
home, perfil e onboarding permanece. A autorização das operações é independente
dessa restrição de navegação. Sponsors não podem emitir QR pessoal nem editar
ou concluir o perfil de participante.

## Publicação e configuração

1. Publicar a Pokédex com suporte ao papel e aos campos novos.
2. Publicar o painel com cadastro dos vínculos.
3. Editar as missões presenciais e selecionar a empresa responsável.
4. Após o primeiro login de cada funcionário, selecionar seu perfil no painel,
   atribuir `sponsor` e escolher a empresa.

Não é necessária migração das missões existentes. Elas ficam sem empresa e
continuam disponíveis à validação global. A role nova só deve ser atribuída
após a atualização da Pokédex. As Firestore Rules continuam bloqueando leituras
e escritas diretas das coleções protegidas; os vínculos são geridos pelo backend.

## Verificação manual

Com dois funcionários da empresa A e um da B, conferir listas e validações,
abrir diretamente a URL de uma missão de outra empresa e tentar validar após
alterar o vínculo, remover o papel ou desativar a empresa. Conferir também que
releituras preservam operador, horário e XP e que a conta pode sair da aplicação.

O bloqueio global de missões também impede confirmações por sponsors, inclusive
com a câmera já aberta. Consulte
[Bloqueio global de tags e missões](./11-activity-availability.md).

## Links adicionais

Todos os tipos de missão aceitam `externalLinks`, uma lista opcional de até três
objetos `{ label, url }`. O texto do botão aceita até 60 caracteres e a URL deve
usar HTTP ou HTTPS. No painel, os links podem ser adicionados, editados e removidos
independentemente do tipo de validação. A Pokédex os exibe nos detalhes em uma
linha com três colunas, inclusive em telas pequenas, abrindo cada URL em nova aba.
Os links não alteram as regras de conclusão da missão.

Missões antigas com `externalUrl` continuam exibindo o botão “Acessar atividade”.
Ao editar pelo formulário, esse link é carregado na lista e salvo no novo formato.
Uma lista `externalLinks: []` indica remoção explícita e tem precedência sobre o
campo antigo. Não é necessária migração de dados.

O catálogo de missões é consultado novamente em cada requisição da Pokédex,
com deduplicação durante a renderização. Ele não usa cache persistente de 15
minutos, pois as edições são feitas por outro aplicativo. Após editar links no
painel, recarregue a página de missões para receber os dados atualizados.
