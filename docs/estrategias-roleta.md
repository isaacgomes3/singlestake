Estratégias de roleta — documentação para implementação

Este documento descreve as regras implementadas neste repositório para poderes reproduzir a mesma lógica **noutro sistema** (backend, app móvel, folha de cálculo, etc.). Os nomes dos ficheiros referem a implementação de referência em TypeScript.

**Mudanças recentes (changelog resumido):** [atualizacao-estrategias.md](atualizacao-estrategias.md).

### Resumo das abas com histórico `espelho` (gatilho §5 onde aplicável)

| Aba | Opções / módulo | O que muda em relação ao **mesmo** gatilho de altura |
|-----|-----------------|------------------------------------------------------|
| **Ruas 20%** | `simulateStreetStrategy`, `mirrorHeightIndication: true`, `placarBetStreetsAsDraws: true`, `exclusionStreetCount: 2` | Gatilho nas pos. **11** e **22**: mesma metade **e** (cor ou paridade); **dominância recente** (§5.1.1) afecta **só** o destaque do alerta, **não** o armamento nem o placar; ficha na metade da indicação; transversais no semicíclio oposto; **duas** ruas excluídas; giro numa transversal **com ficha** = **empate** no placar (não vitória). |
| **Ruas 9%** | Em **lobby**, `/ruas-10pct` e `/casino-mesa`: `ruas9PctAutoCritical.ts` compara o aproveitamento **W/(W+L)** no placar simulado só nos **20 giros mais recentes** para cada **posição isolada 4–12** na grelha (`history[3]` … `history[11]`); escolhe a de melhor % e aplica `criticalHeightSingleGridIndex` ao histórico completo. `RUAS_9_PCT_STREET_OPTS` usa `RUAS_9_PCT_CRITICAL_HEIGHT_SINGLE_GRID_INDEX` (pos. **11**) como referência estática. `exclusionStreetCount: 1`. | §5.1.1 só no alerta; ficha na metade da indicação; transversais no semicíclio oposto; **uma** rua excluída (frieza no semicíclio apostado), desempate `gatilhoTripleFactorOverlapScore`. **Gatilho:** só **altura** do giro na célula escolhida (≠0), sem par `isStreetPairTrigger` entre duas posições. |
| **Números 2,8%** (`/numeros-28pct`) | `simulateNums28PctStrategy` (`NUMS_28_PCT_CRITICAL_HEIGHT_GRID_INDICES` = `[10,11]`, pos. **11** e **12**), `nums28PctPlacarOutcomes`, `nums28PctPlacarOutcomesWithCylinderSpinExclusion` (variante cilindro) | **Gatilho** nas posições **11** e **12** (par `isStreetPairTrigger`, §5); **continuação** como nas Ruas (`indicationZone`, `isStreetPairTrigger`, zero desliga). **Exclusão:** conforme o tipo de par (`streetPairTriggerKind`), o *pool* é o **cruzamento oposto** — **cor×metade** oposta (só altura+cor no par), **metade×paridade** oposta (só altura+paridade), ou **cor×paridade** oposta (ambos); escolhem-se os **dois números mais frios** nesse pool (`pickTwoColdestNumbersInPool`). **Confirmação espelho:** `mirrorConfirmationAlignsWithBetNumbers` com cobertura = **1–36 excepto** os dois exclusivos. **Tapete:** realce de cobertura em todo o 1–36 excepto os dois «vazios». `NUMS_28_CILINDRO_EXCLUSAO_MIN_GIROS` = 15 na variante cilindro. |

O **gatilho de altura** nas **Ruas 20%** usa posições **11** e **22** (`history[10]`, `history[21]`); na **Ruas 9%** (UI ao vivo) usa-se **uma** posição na grelha (`criticalHeightSingleGridIndex`), escolhida automaticamente entre as posições **4–12** (`ruas9PctAutoCritical.ts`). No **Números 2,8%** mantém-se **11** e **12** (`history[10]`, `history[11]` — `NUMS_28_PCT_CRITICAL_HEIGHT_GRID_INDICES`). **§5.1.1** (`recentHalfDominanceZone` + `criticalHeightAlertAlignedWithRecentDominance`) **não** altera armamento nem placar — só orienta mensagem / «alerta prioritário». A **continuação** (`isStreetPairTrigger`, metade da indicação, zero a desligar) é a mesma lógica nas três abas. Na variante **2,8%** com **cilindro** (`nums28PctPlacarOutcomesWithCylinderSpinExclusion`), os exclusivos no tapete podem vir de **distâncias** no anel (§7, função com cilindro).

---

## 1. Pressupostos comuns

