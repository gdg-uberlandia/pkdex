# Project Instructions

## Escopo

O DevFest Triângulo Pokedex é uma aplicação mobile first para participantes do evento. Cada implantação atende uma edição, mas a base deve ser reutilizável em edições futuras.

O produto inclui autenticação com Google, perfil, onboarding, networking por QR Code, empresas, tags, missões, passaporte, palestras, XP, níveis, ranking e tickets por conversão de XP para sorteios. Badges foram removidas do produto.

O painel administrativo já existe em outro projeto e está fora deste repositório. Não implemente gestão administrativa, cadastro de conteúdo ou relatórios administrativos aqui, salvo uma integração explicitamente solicitada.

## Stack

- Next.js 16+ com App Router e React 19+;
- TypeScript strict;
- Tailwind CSS v4 e Shadcn/UI;
- Auth.js com Google OAuth;
- Firebase Admin, Cloud Firestore e Firebase Storage;
- React Hook Form e Zod;
- pnpm.

Versões exatas pertencem ao `package.json` e ao lockfile.

## Arquitetura

Utilize Server Components por padrão e mantenha a menor fronteira de cliente possível. Use `"use client"` somente para estado, eventos, câmera, APIs do navegador ou bibliotecas incompatíveis com o servidor.

```text
UI → Server Action/Route Handler → Service → Repository → Firestore
```

- páginas e componentes coordenam apresentação e interação;
- Actions e Handlers validam entrada, sessão e contrato de transporte;
- Services aplicam autorização e regras de negócio;
- Repositories executam consultas, transações e persistência;
- utilize a estrutura do App Router diretamente na raiz; não crie o diretório `src/`;
- regras de negócio ficam em `modules`;
- infraestrutura e integrações ficam em `lib`;
- primitivas Shadcn ficam em `components/ui`;
- arquivos gerados em `components/ui` não devem ser alterados por ESLint ou Prettier;
- componentes não acessam o Firestore diretamente;
- Firebase Admin é exclusivo do servidor e deve ser protegido com `server-only`.

## Código

- Não utilize `any`; trate entradas desconhecidas como `unknown` e refine-as.
- Valide entradas externas com Zod, inclusive no servidor.
- Utilize imports absolutos com `@/`.
- Utilize arquivos e pastas em `kebab-case`.
- Utilize Conventional Commits em inglês.
- Não altere arquivos fora do escopo solicitado.
- Preserve alterações existentes e não relacionadas.
- Não registre tokens, credenciais, sessões ou dados pessoais desnecessários.

## Segurança e integridade

- Nunca confie em dados enviados pelo cliente.
- Autenticação não substitui autorização; valide permissão por operação e recurso.
- XP, níveis, `xpReachedAt`, scans, conexões e tickets são controlados pelo servidor.
- Operações repetíveis devem ser idempotentes.
- Use transações ou operações atômicas quando houver concorrência.
- IDs internos do Firestore não podem aparecer em QR Codes.
- O e-mail não é público; pode ser compartilhado somente entre conexões aceitas.
- Dados do evento são mantidos por até dois anos e depois devem ser excluídos ou anonimizados conforme a política definida.
- Firestore Rules continuam obrigatórias mesmo quando o acesso ocorre por código de servidor.

## Regras de domínio

### QR Codes

- Formato: `/qr/{eventId}/{type}/{qrId}`.
- Tipos: `user`, `company`, `mission` e `tag`.
- Scans exigem conexão e validação no servidor.
- O QR Code do participante expira após um minuto.
- QR Codes de empresas, missões com `validationType: "qr"` e tags são fixos e controlados pelo estado da entidade.
- Palestras não possuem QR Code; a avaliação é liberada manualmente por administradores.
- Abrir diretamente um deep link não deve ignorar autenticação, autorização ou validação.

### Networking

```text
scan → conexão automática → concessão de XP
```

- uma conexão concede XP aos dois participantes uma única vez;
- o participante pode remover uma conexão;
- a remoção revoga a XP concedida, mas preserva o histórico;
- criação, concessão e revogação devem ser atômicas e idempotentes.

### Empresas

- cada empresa possui somente um QR Code ativo;
- QR Codes adicionais no estande pertencem a missões associadas à empresa;
- a primeira visita concede XP e um carimbo; novas leituras retornam o estado existente;
- visitas e seus carimbos são permanentes e não possuem fluxo de remoção;
- visita, XP e carimbo são registrados atomicamente e de forma idempotente.

### Tags

- cada tag possui um único QR Code fixo e pode ser descoberta uma vez por participante;
- descobertas e seus XP são permanentes e não possuem fluxo de remoção;
- tags bloqueadas exibem somente slots anônimos; nome, imagem e descrição são revelados após o scan;
- descoberta e XP são registrados atomicamente e de forma idempotente.

