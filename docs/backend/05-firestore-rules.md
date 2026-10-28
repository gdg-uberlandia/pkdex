# Firestore Rules

As regras seguem menor privilégio. O Firebase Admin ignora Firestore Rules, portanto serviços de servidor também devem validar sessão, autorização e dados.

## Matriz de acesso do cliente

| Recurso                                                                     | Leitura                                         | Escrita                                   |
| --------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------- |
| `events`                                                                    | dados públicos do evento ativo                  | servidor                                  |
| `companies`, `tags`, `missions`, `speakers`, `talks`, `schedule`, `rewards` | usuários autorizados conforme produto           | servidor                                  |
| `tickets`                                                                   | próprios tickets                                | servidor                                  |
| `profiles`                                                                  | próprio perfil e projeção pública permitida     | próprio usuário, somente campos editáveis |
| `adminUsers`                                                                | servidor                                        | servidor                                  |
| `connections`                                                               | conexões do próprio participante                | servidor                                  |
| `activityCompletions`                                                       | próprias conclusões e carimbos                  | servidor                                  |
| `participantSummaries`                                                      | próprio resumo individual                       | servidor                                  |
| `rewardRedemptions`                                                         | próprios resgates                               | servidor                                  |
| `raffleSkippedProfiles`                                                     | administrador                                   | servidor                                  |
| `raffleLiveSignals`                                                         | leitura pública do sinal mínimo do telão        | servidor                                  |
| `scans`                                                                     | scans do próprio participante quando necessário | servidor                                  |
| `talk-ratings`                                                              | própria avaliação quando necessária             | servidor                                  |
| ranking                                                                     | projeção pública mínima de participantes        | servidor                                  |

## Perfil

O cliente nunca pode alterar campos controlados pelo servidor, incluindo:

```text
xp
xpReachedAt
convertedXp
ticketBalance
level
qrId
userId
eventId
createdAt
updatedAt
accessRoles
```

As Rules devem comparar campos alterados e validar tipos/limites básicos. Regras de domínio complexas permanecem no servidor.

## Operações críticas

Visitas, descobertas de tags, conclusões de missões, avaliações, scans, conexões, ranking e tickets são persistidos somente pelo backend. `accessRoles` não é gravável pela edição de perfil e toda permissão é validada novamente no servidor. O painel administrativo pertence a outro projeto, consulta `adminUsers/{firebaseUid}` e acessa os dados somente por uma integração de servidor autorizada. O cliente não lê nem grava `adminUsers`.

Os resumos individuais também são gravados somente pelo backend. Eles são uma
projeção derivada e nunca substituem `activityCompletions`, `connections` ou
`profiles` na validação de uma operação.

O ranking é carregado pelo servidor e expõe somente posição, nome, avatar, XP e
nível derivado. E-mail, empresa, link, skills e papéis internos não fazem parte
da projeção.

## Sinal em tempo real do telão

O telão observa somente o documento `raffleLiveSignals/{eventId}` em produção
e `test_raffleLiveSignals/{eventId}` quando `DEVMODE=true`. Esse
documento não contém participante, candidato ou vencedor: ele informa apenas a
fase (`drawing` ou `updated`), o nome público do prêmio durante o processamento
e `updatedAt`. Ao receber `updated`, a página solicita ao servidor a fotografia
oficial do sorteio.

Como o cliente usa NextAuth e não uma sessão do Firebase Authentication, esse
sinal mínimo precisa aceitar leitura pública. A escrita continua exclusiva do
Firebase Admin.

### Regra publicada no Firebase

O projeto mantém todas as operações do Client SDK bloqueadas por padrão e abre
somente a leitura do sinal mínimo. A configuração completa publicada na aba
**Firestore Database → Regras** deve ser:

```text
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /raffleLiveSignals/{eventId} {
      allow read: if true;
      allow write: if false;
    }

    match /test_raffleLiveSignals/{eventId} {
      allow read: if true;
      allow write: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

O bloqueio recursivo não anula a exceção: quando mais de uma regra corresponde
ao mesmo documento, o Firestore autoriza a operação se pelo menos uma condição
permitir. Dessa forma, somente `raffleLiveSignals` e `test_raffleLiveSignals` podem ser lidas pelo cliente e
nenhuma coleção pode ser escrita pelo Client SDK.

O Firebase Admin SDK usado pelo backend ignora as Firestore Rules. Ele continua
responsável por publicar o sinal e por validar sessão e permissões nas operações
administrativas. O telão `/raffles/live` pode ser aberto sem sessão; seu serviço
público consulta o evento configurado na implantação e retorna somente uma
projeção dos dados apresentados na tela. As coleções completas permanecem
inacessíveis pelo Client SDK.

Não libere leitura direta de `raffles`, `raffleAttempts`, `raffleWinners` ou
`raffleEntryChunks`. Esses documentos continuam protegidos e são consultados
somente pelo servidor.

## Testes obrigatórios

Use o Emulator Suite para provar que:

- usuário não autenticado é bloqueado, exceto na leitura de
  `raffleLiveSignals`;
- usuário lê e edita somente dados permitidos;
- campos protegidos do perfil não podem ser alterados;
- acesso a dados de outro participante é negado;
- coleções críticas rejeitam escrita do cliente;
- consultas legítimas continuam funcionando.

## Próximo documento

➡️ [Server Actions](./06-server-actions.md)
