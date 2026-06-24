# Registo de actualizações — estratégias de roleta

Este ficheiro resume **mudanças recentes** na lógica e na documentação das estratégias. A especificação completa e estável continua em **[estrategias-roleta.md](estrategias-roleta.md)**; actualiza esse documento sempre que alterares regras no código.

---

## Junho de 2026 — Sala rotativa: desbloqueio após todas as mesas excluídas

Quando na recuperação todas as mesas ficavam em `tablePlacarLosses`, a sessão podia ficar parada em «Aguarde próxima mesa» sem voltar a sinalizar. Agora `lastLostTableId` regista a derrota mais recente; se todas estiverem bloqueadas, libertam-se mesas antigas mas **não** se repete a última derrota. No lobby, os quadros de roleta passam a `observeOnly` (sem sons de cruzamento/placar).

---

## Junho de 2026 — Sala rotativa: não repetir mesa após derrota na recuperação

Em `rotatingRoomCrossingStrategy.ts`, após derrota parcial com rotação activa a mesa derrotada fica em `tablePlacarLosses` e **não** volta a ser escolhida enquanto a recuperação mantém-se. Removido o fallback que ignorava exclusões (podia reposicionar na mesma roleta) e a limpeza automática de `tablePlacarLosses` quando todas as mesas estavam bloqueadas. Sem mesa elegível, a sessão fica em «Aguarde próxima mesa» até surgir cruzamento noutra roleta ou o utilizador zerar o placar.

---

## Junho de 2026 — Sala rotativa: desbloqueio quando sessão presa

Correcção em `rotatingRoomCrossingStrategy.ts`: reconciliação de estados inconsistentes (`awaitSwitchNoTable`, `prepareFingerprint` órfão). *(O fallback sem exclusões e a limpeza automática de `tablePlacarLosses` foram revertidos — ver entrada acima sobre não repetir mesa após derrota.)*

---

## Junho de 2026 — Sala rotativa: sinal com **12+** giros de ausência

`ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS` passa de **8** para **12** em `rotatingRoomCrossingStrategy.ts`. O alerta / POSICIONAR dispara quando um cruzamento cor/altura ou paridade/altura está ausente há **12 ou mais** giros.

---

## Junho de 2026 — Sala rotativa: sinal com **8+** giros de ausência

`ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS` passa de **10** para **8** em `rotatingRoomCrossingStrategy.ts`. O alerta / POSICIONAR dispara quando um cruzamento cor/altura ou paridade/altura está ausente há **8 ou mais** giros (antes 10+). A rota **2 Fatores** (`doisFatoresCrossingStrategy.ts`) usa a mesma constante.

---

## Junho de 2026 — Placar (V / D / %): **janela da hora civil local**

Nos ecrãs com mesas ao vivo (`/ruas-10pct`, `/numeros-28pct`, `/casino-mesa`, lobby **Cassino ao vivo**) e no espelho **Ruas 20%** (`/ruas`), os contadores de **vitórias**, **derrotas**, **empates** (onde existir) e **aproveitamento** passam a reflectir **apenas os giros com marca temporal ≥ início da hora local** (`startOfLocalHourMs`, `sliceNewestFirstHistoryForPlacarLocalHour` em `historyStorage.ts`). A grelha 11×3 e o histórico bruto mantêm-se **completos**. Se não existirem tempos por giro (dados antigos), o placar usa o histórico **inteiro** até haver sincronização. Um relógio de UI (`usePlacarHourClock`) força actualização ao mudar a hora.

---

## Junho de 2026 — Números 2,8%: **cruzamento mais frio** (12 células)

