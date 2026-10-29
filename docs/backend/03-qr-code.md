# QR Code

QR Codes são links para páginas internas da aplicação. As leituras exigem conexão e são validadas no servidor.

## Formato

Todos os QR Codes usam URLs `/q/{code}` da origem configurada em
`NEXT_PUBLIC_APP_URL`. Os formatos antigos `/qr/...`, UUIDs isolados e o formato
compacto anterior de participante não são aceitos. As rotas antigas foram removidas.

- Participantes: `code` é um identificador aleatório de 128 bits (22 caracteres
  Base64 URL-safe), resolvido no servidor.
- Empresas, missões QR e tags: `code` tem um prefixo `c`, `m` ou `t`, seguido dos
  16 bytes do UUID público codificados em 22 caracteres Base64 URL-safe. São
  códigos fixos de 23 caracteres, sem expiração ou novos registros no banco.

O evento dos códigos fixos é o `EVENT_ID` da implantação. A entidade deve existir
nesse evento e estar ativa. Missões também devem ter `validationType: "qr"`.
Missões por revisor, automáticas, palavra-chave e quiz não têm QR próprio.
O UUID público é aleatório, distinto do ID interno e não representa autorização.

O contrato em `modules/qr-code/qr-code.contract.ts` constrói e interpreta os links
fixos. O codec `scripts/lib/static-qr-code.mjs` também é usado pelo gerador de
imagens. O painel do site mantém o mesmo codec para prévias, downloads e PDFs;
`NEXT_PUBLIC_APP_URL` permite configurar a origem da Pokédex nesse painel.
O parser limita o tamanho a 4.096 caracteres, exige a origem oficial e HTTP/HTTPS,
rejeita credenciais, fragmentos, parâmetros extras, caminhos e codificações inválidas.

### Participantes

O servidor guarda evento, UUID, token assinado e `expiresAt` em
`userQrReferences` (`test_userQrReferences` em teste), usando o SHA-256 do código
como ID. Cada emissão cria uma referência e relê o registro para verificar a
escrita. O modo deve ser explícito e produção exige o projeto
`devfest-triangulo-2026`. Não é necessária migração ou exclusão de dados existentes.

O token interno v3 possui 33 bytes: versão, emissão, nonce e assinatura HMAC de
128 bits. Ele vincula evento, tipo e UUID ao segredo do servidor. A duração atual
é um minuto, com cinco segundos de tolerância. Expiração e assinatura são verificadas
na resolução e novamente pelos serviços de domínio. A interface solicita renovação
antes da expiração. Uma política TTL em `expiresAt` pode limpar registros expirados,
mas a validade é conferida mesmo sem essa configuração de infraestrutura.

O scanner resolve referências por Server Action autenticada. Uma câmera externa
abre `/q/{code}`, exige login e apresenta o resultado correspondente à entidade.
Abrir o código de participante não cria conexão: essa ação depende do scanner.
A renderização do participante mantém correção M e margem de dois módulos; as
artes para impressão mantêm margem de quatro módulos.

## Fluxo

```text
leitura → página interna → validação no servidor → transação/idempotência
→ resultado amigável
```

O scanner apenas controla câmera e leitura. Antes de navegar, ele aplica o
contrato central ao texto lido, bloqueia leituras repetidas enquanto processa o
resultado e exige conexão. Regras de networking, visita, presença, missão, XP
ou tickets pertencem ao serviço correspondente.

## Validação

A validação ocorre em camadas:

```text
texto externo → origem e estrutura → evento e tipo → assinatura temporária
→ existência da entidade → autorização e regra de domínio
```

O contrato central verifica:

- tamanho, protocolo e origem da URL;
- formato exato do caminho;
- evento configurado na implantação;
- tipo permitido e UUID válido;
- ausência de fragmentos e parâmetros inesperados;
- formato da referência curta para participantes.

Depois dessa validação estrutural, o servidor verifica:

- sessão e autorização;
- existência da entidade identificada pelo `qrId`;
- assinatura, claims e expiração do token para participantes;
- duplicidade da ação;
- regras específicas do domínio.

O status ativo de empresas, tags e missões é validado pelos serviços
correspondentes.

Uma leitura válida de empresa abre o deep link da entidade. A página
autenticada dispara uma Server Action para registrar a visita; a requisição
`GET` não altera dados. O servidor cria uma conclusão determinística, concede o
XP padrão ou a sobrescrita da empresa e registra o carimbo na mesma transação.
Reabrir a URL retorna a visita existente sem duplicar pontuação.

Uma leitura válida de tag abre `/q/{code}` e dispara uma Server
Action autenticada. A primeira descoberta registra uma conclusão permanente e
concede o XP padrão ou sobrescrito; releituras não duplicam a recompensa. Nome,
imagem e descrição são apresentados somente depois da validação do servidor.