| Item | Definição |
|------|-----------|
| Roleta | **Europeia**: números **0–36**. |
| Vermelhos | `1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36` — os restantes 1–36 são **pretos**. |
| Metade **Baixo** | 1–18. |
| Metade **Alto** | 19–36. |
| Paridade | **Par** / **Ímpar**; o **0** não tem cor nem metade nem paridade úteis para gatilhos (tratado à parte). |

### Ordem do histórico

- Na **API** e no **estado React** deste projeto, o histórico é guardado com o giro **mais recente no índice 0** (`historyNewestFirst`).
- A **simulação passo a passo** usa frequentemente uma cópia **cronológica** `chronological = reverse(historyNewestFirst)` (índice 0 = mais antigo, último índice = mais recente).
- **Placar agregado (V/D/%):** nas páginas indicadas em [atualizacao-estrategias.md](atualizacao-estrategias.md), a série efectiva é um **recorte** do `historyNewestFirst` à **hora civil local** actual, quando existem **tempos por giro** alinhados ao histórico (`liveTableSpinTimes.*`, `roulette.historySpinTimes.espelho`); ver `sliceNewestFirstHistoryForPlacarLocalHour` em `historyStorage.ts`.

Sempre que implementares, define claramente qual convenção usas e converte uma vez no limite.

---

## 2. Ruas (transversais) no tapete

Cada **rua** (street) é um trio de números consecutivos na grelha do tapete:

| ID da rua | Números |
|-----------|---------|
| 1 | 1, 2, 3 |
| 2 | 4, 5, 6 |
| … | … |
| 12 | 34, 35, 36 |

- `streetIdForNumber(n) = ceil(n/3)` para `n` em 1–36; para **0** → sem rua (`null`).

### Semiciclos (metades em ruas)

- **Ruas só Baixo (1–18):** IDs **1–6**.
- **Ruas só Alto (19–36):** IDs **7–12**.

Para **Ruas 20%** e **Ruas 9%**, o *pool* de exclusões é o semicíclio **oposto** à zona de indicação exterior (transversais com ficha). Na **Ruas 9%** escolhe-se **apenas uma** rua nesse pool pela frieza e perfil dominante. **Números 2,8%:** ver secção 7.

---

## 3. Constantes partilhadas (frieza)

Usadas em **Ruas 9%**, **Ruas 20%** (com `mirrorHeightIndication`) e **Números 2,8%**. A janela efectiva é calculada por **`resolveFriezaWindowNums`** (`streetStrategy.ts`): sufixo cronológico ancorado no **giro mais recente**.

| Constante | Valor | Uso |
|-----------|-------|-----|
| `STREET_STRATEGY_FRIA_WINDOW_INITIAL` | **20** | Comprimento inicial da janela (últimos 20 giros cronológicos) para contar frequências de ruas ou de números. |
| `STREET_STRATEGY_FRIA_WINDOW_STEP` | **5** | Passo ao **ampliar** a janela quando todas as frequências no pool são iguais (empate global de frieza). |
| `STREET_STRATEGY_FRIA_WINDOW_MAX` | **100** | Tecto da janela (nunca ultrapassa o prefixo disponível). |
| `STREET_STRATEGY_FRIA_WINDOW` | **20** | Alias = `INITIAL` (ex.: `pickExclusionDisplayNumbers` por defeito). |
| `STREET_EXCLUSION_RECENT_SPINS` | **12** | Valor **inicial** do “gate”: preferir ruas/números **sem** saída nos últimos N giros (mais recentes primeiro). Se não houver candidatos suficientes no pool, **N desce** até 0. |

**Prioridade dos giros mais recentes:** a janela de frieza é sempre um **sufixo** da timeline (do mais antigo da janela até ao giro actual); ao ampliar, acrescentam-se giros **mais antigos** à esquerda, mantendo-se sempre os 20 (ou mais) **mais recentes** incluídos.

---

## 4. Par de continuação (`isStreetPairTrigger`)

Dois giros consecutivos **non-zero** `(older → newer)` formam par de continuação se cumprirem **pelo menos uma** das condições:

1. **Mesma metade** (Baixo ou Alto) **e mesma cor** (vermelho ou preto).  
2. **Mesma metade** **e mesma paridade** (par ou ímpar).

Se **qualquer** dos dois números for **0**, o par **não** é válido.

**Ficheiro:** `src/lib/roulette/streetStrategy.ts` — `sameHeightSameColor`, `sameHeightSameParity`, `isStreetPairTrigger`.

---

## 5. Gatilho de **altura** nas posições críticas (`evaluateCriticalHeightGatilho`)

