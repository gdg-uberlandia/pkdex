# Variáveis de ambiente

Variáveis devem ser validadas e acessadas por `env.ts`, na raiz. O arquivo `.env.example` é a lista oficial de chaves necessárias; valores reais ficam em `.env.local` e na plataforma de deploy.

## Variáveis privadas

Disponíveis somente no servidor:

```env
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
DEVMODE=false
EVENT_ID=
QR_SIGNING_SECRET=
FB_ADMIN_PROJECT_ID=
FB_ADMIN_CLIENT_EMAIL=
FB_ADMIN_PRIVATE_KEY=
```

Podem ser usadas em Server Components, Server Actions, Route Handlers e integrações de servidor. Nunca use o prefixo `NEXT_PUBLIC_` em segredos.

## Variáveis públicas

Enviadas ao navegador e, portanto, sem conteúdo secreto:

```env
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_FB_API_KEY=
NEXT_PUBLIC_FB_AUTH_DOMAIN=
NEXT_PUBLIC_FB_PROJECT_ID=
NEXT_PUBLIC_FB_STORAGE_BUCKET=
NEXT_PUBLIC_FB_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

As chaves públicas do Firebase identificam o projeto, mas não substituem autenticação, autorização ou Firestore Rules.

## Validação e uso

Use `@t3-oss/env-nextjs` com Zod em `env.ts`. Declare separadamente variáveis de servidor e cliente e habilite `emptyStringAsUndefined`.

```ts
import { env } from "@/env"

const projectId = env.FB_ADMIN_PROJECT_ID
```

Evite acessar `process.env` fora do módulo central. Arquivos de Firebase Admin devem importar `server-only` e normalizar quebras de linha da chave privada quando necessário.

## Auth.js

O login Google utiliza Auth.js v5 e requer `AUTH_SECRET`, `AUTH_GOOGLE_ID` e `AUTH_GOOGLE_SECRET`. O prefixo `AUTH_` permite que o Auth.js reconheça automaticamente as credenciais do provider Google, portanto elas não precisam ser repassadas manualmente na configuração.

Na v5, o host normalmente é inferido dos headers da requisição e uma URL privada de autenticação não é obrigatória. `AUTH_URL` deve ser adicionada apenas quando a aplicação utilizar um base path personalizado. `NEXT_PUBLIC_APP_URL` permanece separado para usos no navegador e não contém segredos.

URLs de callback seguem:

```text
http://localhost:3001/api/auth/callback/google
https://seu-dominio.com/api/auth/callback/google
```

Gere um secret forte com:

```bash
pnpm exec auth secret
```

Em ambientes atrás de proxy reverso, avalie `AUTH_TRUST_HOST=true`. Vercel e Cloudflare Pages são detectados automaticamente pelo Auth.js; não habilite confiança em headers de host sem conhecer a infraestrutura.

## Isolamento de dados de desenvolvimento

Quando `DEVMODE=true`, toda coleção raiz acessada pela aplicação recebe o
prefixo `test_`. Por exemplo, `profiles` passa a ser `test_profiles`. A
regra também vale para login, operações em tempo real e scripts administrativos.

Quando a variável estiver ausente ou for `false`, os nomes originais são
usados. Subcoleções mantêm seus nomes porque já estão isoladas sob uma coleção
raiz prefixada. Índices e Firestore Rules que mencionam coleções explicitamente
devem contemplar também os nomes com `test_`.

## Evento da implantação

Cada implantação atende uma única edição e define seu evento por `EVENT_ID`. Esse valor é o identificador estável da edição dentro da aplicação e associa perfis e demais documentos ao evento correto.

Exemplo:

```env
EVENT_ID=devfest-triangulo-2026
```

O valor:

- não é um segredo;
- deve ser estável e não deve mudar depois que dados forem criados;
- deve usar um identificador legível, sem espaços e em `kebab-case`;
- deve ser diferente entre edições, como `devfest-triangulo-2026` e `devfest-triangulo-2027`;
- deve ser igual em todas as instâncias de uma mesma implantação.

O servidor usa `EVENT_ID` ao criar perfis e demais documentos vinculados ao evento. A aplicação não infere o evento consultando `isActive`, evitando comportamento ambíguo quando não houver exatamente um evento ativo.

## Assinatura de QR Codes

`QR_SIGNING_SECRET` assina tokens temporários de QR Code com HMAC-SHA-256 e deve possuir pelo menos 32 caracteres aleatórios. Use um valor exclusivo, diferente de `AUTH_SECRET`, e configure o mesmo segredo em todas as instâncias de uma implantação. A rotação invalida imediatamente tokens emitidos com o valor anterior.

Gere um valor seguro com OpenSSL:

```bash
openssl rand -base64 48
```

O comando imprime uma sequência aleatória em Base64. Copie somente o valor gerado para o `.env.local`:

```env
QR_SIGNING_SECRET=valor-gerado-pelo-openssl
```

Em staging e produção, configure o valor diretamente no gerenciador de variáveis da plataforma de deploy. Gere um segredo diferente para cada ambiente. Não coloque o valor real em `.env.example`, documentação, commits, logs ou mensagens.

## Ambientes

Desenvolvimento, staging e produção devem usar projetos ou configurações isoladas. Não reutilize credenciais de produção localmente. Ao adicionar uma variável:

1. inclua-a em `.env.example` sem valor sensível;
2. valide-a em `env.ts`;
3. configure-a em cada ambiente de deploy;
4. documente seu propósito se o nome não for autoexplicativo.

## Segurança

- não versione `.env.local` ou credenciais;
- não exponha variáveis privadas em mensagens de erro ou logs;
- mantenha chaves privadas apenas no servidor;
- rotacione imediatamente qualquer segredo exposto;
- revise variáveis antes de cada deploy.

## Próximo documento

➡️ [Roadmap](./06-roadmap.md)

## Web Push opcional

`VAPID_PUBLIC_KEY` deve corresponder à chave pública configurada no painel do
site. A chave privada fica exclusivamente no site. Sem essa variável, Avisos
continua disponível sem inscrição push. Veja [configuração completa](../backend/08-notices.md).

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
