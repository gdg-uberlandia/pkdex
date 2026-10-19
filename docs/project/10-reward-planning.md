# Planejamento de brindes e tickets

## Quando usar

Quando o organizador disser **“quero calcular os brindes”**, seguir este fluxo antes de recomendar novas compras ou custos. Este documento registra o acordo de planejamento de 18/10/2026.

O recálculo altera somente:

- os tickets necessários para cada brinde;
- a quantidade recomendada para os brindes cuja quantidade não foi informada.

Não alterar XP, conversão de tickets, ticket inicial, regras de resgate ou criar desbloqueios. Quantidades fornecidas pelo organizador são fixas; não recomendar compra adicional desses itens sem uma solicitação específica. Calcular e apresentar a proposta não autoriza gravar no Firebase, executar seed ou alterar arquivos de implementação.

## 1. Perguntar o estoque conhecido

Perguntar quais itens e quantidades o organizador já possui ou tem confirmados. Apresentar a lista em ordem crescente de valor:

1. Doces.
2. Caneta.
3. Bloco de notas.
4. Chaveiro.
5. Copos — mesmo custo em tickets do chaveiro.
6. Garrafinha.
7. Caneca.
8. Eco-bag.

Modelo: “Quais desses brindes você já tem e em quais quantidades? Responda na ordem acima; para o que ainda não souber, escreva ‘não definido’.”

Se a mensagem já trouxer quantidades, aproveitá-las e perguntar apenas o que estiver ambíguo. Zero é uma quantidade confirmada, diferente de quantidade desconhecida. Não preencher itens desconhecidos como se fossem estoque existente. Atualmente, chaveiros, copos, garrafinhas, canecas e eco-bags aguardam confirmação; isso não impede o organizador de informar outros itens.

## 2. Referências de público e distribuição

Evento anterior: 1.600 participantes, 1.086 logins e aproximadamente 855 pessoas com pontuação acima de zero. As faixas fornecidas somam 1.085 pessoas, uma a menos que o total de logins.

- Taxa de login: `1086 / 1600`, aproximadamente 67,9%.
- Taxa de atividade sobre o público: `855 / 1600`, aproximadamente 53,4%.
- Público esperado atual: 1.700 pessoas.
- Projeção: aproximadamente 1.154 logins e 908 pessoas ativas.

A hipótese intermediária é que 50% dos ativos realizem trocas, com média de 1,4 item por pessoa. Essas taxas são premissas, não resultados medidos. A fórmula produz aproximadamente 636 itens; o planejamento foi arredondado para **640 itens**. Não apresentar esse estoque como garantia de atendimento.

| Brinde         | Quantidade de referência | Tickets de referência |
| -------------- | -----------------------: | --------------------: |
| Doces          |                      256 |                     3 |
| Caneta         |                      160 |                     5 |
| Bloco de notas |                       96 |                     8 |
| Chaveiro       |                       48 |                    10 |
| Copos          |                       48 |                    10 |
| Garrafinha     |                       16 |                    12 |
| Caneca         |                       10 |                    15 |
| Eco-bag        |                        6 |                    24 |
| **Total**      |                  **640** |                       |

Concentração desejada: 80% dos itens nos três primeiros brindes e 95% nos cinco primeiros. São referências de planejamento; estoques confirmados podem impedir essas proporções.

## 3. Recalcular as quantidades faltantes

1. Preservar todas as quantidades confirmadas.
2. Usar 640 como total de referência enquanto o público e as premissas forem os mesmos.
3. Calcular `saldo = max(0, 640 - soma das quantidades confirmadas)`.
4. Distribuir o saldo somente entre os itens não informados, proporcionalmente aos pesos da tabela de referência. Exemplo: se somente doces e canetas estiverem desconhecidos, usar a proporção `256:160`.
5. Arredondar pelo método dos maiores restos: tomar a parte inteira de cada resultado e distribuir as unidades restantes pelas maiores partes fracionárias, desempatando pela ordem da tabela.
6. Conferir a concentração final nos itens menores e intermediários. Se a distribuição ficar muito diferente da referência, explicar o motivo e apresentar uma alternativa de compra apenas para os itens desconhecidos, identificando eventual aumento do total.

Se o estoque conhecido já atingir ou ultrapassar 640, o saldo inicial é zero. Não recomendar automaticamente zero dos demais itens como plano equilibrado: mostrar o desvio e propor uma alternativa justificada, sem reduzir o estoque informado. Se todas as quantidades forem conhecidas, não inventar compras faltantes.

## 4. Recalcular os tickets sem alterar XP

Consultar os valores atuais em [scores](../../config/scores.ts), [tickets](../../config/tickets.ts) e as atividades ativas do evento. Usar XP personalizado das entidades quando existir. Não executar scripts destrutivos para obter essas informações.

Referência de 18/10/2026, com todas as palestras consideradas disponíveis para avaliação:

| Fonte                      |  XP total |
| -------------------------- | --------: |
| 25 missões                 |       840 |
| 22 tags                    |     1.650 |
| 21 avaliações              |     1.575 |
| 5 empresas                 |       500 |
| Onboarding                 |        75 |
| **Total sem networking**   | **4.640** |
| 32 conexões, com 5 XP cada |       160 |
| **Total de referência**    | **4.800** |

Conversão: 200 XP por ticket e um ticket inicial. O objetivo acordado é que concluir todas as atividades e realizar 32 conexões permita comprar uma eco-bag e manter um ticket, sem trocas anteriores:

`ticket eco-bag = 1 + floor((XP das atividades + 32 × XP por conexão) / XP por ticket) - 1`

Na referência atual: 25 tickets totais, eco-bag por **24**, sobra de **1**. Esse objetivo é uma referência matemática, não uma exigência de atividades: conexões podem compensar atividades não realizadas. Não implementar desbloqueio.

Ao precificar os demais itens:

- manter a ordem crescente e chaveiros/copos com o mesmo preço;
- favorecer trocas de itens menores e intermediários;
- usar os preços atuais como ponto inicial, elevando a atratividade dos itens abundantes e reduzindo a dos escassos;
- justificar cada mudança com estoque e esforço em XP, sem inventar uma fórmula exata de demanda baseada apenas na quantidade disponível;
- mostrar `XP mínimo = max(0, (preço - 1) × 200)` quando útil, considerando o ticket inicial e nenhuma troca anterior.

A eco-bag fica ancorada em 24 tickets enquanto a meta de 32 conexões, o XP e a conversão permanecerem os mesmos. Não é possível ajustar livremente seu preço por estoque e preservar simultaneamente essa conta. Se a quantidade confirmada parecer incompatível com a procura estimada, apresentar o conflito e pedir uma decisão sobre a meta, sem mudar XP ou a meta silenciosamente.

Não prometer que todas as eco-bags serão resgatadas: isso depende da distribuição real de XP, das preferências e dos tickets gastos antes. O histórico agregado não informa quantas pessoas alcançarão cada prêmio.

## 5. Entregar o resultado

Apresentar:

1. Uma tabela completa com **brinde, quantidade e tickets**, na ordem de valor.
2. Uma identificação clara das quantidades confirmadas e das estimadas.
3. Uma lista dos itens ainda necessários e das quantidades recomendadas para compra.
4. O total de itens, a concentração nos menores/intermediários e as premissas usadas.
5. A conferência da eco-bag, incluindo XP, conexões e ticket restante.

Atualizar este documento com a última proposta aceita, diferenciando quantidades confirmadas de estimativas. Atualizar código ou banco somente quando isso fizer parte do pedido do organizador.