Usado pelas abas **Ruas 20%**, **Ruas 9%** e **Números 2,8%** (opção `mirrorHeightIndication` nas Ruas). O parâmetro **principal** do gatilho é a **metade do tapete** (Baixo 1–18 vs Alto 19–36). **Cor** e **paridade** dominantes orientam o critério de frieza (**Ruas 20%** e **Ruas 9%:** semicíclio das transversais com ficha; **Números 2,8%:** cruzamento oposto ao tipo de par — §7): nas Ruas 20% e no 2,8% derivam-se dos **dois** giros do par crítico; na **Ruas 9%** (uma célula), do **único** giro em `criticalHeightSingleGridIndex` (triplo guardado `[n,n,n]`).

### 5.1. Posições e condição

- Histórico **newest-first** (`history[0]` = mais recente).
- **Ruas 20%** (`CRITICAL_HEIGHT_DEFAULT_GRID_INDICES`): posições **11** e **22** — `history[10]`, `history[21]`. Comprimento mínimo **22** giros.
- **Ruas 9%** (`criticalHeightSingleGridIndex` em `SimulateStreetStrategyOptions`, selector em `ruas9PctAutoCritical.ts`): **uma** posição na grelha entre **4** e **12** — `history[3]` … `history[11]`. Comprimento mínimo = índice + 1 (ex.: pos. 4 → **4** giros). Armamento: giro **≠ 0** nessa célula; a **metade** (Baixo/Alto) define a zona; **não** se exige `isStreetPairTrigger` entre duas células.
- **Números 2,8%** (`NUMS_28_PCT_CRITICAL_HEIGHT_GRID_INDICES`): posições **11** e **12** — `history[10]`, `history[11]`. Comprimento mínimo **12** giros.
- **Ruas 20%** e **Números 2,8%:** `evaluateCriticalHeightGatilho` / `evaluateCriticalHeightPairArmed` com `CriticalHeightGatilhoOptions.gridIndices` (implícito `[10,21]` nas Ruas 20%; **2,8%** usa `[10,11]` nas opções da simulação).
- **Ruas 9%:** o mesmo avaliador recebe `CriticalHeightGatilhoOptions.singleGridIndex` (prioridade sobre `gridIndices`).
- **Par clássico (20% e 2,8%):** os dois giros nas células críticas têm de ser **≠ 0** e, em ordem **cronológica** (mais antigo → mais recente), cumprir a mesma regra que o **par de continuação** (`isStreetPairTrigger` em `streetStrategy.ts`): **mesma metade** (Baixo ou Alto) **e** (**mesma cor** **ou** **mesma paridade**). Só metade comum (ex.: 31 e 36 no alto, mas preto vs vermelho e par vs ímpar) **não** arma.

### 5.1.1. Tendência recente da mesa (`recentHalfDominanceZone`)

- Zeros **não** entram na contagem.
- **Dominância de mesa:** ou **não** há metade dominante clara, ou a dominância é a **mesma** metade que a `zone` da indicação. **Regras de janela:** com **≥ 22** giros (newest-first), usa-se **só** a janela dos **22** mais recentes (duas linhas da grelha 11×3): **≥ 10** giros ≠ 0 e margem **≥ +3** numa das metades; assim o alerta não fica só «puxado» pelos últimos 5 quando o recorte maior ainda favorece a outra metade. Com **5 a 21** giros, usa-se **só** a janela dos **5** mais recentes (**≥ 3** ≠ 0, margem **≥ +2**). Com **menos de 5** giros: `null`.
- **Armamento e placar** usam `evaluateCriticalHeightPairArmed` / alias `evaluateCriticalHeightGatilho` (par **ou** `singleGridIndex`). A dominância **não** desarma o gatilho nem altera `liveCriticalTripleSupportsZone`.
- Quando há metade dominante clara **e** difere da `zone` do par crítico, `criticalHeightAlertAlignedWithRecentDominance` fica **falso** — serve para **suprimir alerta prioritário** (texto de log / destaque), **sem** mudar alvo, ruas excluídas nem contagem W/L.
- **Vista curta (5 giros):** entre os 5 mais recentes (newest-first, zeros ignorados), se existirem **pelo menos 2** giros ≠ 0 e a metade da **indicação** (`zone`) estiver em **minoria estrita** (equivalente: **maioria estrita** na metade oposta — ex.: sinal Baixo e 3 Altos em 5), o alerta prioritário também fica **suprimido** (alinhado ao padrão visível na primeira linha da grelha).
- **Dois giros mais recentes na metade do alvo:** `history[0]` e `history[1]` (newest-first) têm de estar **ambos** na metade da `zone` da indicação (qualquer **zero** falha o teste). Integrado em `criticalHeightAlertAlignedWithRecentDominance` (só **alerta prioritário** em logs / mensagens; **não** afecta o tapete: a UI Ruas usa directamente o `active` da simulação).

