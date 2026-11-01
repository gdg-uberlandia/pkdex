# Progressão dinâmica do evento

O teto de referência dos níveis é a soma do XP de onboarding, visitas às empresas
ativas, missões ativas, tags ativas e avaliações das palestras ativas da edição.
Valores específicos de XP do catálogo prevalecem sobre `config/scores.ts`.
Conexões não entram nesse orçamento finito: novas conexões concedem 5 XP por
participante, uma vez, e podem levar o XP total acima do teto de referência.

`modules/progression` calcula o orçamento no servidor usando os repositórios do
catálogo. Home e ranking usam o mesmo orçamento e as mesmas faixas. As permissões
para concluir cada atividade continuam sendo verificadas nas operações originais.
Uma palestra ativa conta no orçamento mesmo quando sua avaliação está temporariamente
bloqueada; o bloqueio controla o momento da ação, não sua existência no evento.

As dez faixas mantêm os títulos existentes, mas deixam de usar o teto fixo de
4.000 XP. Seus custos incrementais crescem exponencialmente (razão aproximada de
raiz de dois), com arredondamento inteiro que preserva custos estritamente
crescentes e coloca o último nível exatamente no orçamento calculado. Orçamentos
artificialmente pequenos podem gerar menos faixas, evitando limites repetidos.

Os níveis são calculados, não persistidos. Alterações no catálogo ajustam as faixas
após a revalidação de seus caches. XP, tickets e registros históricos não são
reescritos. Remover uma conexão revoga o valor preservado naquela conexão.
