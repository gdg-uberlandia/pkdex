# Autenticação

O projeto utiliza Auth.js v5 com Google OAuth como único método de login.

## Integração com Next.js

A configuração principal fica em `lib/auth.ts` e exporta `auth`, `handlers`, `signIn` e `signOut`. O Route Handler em `app/api/auth/[...nextauth]/route.ts` reexporta `GET` e `POST` a partir de `handlers`.

A aplicação utiliza sessões JWT sem adapter de usuários do Auth.js. No login Google, o callback JWT substitui o `token.sub` pelo `account.providerAccountId`, que corresponde ao identificador estável da conta no provedor. O callback de sessão disponibiliza esse valor como `session.user.id`. Esse identificador continua sendo a chave primária; o e-mail normalizado é usado somente como fallback para reconciliar um perfil criado anteriormente pelo painel administrativo com Firebase UID. O UUID temporário gerado pelo Auth.js para `user.id` não deve ser usado como chave de domínio.

No Next.js 16, `proxy.ts` protege antecipadamente as rotas configuradas e preserva o destino original. O layout do grupo `(app)` também valida a sessão no servidor por meio de `requireAuth()`. O proxy coordena navegação, mas não substitui a validação de sessão e autorização nas operações sensíveis.

Login e logout são executados pelas Server Actions de `modules/auth/auth.actions.ts`. Destinos recebidos por formulário são validados e convertidos em caminhos internos permitidos antes do redirecionamento.

A página `/login` trata separadamente erros OAuth esperados, falhas inesperadas de renderização, carregamento e estado pendente das ações. Ela também funciona como splash: mantém logo e ilustração estáveis durante a consulta inicial da sessão e revela o formulário com fade-in somente quando não existe usuário autenticado.

O provedor Google envia `prompt=select_account` em toda nova autenticação. Assim, após encerrar a sessão da aplicação, o participante pode escolher outra conta Google em vez de reutilizar silenciosamente a conta ativa no navegador. Esse parâmetro solicita seleção de conta, mas não força novamente a tela de consentimento.

As credenciais `AUTH_GOOGLE_ID` e `AUTH_GOOGLE_SECRET` seguem a inferência de ambiente do Auth.js. A versão exata da dependência continua definida por `package.json` e `pnpm-lock.yaml`.

## Fluxo

```text
Google OAuth → Auth.js → sessão → localizar/criar profile
→ onboarding incompleto ou home
```

Não há cadastro manual, senha ou recuperação de senha.

Após o retorno do provedor, `/auth/complete` valida a sessão e garante a existência do documento de perfil. Perfis incompletos seguem para `/onboarding`; perfis concluídos seguem para o destino seguro solicitado.

## Sessão e perfil

A sessão identifica o usuário com `id`, `name`, `email` e `image`. Dados de domínio são carregados da coleção `profiles`.

No primeiro acesso, o servidor procura `profiles/{googleSub}` e, se não
encontrar, busca exatamente um perfil pelo e-mail normalizado. O fallback
permite reutilizar um perfil administrativo criado pelo painel sob o Firebase
UID. Somente quando nenhuma busca encontra resultado o servidor cria o profile
participante de forma idempotente. Mais de um perfil com o mesmo e-mail é
tratado como inconsistência e interrompe o fluxo.

## Rotas

- `/` e `/login` são públicas;
- `/onboarding` e `/onboarding/profile` exigem sessão e perfil incompleto;
- `/profile` exige sessão e carrega o perfil persistido;
- páginas funcionais exigem sessão e onboarding concluído;
- `/qr/...` pode ser aberto sem sessão, mas qualquer ação exige autenticação e validação.

Redirecionamentos devem ocorrer no servidor sempre que possível e aceitar apenas callbacks internos seguros.

## Autorização

Auth.js comprova identidade, não permissão. Cada operação deve verificar se o usuário pode acessar ou alterar o recurso. Participantes podem editar apenas campos permitidos do próprio perfil e não podem alterar XP, `convertedXp`, `ticketBalance`, scans, tickets ou dados administrativos.

Autorizações internas ficam em `profiles.accessRoles`, separadas do campo
público `role`. Perfis novos criados pela Pokedex começam exclusivamente como
`participant`. Administradores provisionados pelo painel usam exclusivamente
`admin`, sem acumular o papel `participant`. O campo nunca é aceito pela edição
comum do perfil. Reviewers e admins podem validar missões; demais permissões são
derivadas no servidor por operação.

## Segurança

- valide a sessão no servidor;
- use Firebase Admin somente em código de servidor;
- não exponha tokens, segredos ou e-mail em dados públicos;
- limpe estado sensível ao encerrar a sessão;
- registre falhas sem armazenar credenciais ou tokens.

## Checklist

### Fase 3 — Autenticação

- [x] Login e logout funcionam.
- [x] Sessão JWT identifica o participante com `id`, `name`, `email` e `image`.
- [x] Rotas privadas validam a sessão no proxy e no servidor.
- [x] Callbacks aceitam apenas destinos internos permitidos.
- [x] Loading, erros esperados, falhas inesperadas e ações pendentes são tratados.

### Integrações

- [x] Criação do profile é idempotente na Fase 4.
- [x] Onboarding direciona corretamente na Fase 5.
- [ ] Operações de domínio validam autorização além da sessão nas fases correspondentes.

## Próximo documento

➡️ [QR Code](./03-qr-code.md)

## Sponsors

Sponsors seguem diretamente para `/missions`, inclusive com onboarding
incompleto, e têm navegação restrita à validação e à conta. O proxy fornece
o pathname ao servidor e `requireAuth` aplica o redirecionamento de páginas.
As operações mantêm autorização própria. Consulte
[Validação de missões por empresas](./10-sponsor-missions.md).