### 5.2. Zona de indicação e apostas

- `indicationZone` / `active.zone` = metade **comum** aos dois giros (`"1-18"` ou `"19-36"`).
- **Ficha exterior:** nessa mesma metade.
- **Transversais (Ruas)** ou **pool de exclusão (2,8%):** nas Ruas, semicíclio **oposto** à zona exterior; no 2,8%, **cruzamento oposto** (§7), não a «metade oposta» como único critério.

`evaluateCriticalHeightGatilho` é **alias** de `evaluateCriticalHeightPairArmed` (mesmo critério de armamento).

### 5.3. Cor e paridade dominantes

- Entre os **dois** números do par crítico (20% e 2,8%) obtém-se cor e paridade dominantes (com empate 1–1, a implementação repete o giro da célula **mais recente** do par — índice `min(i₀,i₁)` em newest-first — no cálculo interno do «triplo» guardado para compatibilidade). Com **uma** célula (Ruas 9%), o triplo é `[n,n,n]` e a dominância coincide com o próprio giro.

### 5.4. Legado `mirrorWheel` (`computeEspelhoState`)

O módulo `mirrorWheel.ts` com a sequência espelhada (últimos 3 vs 3 opostos na timeline) **já não** determina o armamento destas três abas; mantém-se no código como referência / utilitários (`fullyOppositeNumbers`, etc.).

**Ficheiro do gatilho actual:** `src/lib/roulette/criticalHeightGatilho.ts`.

---

## 6. Ruas 20% e Ruas 9% (`mirrorHeightIndication`)

**Opções:** `SimulateStreetStrategyOptions` com `mirrorHeightIndication: true` (nome histórico da opção; o comportamento é o **gatilho de altura** da §5).

**Importante:** neste modo **não** entra em jogo o **Gatilho 1 clássico** do tapete (triplo consecutivo **A→B→C** com o par **B→C**). O armamento vem das posições críticas da grelha: **par** nas Ruas 20% (**11** e **22**, `criticalHeightGridIndices`) com a mesma regra que a continuação (`isStreetPairTrigger`); na **Ruas 9%**, **uma** posição (`criticalHeightSingleGridIndex`, altura do giro **≠ 0**). A **continuação** após armar segue sempre `isStreetPairTrigger` entre giros consecutivos e a metade da indicação; zero desliga.

| Variante | `exclusionStreetCount` | Onde se escolhem as ruas excluídas |
|----------|------------------------|-------------------------------------|
| **Ruas 20%** | **2** | Semicíclio **oposto** à zona exterior (transversais com ficha); duas ruas por frieza com prioridade a transversais que **não** reproduzem a cor+paridade dominantes dos dois giros críticos (§5.3). |
| **Ruas 9%** | **1** | Semicíclio das **transversais com ficha** (oposto à zona exterior): a rua mais fria **fora** do perfil cor+par dominantes; em empate, `gatilhoTripleFactorOverlapScore` com o **triplo crítico** guardado. |

Nas rotas **`/ruas`**, **`/ruas-10pct`**, **`/numeros-28pct`** e **`/smart-move`**, o visor dos últimos giros usa uma **grelha 11×3** (33 posições; o mais recente no canto superior esquerdo, leitura horizontal por linhas). Componente: `roulette-history-grid-11x3.tsx` — **sem** realce de células por posição crítica na grelha.

### 6.1. Armar

- Quando **não** há indicação ativa: `evaluateCriticalHeightGatilho` com os índices da variante (Ruas 20%: **11** e **22**; Ruas 9%: **uma** posição 4–12 via `criticalHeightSingleGridIndex`; Números 2,8%: **11** e **12**). Depois aplica-se `mirrorConfirmationAlignsWithBetNumbers` com o **mesmo** par de índices da confirmação (Ruas 9% com posição única: índice duplicado `[i,i]`): se **ambos** os giros (não zero) reforçarem a mesma tendência (metade + fila + cor) que a cobertura da aposta, **não** se arma. No **2,8%**, a cobertura da aposta são os números **1–36** excepto os dois exclusivos candidatos.
- **Zona exterior (`zone`):** metade do giro de referência: no **par**, metade **comum** aos dois giros; na **Ruas 9%** (uma célula), metade do giro nessa célula (`"1-18"` ou `"19-36"`).
- **Transversais:** **Ruas 20%:** todas as ruas do semicíclio **oposto** a `zone`, **exceto** as duas escolhidas por frieza (§6.4). **Ruas 9%:** fichas em **todas** as ruas desse semicíclio **exceto** a única escolhida por frieza (§6.4); essa rua «excluída» define **L** no placar se sair.
- **Triplo guardado (compat.):** **par** com índices `[i₀, i₁]` (newest-first, `i₀` mais recente), `gatilhoTriple = [history[i₁], history[i₀], history[i₀]]`; **Ruas 9%** (uma célula em `i`): `gatilhoTriple = [history[i], history[i], history[i]]`. `triggerNewerNumber = history[i₀]` ou `history[i]`; `triggerKind = "ambos"` (Ruas 20%: `i₀=10`, `i₁=21`).

