# Server Actions e Route Handlers

## Quando usar

- **Server Actions:** mutações iniciadas pela própria interface, como salvar perfil, concluir onboarding, conectar participantes, registrar visita ou remover conexão.
- **Route Handlers:** scanner, webhooks, integrações externas e endpoints que precisam de contrato HTTP.
- **Firebase Admin:** leitura ou escrita privilegiada exclusivamente no servidor.

## Fluxo

```text
UI → Action/Handler → Service → Repository → Firestore
```

| Camada         | Responsabilidade                                       |
| -------------- | ------------------------------------------------------ |
| Action/Handler | validar entrada, sessão, rate limit e adaptar resposta |
| Service        | autorização e regras de negócio                        |
| Repository     | consultas, transações e persistência                   |

Uma estrutura possível é:

```text
modules/profile/
├── profile.actions.ts
├── profile.service.ts
├── profile.repository.ts
└── profile.schema.ts
```

Crie apenas arquivos necessários ao tamanho do módulo.

## Regras

- valide novamente no servidor, mesmo com validação no cliente;
- verifique autorização dentro do caso de uso;
- retorne códigos estáveis para erros esperados;
- não exponha stack traces ou dados sensíveis;
- revalide cache após mutações;
- aplique transações e idempotência quando necessárias;
- não duplique regras entre Actions e Handlers: ambos chamam o mesmo Service.

No networking, a leitura do QR Code chama uma Server Action porque a mutação
parte do scanner autenticado. Ela recebe evento, UUID público e token, repete a
validação criptográfica no servidor e deriva o participante da sessão. O valor
de XP vem de `config/scores.ts`, nunca do cliente. A remoção recebe somente o ID
determinístico da conexão; o service deriva o participante da sessão e o
repository valida sua posição no relacionamento dentro da transação.

No QR Code fixo de empresa, a rota `GET` valida estrutura e autenticação, mas
não altera dados. Depois da montagem, a página chama uma Server Action com
`eventId` e `qrId`. O service deriva o participante da sessão, e o repository
relê empresa, perfil e conclusão dentro da transação. O cliente nunca informa
ID interno, XP ou identidade do participante.

Tags seguem o mesmo transporte seguro: o `GET` valida e apresenta a página, e
a Server Action recebe somente `eventId` e `qrId`. O service deriva o
participante da sessão; o repository valida tag, perfil e conclusão na
transação. A resposta revela os dados da tag somente após uma descoberta válida
ou já existente.

## Missões

- `completeQrMissionAction` recebe somente evento e QR público da missão;
- `reviewMissionAction` recebe a missão escolhida e o QR temporário do
  participante;
- o servidor carrega o perfil autenticado e autoriza `reviewer` ou `admin`
  globalmente, ou `sponsor` para missões da empresa vinculada;
- a transação relê perfil do operador, missão, empresa e pré-requisitos antes
  de registrar uma confirmação presencial;
- a pontuação vem da missão ou de `SCORES.MISSION_COMPLETION`;
- conclusão, auditoria do reviewer e XP são persistidos em transação
  idempotente.

## Evite

- Firestore em componentes;
- regra de negócio em páginas, Actions ou repositories;
- Firebase Admin em Client Components;
- endpoints genéricos que aceitam campos arbitrários;
- confiar em IDs, pontuação ou permissões enviados pelo cliente.

## Próximo documento

➡️ [Deployment](./07-deployment.md)

A resposta de sucesso de `visitCompanyAction` inclui `companyDescription` e
`companyLogoUrl`, provenientes da empresa validada na transação, para compor
o card de revelação sem uma consulta adicional.