### XP, ranking e tickets

- XP não é moeda e não pode ser gasto;
- níveis usam até dez faixas dinâmicas de `config/levels.ts`, com custos crescentes, normalizadas pelo orçamento de XP das atividades disponíveis do evento (sem conexões);
- o nível é calculado a partir do XP e não persistido separadamente;
- número e título aparecem juntos, como `Nível 5 · Guardião dos Logs`;
- o ranking é geral e ordenado por XP;
- em empate, fica à frente quem atingiu primeiro a pontuação atual, usando `xpReachedAt`;
- persistindo o empate, o ID do perfil define uma ordem determinística;
- somente perfis concluídos com papel `participant` aparecem no ranking;
- o ranking usa consultas indexadas e contagem até o cursor do participante;
- participantes no pódio recebem o Top 10; os demais recebem o Top 3 e até
  três vizinhos de cada lado, sem repetir o pódio;
- a ordenação completa em memória, com cache de 60 segundos, permanece como
  fallback temporário somente para o erro `failed-precondition` do Firestore;
- concluir o onboarding concede um ticket inicial, inclusive retroativamente;
- cada 200 XP ainda não convertidos pode gerar um ticket;
- converter XP não reduz XP, nível ou posição no ranking;
- tickets gastos em brindes deixam de participar do sorteio;
- resgates atualizam saldo, estoque, agregado do participante e ledger na mesma
  transação;
- `reviewer` e `admin` realizam resgates; somente `admin` controla bloqueios;
- vencedores são excluídos dos sorteios seguintes;
- concessões, conversões, resgates e sorteios devem ser idempotentes e
  auditáveis.

### Missões e palestras

- perfis possuem `accessRoles`; contas novas começam como `participant`;
- `role` continua sendo o cargo público e nunca concede autorização;
- `reviewer` e `admin` podem validar missões presenciais;
- staff só recebe XP se também possuir explicitamente o papel `participant`;
- missões usam `validationType` igual a `qr`, `reviewer` ou `automatic`;
- missões `automatic` são concluídas por metas de progresso e não possuem QR próprio;
- qualquer usuário com papel de reviewer pode validar uma missão que exija revisão;
- missões podem exigir visitas ou outras conclusões como pré-requisitos;
- avaliações de palestra são liberadas manualmente por administradores, sem QR Code de presença;
- enviar uma avaliação válida conclui sua missão e concede XP uma única vez;
- avaliações são vinculadas ao perfil do avaliador.

### Passaporte

- o passaporte é uma projeção das conclusões de empresas, tags e missões;
- não crie uma coleção duplicada de passaportes;
- o XP exibido vem dos valores preservados em cada conclusão;
- tags ainda não descobertas permanecem anônimas também no passaporte;
- somente perfis com papel `participant` possuem jornada no passaporte.

## Decisões pendentes

Consulte `docs/project/06-roadmap.md` para o escopo e as fases pendentes e
`docs/backend/01-firestore.md` para os contratos de domínio documentados.
Valores de XP, níveis e conversão de tickets ficam em `config/scores.ts`,
`config/levels.ts` e `config/tickets.ts`.

Se uma tarefa depender de uma regra ainda não definida nesses documentos ou
contratos, solicite definição antes de implementar o comportamento.

## Documentação

Sempre consulte:

- `docs/project/01-project-overview.md`;
- `docs/project/03-project-architecture.md`;
- `docs/project/04-code-standards.md`.

Consulte conforme a tarefa:

- dados: `docs/backend/01-firestore.md`;
- autenticação: `docs/backend/02-authentication.md`;
- QR Code: `docs/backend/03-qr-code.md`;
- segurança: `docs/backend/04-security.md`;
- permissões: `docs/backend/05-firestore-rules.md`;
- operações de servidor: `docs/backend/06-server-actions.md`;
- componentes e páginas: `docs/frontend/02-components.md` e `docs/frontend/03-pages.md`;
- navegação: `docs/frontend/04-navigation.md`;
- prioridades: `docs/project/06-roadmap.md`.

Atualize a documentação quando alterar arquitetura, schema, regras, rotas, contratos, ambiente ou comportamento do produto.

## Validação

- Para código ou configuração, execute `pnpm check`.
- Antes de concluir uma funcionalidade, execute também `pnpm build`.
- Para alterações apenas em Markdown, valide Prettier, links locais e `git diff --check`.
- Teste Firestore Rules com o Emulator Suite quando forem alteradas.
- Teste câmera e scanner em dispositivo real quando possível.