### 6.2. Manter ou desligar a indicação

Com indicação **ativa**, para cada novo giro `num` (processamento cronológico):

1. Se `num === 0` → **derrota no placar** (neste modelo) e **desativa** a indicação.
2. Seja `prev` o giro anterior na ordem cronológica. Se **não** `isStreetPairTrigger(prev, num)` → **desativa**.
3. Se `zone` é Alto e `num` não está em 19–36 → **desativa**. Idem Baixo / 1–18.
4. Com `mirrorHeightIndication`: se `liveCriticalTripleSupportsZone(histAtNewestFirst, zone, opts)` for **falso** — ou seja, o gatilho de altura na(s) célula(s) crítica(s) já **não** devolve a mesma `zone` que a indicação (giros actuais nas posições configuradas: par **ou** uma célula) — → **desativa**.
5. Caso contrário **mantém** e **recalcula** as ruas excluídas (mesma lógica de frieza + perfil dominante derivado de `gatilhoTriple`).

Novos gatilhos **só** podem armar quando **não** existe indicação ativa.

**Ficheiro:** `src/lib/roulette/streetStrategy.ts` — `simulateStreetStrategy`, `buildActiveFromCriticalGatilhoPrefix`, `runChronologicalStreetSimulation`.

### 6.3. Placar (Ruas com gatilho de altura / clássico neste projecto)

Função: `streetStrategyPlacarOutcomesByExcludedStreets` **sem** `winOnlyWhenHitBetStreet`.

Para cada giro `k` cronológico com indicação activa no estado **após** o giro `k-1`:

- **L** se sair **0** **ou** o número pertencer a uma **rua excluída**;
- **D** (empate) na **Ruas 20%** quando `placarBetStreetsAsDraws: true` e o número cai numa **transversal com ficha** (semicíclio apostado, não excluída) — **não** conta como vitória nem derrota; quebra sequência de vitórias no placar.
- **W** para qualquer outro resultado em **1–36** (vitória na caixa exterior da metade indicada, sem cair em rua excluída; não contabiliza giro se não houver indicação activa antes desse giro).

### 6.4. Exclusão de ruas (score + desempate 9%)

**Ruas 20%** e **Ruas 9%:** o *pool* de candidatos é o semicíclio das transversais **com ficha** (oposto à zona exterior). Para cada rua candidata nesse semicíclio:

1. Consideram-se as casas da transversal que **não** têm simultaneamente a cor **e** a paridade dominantes dos giros críticos. O **score** da rua é a **menor** frequência (na janela de frieza) entre essas casas; se as três casas cumprem o perfil dominante, usa-se a menor frequência entre todas as três (fallback).
2. Ordenam-se as ruas por score crescente, depois por ID.
3. Mantém-se o filtro de ausência recente (`STREET_EXCLUSION_RECENT_SPINS`, relaxável via `resolveFriezaWindowNums`).
4. **Ruas 9%:** em empate no score, `pickOneColdestStreetCriticalWithTripleTiebreak` compara `gatilhoTripleFactorOverlapScore` do número “de exibição” da exclusão com o **triplo crítico** (`gatilhoTriple`); menor score vence.

Para **Ruas 20%** escolhem-se as **duas** primeiras ruas na ordenação (com a mesma lógica de elegibilidade recente).

---

## 7. Estratégia **Números 2,8%**

Partilha o **mesmo** gatilho de **altura** que a Ruas 9% nas posições **11** e **12** (`evaluateCriticalHeightGatilho` com `NUMS_28_PCT_CRITICAL_HEIGHT_GRID_INDICES` = `[10,11]`, §5), a **mesma** continuação (`isStreetPairTrigger`, `indicationZone`, zero desliga) e o mesmo critério de **alerta prioritário** (§5.1.1). **Diferença:** o *pool* dos dois exclusivos **não** é a metade oposta com filtro cor+par; é um **cruzamento oposto** ao **tipo de par** nas pos. 11–12 (`streetPairTriggerKind`): **altura+cor** apenas → oposto **cor×metade**; **altura+paridade** apenas → oposto **metade×paridade**; **ambos** → oposto **cor×paridade**. Nesse *pool* escolhem-se os **dois mais frios** (`pickTwoColdestNumbersInPool`, `resolveFriezaWindowNums`). **Confirmação espelho:** `betNums` = todos os **1–36** excepto os dois exclusivos candidatos. **Variante cilindro** (`nums28PctPlacarOutcomesWithCylinderSpinExclusion`): placar com exclusivos por distâncias no anel (§7.9 legado).

