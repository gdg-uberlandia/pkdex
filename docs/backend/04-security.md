# Segurança

## Princípios

- menor privilégio;
- validação em todas as fronteiras;
- autorização por operação e recurso;
- operações críticas somente no servidor;
- mínima coleta e exposição de dados.

## Controles

### Identidade e acesso

- valide sessões Auth.js no servidor;
- não trate autenticação como autorização;
- participantes editam apenas campos permitidos do próprio perfil;
- privilégios administrativos existem somente via Firebase Admin e ambiente confiável;
- `adminUsers/{firebaseUid}` é a fonte de autorização do painel e exige
  `isActive: true`;
- `profiles.accessRoles` não pode ser alterado pela edição comum do perfil;
- a reconciliação por e-mail exige um único perfil; ambiguidades são rejeitadas
  sem promover ou criar documentos;
- `reviewer` e `admin` validam missões presenciais globalmente; `sponsor`
  valida somente missões da própria empresa, com autorização relida dentro
  da transação de conclusão;
- a autorização é relida no servidor em cada validação;
- o QR temporário comprova o participante presente, mas não substitui a
  autorização do reviewer nem os pré-requisitos.

### Dados e mutações

- valide formulários, params, QR Codes, Actions e Handlers com Zod;
- cliente não altera XP, ranking, scans ou tickets;
- use transações em operações concorrentes;
- aplique idempotência em scans, conexões e concessão de tickets;
- Firestore Rules continuam necessárias mesmo com validação na aplicação.

### Privacidade

Dados públicos podem incluir nome, avatar, bio, skills e redes sociais escolhidas pelo participante. O e-mail é compartilhado somente entre conexões aceitas. IDs internos, credenciais, informações administrativas e logs internos são privados.

Os dados do evento são mantidos por até dois anos. A política de retenção deve permitir exclusão ou anonimização ao final do prazo e considerar backups e dados derivados.

### Segredos e logs

- segredos nunca usam `NEXT_PUBLIC_`;
- Firebase Admin permanece no servidor;
- não registre tokens, sessões, chaves ou dados pessoais desnecessários;
- mensagens ao cliente não devem revelar stack traces ou detalhes internos.

## Checklist

- [ ] Entrada, sessão e autorização validadas.
- [ ] Escritas críticas ocorrem no servidor.
- [ ] Concorrência e repetição são seguras.
- [ ] Dados privados não aparecem em respostas ou logs.
- [ ] Firestore Rules refletem o menor privilégio.

## Próximo documento

➡️ [Firestore Rules](./05-firestore-rules.md)