Missões com `validationType: "qr"` abrem `/q/{code}`. O servidor confirma
que a missão aceita QR, está ativa, teve seus pré-requisitos cumpridos e ainda
não foi concluída. Missões presenciais não possuem QR próprio: um reviewer ou
admin escolhe a missão e usa o scanner em modo de revisão para ler o QR
temporário do participante. Missões com `validationType: "automatic"` não
possuem QR próprio e são concluídas por metas de progresso.

Uma leitura válida de participante feita pelo scanner cria a conexão
automaticamente e concede 5 XP a cada participante. A operação é idempotente:
reler uma conexão ativa não duplica a conexão nem a pontuação. Depois de uma
remoção, existe um intervalo mínimo de um minuto antes de recriar o mesmo par.
A remoção preserva o histórico e revoga de ambos a XP registrada na conexão.

Erros estruturais estáveis incluem `INVALID_QR`, `INVALID_ORIGIN`, `INVALID_EVENT`, `UNSUPPORTED_QR_TYPE` e `MISSING_TOKEN`. Validações temporais acrescentam `QR_EXPIRED`. As fases de domínio acrescentarão erros como `QR_NOT_FOUND`, `QR_ALREADY_SCANNED` e `UNAUTHORIZED` quando suas respectivas operações existirem.

O parser e a assinatura possuem testes automatizados para URLs válidas, quatro tipos de alvo, origem externa, credenciais embutidas, outro evento, tipo desconhecido, UUID inválido, formatos antigos, parâmetros inesperados, tamanho máximo, assinatura ou payload alterados, expiração e tolerância de relógio.

## Material para impressão

O comando `pnpm generate-qr-images` consulta o Firestore e recria as imagens
PNG e o arquivo `qr-links.json` em `artifacts/qr`. Em seguida,
`pnpm generate-qr-pdf` monta `artifacts/pdf-de-qrs.pdf` a partir dessas imagens,
em páginas A4. O material é separado por categoria e inclui:

- empresas ativas com `qrId`;
- tags ativas com `qrId`;
- missões ativas com `validationType: "qr"` e `qrId`.

Entidades inativas e missões validadas por reviewer não são incluídas. Cada
quadro reproduz o material individual: tipo, nome, QR Code em PNG, instrução
de leitura e nome do evento, sem expor a URL ou o ID interno. Empresas são
distribuídas em uma grade 2×2, com cada quadro próximo do tamanho A6. Tags e
missões usam uma grade 3×3. Linhas finas nos espaços entre os quadros ajudam no
corte sem invadir a margem de segurança dos QR Codes.

Para gerar ou atualizar o arquivo:

```bash
pnpm generate-qr-images
pnpm generate-qr-pdf
```

A geração de imagens carrega somente `.env`; use `pnpm generate-qr-images --local`
para carregar somente `.env.local`, ou `--mobile` para usar `.env.local` com
as sobrescritas de `.env.mobile`. `DEVMODE` deve ser explícito no ambiente
selecionado. Produção usa `.env` e exige o projeto `devfest-triangulo-2026`. A pasta `artifacts/qr` é limpa antes de cada geração.

As URLs são construídas com `EVENT_ID` e `NEXT_PUBLIC_APP_URL` do ambiente
carregado. Portanto, um PDF gerado com `NEXT_PUBLIC_APP_URL` apontando para
`http://localhost:3001` serve apenas para testes locais. O material definitivo
deve ser regenerado depois que a origem pública de produção estiver
configurada.

Antes de distribuir o material:

1. confirme a origem informada pelo gerador;
2. teste ao menos um código de empresa, tag e missão no ambiente pretendido;
3. imprima em papel A4 com escala de 100%, sem redimensionamento automático;
4. mantenha contraste e área branca ao redor dos códigos;
5. regenere o PDF sempre que uma entidade for ativada, desativada ou tiver seu
   `qrId` alterado.

## Segurança

- nunca confie no conteúdo lido;
- não exponha IDs internos;
- não trate `qrId` como segredo ou autorização;
- mantenha `QR_SIGNING_SECRET` somente no servidor;
- não conceda XP ou tickets no cliente;
- use operações idempotentes e transações quando houver concorrência;
- aplique limitação de frequência quando necessário;
- não execute mutação automaticamente ao abrir um deep link.

Abrir diretamente o deep link de participante apenas valida o código e
apresenta um resultado. A criação automática da conexão acontece somente por
uma leitura no scanner autenticado, nunca pela simples abertura da URL.

## Próximo documento

➡️ [Segurança](./04-security.md)