A estratégia deixou o gatilho de altura 11–12, continuação em metade, cruzamento **oposto** ao par e `mirrorConfirmation`. Passa a: entre os **12** cruzamentos (cor×metade, cor×paridade, metade×paridade no tapete), escolher o de **maior** «ausência do cruzamento» (giros desde que **qualquer** número desse cruzamento saiu); em empate, **maior** soma de gaps dos dois números mais frios **dentro** desse cruzamento; **exclusão** = esses dois números. (Antes só a soma dos dois mais frios podia favorecer um cruzamento em que o tipo já tinha saído há pouco — ex. 10 e 18 em «Baixo·Par» — enquanto outros números do grupo ainda tinham gaps altos.) A cada giro recalculam-se os dois mais frios **no mesmo** cruzamento; se o giro for um número **desse** cruzamento (exemplar dos dois factores), volta a correr a competição entre os 12. Implementação: `pickWinningColdestCrossingBucket` / `CROSSING_BUCKET_DEFINITIONS` em `liveTableColdStats.ts`; estado em `nums28PctStrategy.ts`.

---

## Junho de 2026 — Números 2,8%: gatilho **11** e **12**, exclusão por **cruzamento oposto**

`NUMS_28_PCT_CRITICAL_HEIGHT_GRID_INDICES` = **`[10, 11]`** (par nas pos. 11–12 da grelha; a **Ruas 9%** passou a usar uma célula e `criticalHeightSingleGridIndex` — ver entrada «Ruas 9%: gatilho por uma posição» neste registo). O pool dos dois exclusivos deixa de ser «metade oposta sem cor+par dominantes» e passa a ser o **cruzamento oposto** ao tipo de par nas pos. 11–12: só altura+cor → **cor×metade** oposta; só altura+paridade → **metade×paridade** oposta; ambos → **cor×paridade** oposta; depois **dois mais frios** nesse pool. Lobby: tab **Números 2,8%** com os mesmos quatro cartões; rota `/numeros-28pct` activa (layout espelhado na Ruas 9%).

---

## Junho de 2026 — Ruas 9%: gatilho por **uma** posição (4–12) e **altura**

`criticalHeightSingleGridIndex` em `SimulateStreetStrategyOptions` (prioridade sobre `criticalHeightGridIndices`). O selector em `ruas9PctAutoCritical.ts` compara o placar simulado nos **20** giros mais recentes para cada posição **4–12** na grelha e escolhe a de melhor **W/(W+L)**. O armamento usa só a **metade** do giro nessa célula (≠0), sem `isStreetPairTrigger` entre duas posições. `RUAS_9_PCT_STREET_OPTS` usa `RUAS_9_PCT_CRITICAL_HEIGHT_SINGLE_GRID_INDEX` (**11**, índice `10`) como referência estática. Confirmação espelho e `liveCriticalTripleSupportsZone` usam o índice duplicado `[i,i]` quando há posição única.

---

## Junho de 2026 — Remoção do painel **Aprendizado — última derrota**

O bloco em `/ruas` e `/ruas-10pct` foi retirado da UI (componente e `streetStrategyLastLossLearning.ts` removidos).

---

## Junho de 2026 — Sinal no tapete: **últimos 2 giros** na metade do alvo

`lastTwoSpinsInIndicationHalf` em `criticalHeightGatilho.ts`: `history[0]` e `history[1]` (≠0) têm de cair na mesma metade que a `zone` da indicação. Integrado em `criticalHeightAlertAlignedWithRecentDominance` (logs / alerta prioritário). O tapete Ruas 20% / 9% mostra o sinal sempre que há `active`; o **placar** segue a mesma simulação.

---

Removidos `highlightCriticalCells`, `accentCellIndices` e o anel âmbar em `roulette-history-grid-11x3.tsx`. A lógica de gatilho / confirmação continua nos módulos de estratégia; só deixou de haver destaque visual nas células da grelha.

---

Com indicação **Alto** (19–36), o par definido por distâncias no anel passa a considerar **apenas** números **Baixos** (1–18) em cada distância; com indicação **Baixo**, só **Altos** (19–36). Parâmetro `exclusionNumbersHalf` em `pickExclusionFromMissingWheelDistances` (`cylinderIndication.ts`); a UI e o placar histórico passam `oppositeZoneIndication` / `oppositeZone`.