**Ficheiro:** `src/lib/roulette/nums28PctStrategy.ts`.

### 7.1. Zonas e estado

- `indicationZone`: metade **comum** aos dois giros críticos (`"1-18"` ou `"19-36"`) — continuação do placar exige giro nessa metade.
- `exclusionCrossKind`: `"cor-altura"` | `"altura-paridade"` | `"cor-paridade"` — fixo no armamento a partir do par `n22`→`n11` (cronológico).
- `criticalTriple`: `[n22, n11, n11]` (compat. triplo §5.3).
- `excludedNumbers`: os dois mais frios no *pool* do cruzamento oposto.

### 7.2. Armar (`buildNums28PctFromCriticalPrefix`)

1. `histAtNewestFirst = reverse(chronological[0..i])`.
2. `critical = evaluateCriticalHeightGatilho(histAtNewestFirst, { gridIndices: NUMS_28_PCT_CRITICAL_HEIGHT_GRID_INDICES })`. Comprimento mínimo **12** giros.
3. `indicationZone = critical.zone`; `exclusionCrossKind` a partir de `streetPairTriggerKind(critical.n22, critical.n11)` (mapeamento: `ambos` → `cor-paridade`; `altura-cor` → `cor-altura`; `altura-paridade` → `altura-paridade`).
4. `pool` = intersecção em 1–36 do cruzamento oposto (`nums28OppositionPool` no código: inverte metade e/ou cor e/ou paridade conforme o caso).
5. Janela de frieza: `resolveFriezaWindowNums` com `mode: "numbers"`, `minEligible: 2`.
6. `excludedNumbers = pickTwoColdestNumbersInPool(...)`.
7. Guarda-se `armingDescription` legível.

Se `mirrorConfirmationAlignsWithBetNumbers(histAtNewestFirst, betNums, [10,11])` com `betNums` = **1–36 \\ exclusivos** → **não** arma.

### 7.3. Escolha dos dois números (`pickTwoColdestNumbersInPool`)

Usada **no armar** e **em cada giro que mantém** a indicação (`recomputeBetNumbers`).

1. O `pool` é sempre o cruzamento oposto fixado em `exclusionCrossKind`; `recomputeBetNumbers` recalcula cor/par dominantes a partir de `active.criticalTriple` e volta a aplicar o mesmo tipo de cruzamento.
2. Obtém-se `windowNums` e `recentCap` com `resolveFriezaWindowNums` (`mode: "numbers"`, `minEligible: 2`).
3. `freq(n)` = frequências na `windowNums` (`numberFrequenciesInFriezaWindow`).
4. `eligible` = números do `pool` que **não** aparecem nos últimos **`recentCap`** giros de `historyNewestFirst` (o `recentCap` pode ser menor que 12 se for preciso ter dois candidatos).
5. Se `|eligible| >= 2`, trabalha-se com `eligible`; senão usa-se o **pool completo** passado à função.
6. Ordenação: menor `freq`; se empate e forem passados `chronological` + `beforeChronoExclusive`, desempate pela **última saída mais antiga** (menor índice cronológico da última ocorrência antes do corte; `-1` = nunca saiu, trata-se como mais antigo); depois **menor número**.
7. Os dois primeiros da lista ordenada são `excludedNumbers[0]` e `[1]`.

**Nota:** Não há desempate “overlap com triplo” como nas Ruas 9%; só frieza + preferência de ausência recente dentro do pool de oposição.

### 7.4. Simulação cronológica (`runNums28PctChronological`)

Percorre-se `chronological` do índice `0` ao `n-1`. Mantém-se `active: Nums28PctActive | null`.

**Se `active` é `null` (não armado):**

- Tenta `buildNums28PctFromCriticalPrefix(chronological, i)`. Se devolver candidato e o filtro de confirmação **não** suprimir, `active` passa a esse estado.

**Se `active` está armado** e o giro actual é `num`:

