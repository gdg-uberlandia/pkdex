# Navegação

## Navegação principal

O layout autenticado usa Bottom Navigation com destinos estáveis:

- Home (`/home`);
- Missões (`/missions`);
- Scanner (`/scan`) como ação central;
- Passaporte (`/passport`);
- Perfil (`/profile`).

Empresas, ranking, conexões, palestras e tickets são acessados por atalhos e navegação contextual. Todos os itens principais exibem ícone e texto; o scanner usa um botão central elevado e destacado.

Para participantes, a navegação inferior mantém o Passaporte. Contas
`reviewer` e `admin` veem Operações no mesmo espaço; acessar `/passport` com
esses papéis redireciona para `/operations`.

O layout autenticado mantém os controles de navegação fora da área rolável.
Home, Scanner, Operações e Perfil usam a navegação inferior, com o item atual
identificado visualmente e por `aria-current`. Missões e Passaporte exibem
header com retorno e ocultam a navegação inferior. Telas secundárias, como
edição de perfil e exibição do QR Code, também usam header com retorno.

O `AppShell` oferece “Pular para o conteúdo” como primeiro link, visível ao
receber foco pelo teclado. O destino é o elemento `main`, que aceita foco sem
acrescentar uma parada à sequência de Tab.

O scanner usa o tema dark; as demais rotas principais seguem a preferência
global `Sistema`, `Claro` ou `Escuro`, selecionada no Perfil. Telas secundárias
podem escolher um tema imersivo adequado ao próprio fluxo sem criar outro shell.

## Acesso às rotas

Rotas públicas:

```text
/
/login
/qr/[eventId]/[type]/[qrId]
```

`/onboarding` e `/onboarding/profile` exigem autenticação, mas antecedem o restante da aplicação. A raiz redireciona para `/login`, que mantém sua estrutura visual enquanto verifica a sessão por no mínimo dois segundos. As demais páginas funcionais são protegidas.

## Redirecionamentos

```text
sem sessão → /login
com sessão e onboarding incompleto → /onboarding
com sessão e onboarding concluído → /home
usuário autenticado em /login → destino adequado ao perfil
```

O callback do Google garante a existência do perfil antes de decidir o destino. O layout de onboarding impede que perfis concluídos retornem ao fluxo, e o layout da aplicação impede que perfis incompletos acessem páginas funcionais diretamente.

Preserve o destino original quando seguro para permitir retorno após o login. Nunca aceite URLs externas ou destinos não autorizados como callback.

## Rotas dinâmicas e deep links

- parâmetros devem ser validados no servidor;
- recurso inexistente ou não autorizado deve retornar `notFound` ou erro apropriado;
- deep links de QR Code passam pela validação do servidor antes de qualquer ação;
- scans exigem conexão e exibem sucesso ou erro após a validação;
- IDs públicos de QR Code não devem expor IDs do Firestore.

## Botão voltar e estado

No Passaporte, o retorno aponta explicitamente para `/home`. Destinos de
retorno definidos no header são links navegáveis, inclusive antes da hidratação
do JavaScript.

Os destinos ficam centralizados em `components/layout/route-layout.ts`.
Tags, Ranking, Tickets, Passaporte, Empresas, Conexões e Palestras retornam
à Home. Missões retorna à Home para participantes e a Operações para contas
com permissão de atendimento. Detalhes retornam às respectivas listas;
ferramentas operacionais retornam a Operações. O header nunca usa o histórico
como fallback: um retorno sem destino explícito aponta para `/home`.

Navegação para uma nova área usa links comuns. Encerrar uma etapa usa
`replace`: scanner para resultado de QR, resultado para coleção ou novo scan,
revisão para Missões, scanner operacional para atendimento, próximo atendimento
e edição de perfil ao salvar ou cancelar. O retorno do header também substitui
a entrada atual. Isso evita reabrir resultados que executam ações ao montar.
Não é possível apagar entradas antigas já existentes no histórico do navegador;
recarregar ou abrir diretamente uma URL de resultado continua protegido pela
idempotência do servidor.

O fechamento do modal interceptado de empresa mantém `router.back()` para
restaurar sua tela de origem. A página completa de empresa usa retorno explícito
para `/companies`. Loading e transições não devem permitir ações duplicadas.

Telas compartilhadas podem receber uma origem enumerada para definir o retorno contextual. `/profile/qr-code` aceita `source=home` e `source=missions`, retornando para `/home` e `/missions`, respectivamente. Um valor ausente ou desconhecido mantém `/profile` como destino seguro. Não use URLs arbitrárias recebidas por query string como destino de retorno.

O documento usa `viewport-fit=cover` para que navegadores móveis exponham corretamente as safe areas. O header considera a safe area superior, e a navegação inferior soma a safe area inferior ao espaçamento visual do componente. Somente o conteúdo central deve rolar, preservando os controles principais em telas pequenas.

## Checklist

- [x] Estado ativo da navegação está correto.
- [x] Rotas protegidas validam sessão no servidor.
- [x] Onboarding incompleto é redirecionado.
- [ ] Parâmetros e callbacks são validados.
- [ ] Deep links não executam ações sem autenticação, autorização e validação.

## Próximo documento

➡️ [Firestore](../backend/01-firestore.md)

## Avisos

O sino na home e nos cabeçalhos abre `/notices`, com contador de não lidos.
`/notices/{noticeId}` apresenta o conteúdo completo e marca a leitura depois de
abrir a tela. O botão de voltar leva ao histórico; o histórico volta à home.

Após concluir o onboarding, `/notifications/enable` oferece um convite em tela
cheia para ativar push, com opção Agora não. O convite respeita `PUSH_ENABLED`
e substitui sua entrada por `/home` ao terminar. O ajuste permanente fica em
`/profile#notifications`; em Avisos, o botão para esse ajuste aparece somente
quando push não está ativo no dispositivo e há configuração disponível.

O destino `/profile#notifications` rola explicitamente o contêiner interno
`#main-content` até a seção, após a verificação do push e a montagem do conteúdo.
Isso funciona tanto ao navegar de Avisos quanto ao abrir ou recarregar o link
direto, sem depender da rolagem do documento externo ao AppShell.

A listagem de Avisos usa cards com ícones e destaque para mensagens não lidas,
seguindo as superfícies arredondadas e o degradê das outras coleções. A data
aparece em formato compacto `dd/mm · hh:mm`, no horário de São Paulo, com a
data completa disponível na descrição acessível. O detalhe mantém a mesma
identidade visual e exibe a ação de conteúdo em largura completa.

A tela inicial oferece um ícone de calendário com rótulo acessível
“Ver programação”, ao lado das notificações, para abrir `/schedule`.
A programação usa header com retorno para `/home` e não exibe navegação inferior.

## Telão público do sorteio

A rota `/raffles/live` abre sem login e usa o `EVENT_ID` da implantação. O serviço
`getPublicRaffleDisplay` retorna somente o estado de preparação, os nomes dos
prêmios, o candidato em confirmação, os vencedores confirmados e os marcadores
necessários à apresentação. Não retorna IDs de participantes, pesos de tickets,
operadores nem dados administrativos da simulação. Quando houver simulação ativa,
o telão continua identificando esse modo e exibindo seus resultados.

A página mantém `noindex` e a atualização ao vivo pelo sinal público
`raffleLiveSignals`. Os nomes apresentados no telão ficam acessíveis a qualquer
pessoa com o link. A abertura dessa rota não libera ações administrativas:
sortear, confirmar, refazer e preparar sorteios continuam exigindo sessão e a
permissão `manage-event-operations`.