---

## Junho de 2026 — Números 2,8%: posições críticas **1** e **2** (actual)

`NUMS_28_PCT_CRITICAL_HEIGHT_GRID_INDICES` = **`[10, 11]`** (11.º e 12.º giro na grelha 11×3, `history[10]` e `history[11]` newest-first). As **Ruas** mantêm **`[10, 21]`** (11.º e 22.º).

---

## Junho de 2026 — Remoção do botão **«Rejeitar entrada»**

Nas rotas Ruas 20%, Ruas 9% e Números 2,8% deixou de existir o painel com rejeição do último giro e o registo em `roulette.mirrorIndicationFeedback.log`. Mantém-se só a grelha 11×3 (`RouletteHistoryGrid11x3Section`). Removidos `mirror-history-feedback-panel.tsx` e `mirrorIndicationFeedback.ts`.

---

## Junho de 2026 — Gatilho de **altura** nas posições críticas (Ruas 20% / 9% / Números 2,8%)

O armamento das abas que partilham o histórico `espelho` deixou de depender de `computeEspelhoState` (`mirrorWheel.ts`). Passou a usar **`evaluateCriticalHeightGatilho`** (`criticalHeightGatilho.ts`): **Ruas 20% / 9%** com posições **11** e **22** ou **11** e **12**; **Números 2,8%** com **`NUMS_28_PCT_CRITICAL_HEIGHT_GRID_INDICES`** (posições **11** e **12**, `history[10]`, `history[11]`). Em todos os casos os dois giros críticos têm de ser não-zero e **na mesma metade** (`isStreetPairTrigger`). **Cor** e **paridade dominantes** orientam as exclusões (ruas: frieza no semicíclio apostado; 2,8%: **cruzamento oposto** + dois mais frios). Ruas: `buildActiveFromCriticalGatilhoPrefix`, `pickExcludedStreetsForCriticalGatilho`; 2,8%: `buildNums28PctFromCriticalPrefix`. O filtro `mirrorConfirmationAlignsWithBetNumbers` e o scope `espelho` mantêm-se. Documentação: §5–§7 e §10 em `estrategias-roleta.md`.

---

## Junho de 2026 — Tendência recente (`recentHalfDominanceZone`): só alerta, não armamento

A dominância da metade (regra em §5.1.1) **não** bloqueia o armamento nem `liveCriticalTripleSupportsZone` nem o placar. Com **≥ 22** giros, só os **22** mais recentes definem a dominância de mesa (mín. 10 ≠ 0, margem +3); com **5–21** giros usa-se a janela de **5** (mín. 3 ≠ 0, margem +2). `criticalHeightAlertAlignedWithRecentDominance` reflecte se convém destacar «alerta prioritário» (combinado com a minoria do alvo nos últimos 5 giros, §5.1.1).

---

## Junho de 2026 — Posições críticas na grelha (três abas): **11.º e 22.º** giro

Deixou de usar-se o giro na posição **10.º** da grelha (`history[9]`). O gatilho passa a considerar só **`history[10]`** e **`history[21]`** (células de índice 10 e 21). O triplo cronológico guardado para empates / `liveCriticalTripleSupportsZone` mantém três elementos com o terceiro repetindo o giro da pos. 11 (`[n22, n11, n11]`). O filtro `mirrorConfirmationAlignsWithBetNumbers` usa `MIRROR_CONFIRMATION_HISTORY_INDICES = [10, 21]` em `mirrorConfirmationColumn.ts`.

Histórico de evolução: antes **11.º / 22.º / 33.º** (`history[10]`, `[21]`, `[32]`); depois trio **10.º / 11.º / 22.º** (`history[9]`, `[10]`, `[21]`); estado actual **só 11.º e 22.º** da grelha.