1. Se `num === 0` → `active = null` (zero desactiva).
2. Se `i < 1` → `active = null` (defensivo).
3. Seja `prev = chronological[i-1]`. Se **não** `isStreetPairTrigger(prev, num)` → `active = null`.
4. Se `indicationZone === "19-36"` e `heightOf(num) !== "Alto"` → `active = null`.
5. Se `indicationZone === "1-18"` e `heightOf(num) !== "Baixo"` → `active = null`.
6. Caso contrário: `active = recomputeBetNumbers(...)` — recalcula `excludedNumbers` com a janela de frieza até a este giro (os dois “mais frios” podem mudar).
7. Se `liveCriticalTripleSupportsZone(histAtNewestFirst, active.indicationZone, { gridIndices: NUMS_28_PCT_CRITICAL_HEIGHT_GRID_INDICES })` for **falso** → `active = null`.

Enquanto `active` não for `null`, **novos** gatilhos de altura no mesmo histórico **não** rearmam (igual às Ruas).

### 7.5. Semântica no tapete (neste produto)

- Os dois valores em `excludedNumbers` são tratados como **“vagos” / excluídos** na UI (sem ficha; estilo diferenciado).
- O **restante** dos números **1–36** aparece como zona de **cobertura** (realce verde no cliente — `nums-28pct-table.tsx`).

### 7.6. Placar (2,8%)

Função: `nums28PctPlacarOutcomes(historyNewestFirst, options?)`. O segundo argumento opcional pode incluir `exclusionTieBreak: "legacy" | "recency"` (omisso = **`recency`**, alinhado à UI e à simulação).

Para cada par consecutivo na ordem cronológica `(estado_antes_do_giro_k → número_sorteado_k)`:

- Usa-se o snapshot `activeAfterPrefix[k-1]` da simulação (estado **após** processar o giro `k-1`, alinhado a `nums28PctActiveAfterEachChronologicalPrefix`).
- Se não havia indicação activa, o giro **não** entra no placar.
- **L** só se o resultado for **igual** a `excludedNumbers[0]` **ou** `excludedNumbers[1]` (o **zero** nunca é um dos exclusivos nesta estratégia, logo conta como **W**).
- **W** em qualquer outro caso (inclui **0** e qualquer **1–36** fora dos dois exclusivos).

Ou seja: derrota apenas nos dois “buracos” escolhidos; o zero não é buraco → vitória no placar quando sai zero.

**Comparar `legacy` vs `recency` no teu histórico:** `npm run measure:nums28 -- caminho/para/export.json` (array JSON newest-first, p.ex. o valor guardado em `roulette.history.espelho`). O script imprime resumo JSON com `divergentWL` (giros de placar em que W/L difere) e deltas de vitóras / %.

### 7.7. Estado activo ao fim do histórico

- `simulateNums28PctStrategy(historyNewestFirst).active` — percorre toda a linha do tempo e devolve a indicação **após** o último giro, ou `null` se no fim estiver desactivada (par quebrado, fora da metade, zero, etc.).
- Para **alinhar o “momento”** com as abas Ruas 20% / 9% na mesma app, usa-se o **mesmo** histórico (`ROULETTE_MIRROR_HISTORY_SCOPE`, ver §9).

### 7.8. Funções exportadas úteis (API de integração)

| Função | Uso |
|--------|-----|
| `evaluateCriticalHeightPairArmed` / `evaluateCriticalHeightGatilho` (alias) | Par crítico válido (altura + cor/par) — partilhado com Ruas; armamento **sem** filtro de dominância. |
| `criticalHeightAlertAlignedWithRecentDominance` | `true` quando convém alerta prioritário: par crítico válido, **últimos 2 giros** na metade do alvo (`lastTwoSpinsInIndicationHalf`), dominância (§5.1.1: **22** giros se `length ≥ 22`, senão **5**) **não** contraria a `zone`, **e** a `zone` **não** está em minoria estrita nos últimos **5** giros ≠0; não afecta placar. |
| `lastTwoSpinsInIndicationHalf` | Os dois giros mais recentes (≠0) caem na metade `zone` — condição do **alerta prioritário** (`criticalHeightAlertAlignedWithRecentDominance`); não afecta placar nem o tapete Ruas. |
| `recentShortWindowHalfCounts` | Conta giros ≠0 na metade do alvo vs oposta nos últimos 5 (UI / diagnóstico). |
| `recentShortWindowIndicationHalfInMinority` | Minoria estrita da `zone` nos últimos 5 giros ≠ 0 (só aviso). Alias legível: `recentShortWindowMajorityOpposesHalf`. |
| `buildNums28PctFromCriticalPrefix(chrono, i)` | Estado teórico se armássemos **só** com o prefixo até `i` (útil para debug). |
| `simulateNums28PctStrategy` | Estado final + log resumido. |
| `nums28PctActiveAfterEachChronologicalPrefix` | Série de estados por índice (placar). |
| `nums28PctPlacarOutcomes` / `nums28PctPlacarEvolutionSeries` | Placar e evolução; opcional `{ exclusionTieBreak }` para comparar desempates dos dois exclusivos. |
| `nums28PctActiveFromMirrorSnapshot` | Nome histórico: avalia **só** o fim do histórico com gatilho de altura + frieza + filtro de confirmação, **sem** exigir continuação activa — **não** reproduz o mesmo “momento” que a simulação cronológica alinhada às Ruas; na UI actual o sinal segue `simulateNums28PctStrategy().active`. |