---

## Junho de 2026 — Remoção da aba **11-22-33** (`/race-11-22-33`)

A rota e o módulo `raceGrid33Strategy.ts` foram **removidos** (grelha posições 11, 22 e 33).

---

## Junho de 2026 — Remoção da aba **Lados A/B**

A rota `/lados-ab` e o módulo `abSidesStrategy.ts` foram **removidos**. O tapete `Nums28PctTable` voltou a usar só cobertura verde em todo o 1–36 (excepto dois exclusivos), sem `coveragePool`.

---

## Junho de 2026 — Placar **Números 2,8%** (zero vs. exclusivos)

### Resumo

No placar da aba **Números 2,8%**, o **zero** deixou de ser tratado como derrota automática. A derrota (**L**) ocorre **apenas** quando o número sorteado é **um dos dois números excluídos** (`excludedNumbers`) da indicação activa nesse momento. Em qualquer outro caso — **incluindo o zero** — o placar regista **vitória** (**W**).

### Porquê

Os dois exclusivos são sempre escolhidos no **pool 1–36** da metade oposta à zona de indicação. O **0** nunca entra nesse pool como candidato a exclusão, logo **nunca** aparece em `excludedNumbers`. Faz sentido alinhar o placar com a noção de “buracos” no tapete: só perdes quando a bola cai num dos dois buracos; o zero não é um deles.

### O que mudou no código

| Área | Alteração |
|------|-----------|
| `nums28PctPlacarOutcomes` (`src/lib/roulette/nums28PctStrategy.ts`) | **L** só se `num === excludedNumbers[0] \|\| num === excludedNumbers[1]`; caso contrário **W** (inclui `num === 0`). |
| Comentário de cabeçalho do mesmo módulo | Texto do placar alinhado com a regra acima. |
| §7.6 em `docs/estrategias-roleta.md` | Documentação do placar actualizada (antes referia derrota no zero). |

### O que **não** mudou (importante para não confundir)

A **simulação de estado** (`runNums28PctChronological` / `simulateNums28PctStrategy`) mantém-se: quando sai **0**, a indicação **desactiva-se** (`active = null`), tal como nas Ruas 20% / 9% com `mirrorHeightIndication`. Ou seja:

- **Placar (W/L):** zero → **W** (desde que haja indicação activa antes do giro e o zero não seja exclusivo — na prática, sempre).
- **Continuação da estratégia:** zero → **corta** o ciclo activo até novo armar pelo gatilho de altura.

Quem reproduzir a lógica noutro sistema deve implementar **as duas** camadas com esta distinção.

### Referências rápidas

- Placar: `nums28PctPlacarOutcomes`, snapshots `nums28PctActiveAfterEachChronologicalPrefix`.
- Especificação longa: [estrategias-roleta.md §7.6](estrategias-roleta.md#76-placar-28).

---

## Linha de base anterior (histórico do repositório)

Funcionalidades já descritas em detalhe em `estrategias-roleta.md` (sem duplicar aqui todo o texto):

- **Gatilho de altura** nas posições críticas partilhado entre **Ruas 20%**, **Ruas 9%** e **Números 2,8%** (`evaluateCriticalHeightGatilho`; `mirrorWheel` / `computeEspelhoState` ficaram legado para utilitários).
- **Histórico unificado** no scope `espelho` (`ROULETTE_MIRROR_HISTORY_SCOPE`) e migração a partir de chaves legadas.
- **Frieza** com `resolveFriezaWindowNums` e constantes em `streetStrategy.ts`.
- **Calculadora na rota `/`** com lógica de cilindro distinta (secção 8 do doc principal).

Commits de referência no histórico do Git (funcionalidade mais ampla): `feat(roleta): Ruas espelhadas…`, `feat(roleta): Ruas 20%/10%, live SSE…`.

---

*Última revisão deste registo: junho de 2026.*