---

## 8. Calculadora na rota `/` (cilindro) — **lógica diferente**

**Não** usa `mirrorHeightIndication` nem o gatilho de altura das abas Ruas 9% / 20% / 2,8%.

- O **gatilho** das ruas segue a simulação **clássica** (`simulateStreetStrategy` **sem** `mirrorHeightIndication`): ver comentários em `streetStrategy.ts` (Gatilho 1 com A→B→C ou variante `gatilho1PairOnly` conforme opções).
- O **placar / exclusões** na calculadora usam **vizinhos no cilindro físico europeu** do último giro (`cylinderNeighborPair` em `src/lib/roulette/cylinderIndication.ts`), com ordem fixa `EUROPEAN_WHEEL_PHYSICAL`.

Para reproduzir só as abas **Ruas 9% / 20% / 2,8%**, **ignora** esta secção.

---

## 9. Sincronização de histórico nesta app

As rotas **Ruas 20%**, **Ruas 9%** e **Números 2,8%** leem e gravam o mesmo scope **`espelho`** (`ROULETTE_MIRROR_HISTORY_SCOPE` em `historyStorage.ts`), para que o mesmo fluxo de giros alimente as três lógicas e o **sinal** (armado / desarmado) coincida no tempo.

- **Primeira execução:** se a chave `roulette.history.espelho` ainda **não existir** em `localStorage`, o `readRouletteHistory("espelho")` tenta **semente** a partir do histórico **mais longo** entre as chaves legadas `ruas10pct`, `ruas` e `nums28pct` (migração suave).
- **SSE / giro ao vivo:** `applyLiveSpinFromSse` continua a acrescentar o número a **todos** os membros de `ALL_ROULETTE_HISTORY_SCOPES` (inclui `espelho`, `calculator`, e as chaves legadas), e dispara `scope: "all"` no evento customizado.

Para reproduzir noutro sistema: **uma única fila de giros** partilhada + as mesmas funções de simulação por giro.

---

## 10. Mapa rápido ficheiros → responsabilidade

| Ficheiro | Conteúdo |
|----------|----------|
| `src/lib/roulette/criticalHeightGatilho.ts` | Gatilho de altura: `evaluateCriticalHeightPairArmed`, alias `evaluateCriticalHeightGatilho`, `liveCriticalTripleSupportsZone`, `recentHalfDominanceZone`, `lastTwoSpinsInIndicationHalf`, `recentShortWindowHalfCounts`, `recentShortWindowIndicationHalfInMinority` / `recentShortWindowMajorityOpposesHalf`, `criticalHeightAlertAlignedWithRecentDominance` (Ruas `[10, 21]`; 2,8% `[0, 1]`). |
| `src/lib/roulette/mirrorConfirmationColumn.ts` | Suprimir alerta quando **ambos** os giros nos índices passados (Ruas `[10,21]`; 2,8% `[0,1]`) reforçam metade + fila + cor da cobertura. |
| `src/lib/roulette/streetStrategy.ts` | Ruas, par, simulação, placar ruas, `mirrorHeightIndication` + exclusões por frieza, **`resolveFriezaWindowNums`**, `numberFrequenciesInFriezaWindow`. |
| `src/lib/roulette/nums28PctStrategy.ts` | Números 2,8%: armação, continuação, exclusão fria, placar. |
| `src/lib/roulette/cylinderIndication.ts` | Cilindro europeu e vizinhos (calculadora `/`). |
| `src/lib/roulette/mirrorWheel.ts` | Legado: `computeEspelhoState` já **não** arma as três abas; utilitários (`fullyOppositeNumbers`, etc.). |
| `src/lib/roulette/historyStorage.ts` | Chaves localStorage e scope `espelho`. |
| `src/components/nums-28pct-table.tsx` | Tapete 2,8%: dois exclusivos + cobertura verde no restante de 1–36. |
| `src/components/roulette-history-grid-11x3.tsx` | Visor 11×3 dos últimos 33 giros (sem realce por posição crítica na grelha). |

---

*Documento gerado com base no código do repositório; se alterares regras no código, actualiza este ficheiro em conjunto e, para mudanças de comportamento relevantes, acrescenta uma entrada em [atualizacao-estrategias.md](atualizacao-estrategias.md).*
