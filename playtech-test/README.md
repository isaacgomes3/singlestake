# Teste isolado — Playtech + lógica Um Fator

Este módulo é **separado** da app Singlestake (iframe, DGA Pragmatic, sala rotativa integrada).

## O teu sistema original (painel da imagem)

O painel Playtech que já tens faz **tudo isto sozinho**:

| Função | Onde |
|--------|------|
| Varredura do lobby Playtech | Sistema original |
| Seleção de mesas (ROLETAS) | Checkboxes no painel |
| Placar WIN / LOSS | PLACAR + RESET |
| Entrada **simulada** (sem clicar na mesa) | Motor do painel |
| Exportar / importar config | EXPORTAR CONFIG / IMPORTAR CONFIG |

**Não vamos recriar este painel na app Singlestake.** A app DGA fica intacta.

O que guardámos aqui é só o **cérebro da estratégia Um Fator** (gatilho → confirmação → entrada → gale / rodízio), para validares com o **mesmo histórico Playtech** que o teu scanner já lê.

```
┌─────────────────────────────┐     export JSON      ┌──────────────────────────┐
│  Teu painel Playtech        │ ──────────────────►  │  playtech-test/ (CLI)    │
│  · varredura lobby          │   mesas + sequências │  · umFatorStrategy       │
│  · roletas activas          │                      │  · rotatingUmFatorHarness│
│  · entrada simulada + placar│                      │  · placar / sinais       │
└─────────────────────────────┘                      └──────────────────────────┘
         ▲                                                      │
         │              integração futura (depois do teste)      │
         └──────────────────────────────────────────────────────┘
```

## Dois sistemas — não misturar

| | **App Singlestake** | **Teu painel + playtech-test** |
|---|---------------------|--------------------------------|
| Origem dos números | API DGA Pragmatic | Scanner Playtech |
| IDs de mesa | DGA (206, 227…) | Chaves/nomes do lobby Playtech |
| UI | Cassino, iframe, back office | Painel lateral + CLI de teste |
| Entradas | Automação simulada (banca) | Entrada simulada no painel |
| Extensão Chrome | Desligada até integração | Opcional depois de validar |

A app **não muda** a estrutura DGA. Aqui só reutilizamos a **lógica pura**:

- Gatilho e confirmação → `src/lib/roulette/umFatorStrategy.ts`
- Rodízio + recuperação → `src/lib/roulette/rotatingUmFatorSimHarness.ts`

## Formato do feed Playtech

Exporta do teu sistema (ou combina **IMPORTAR CONFIG** + dump de sequências) para JSON assim:

```json
{
  "source": "playtech",
  "tables": [
    { "id": 1, "key": "roleta_brasileira", "label": "Roleta Brasileira" },
    { "id": 2, "key": "mega_fire_blaze", "label": "Mega Fire Blaze Roulette Live" }
  ],
  "events": [
    { "tableId": 1, "number": 16, "at": "2026-06-24T12:00:00Z" },
    { "tableId": 2, "number": 14, "at": "2026-06-24T12:00:30Z" }
  ]
}
```

- `tables` = mesas **marcadas** no painel (ROLETAS)
- `events` = giros cronológicos lidos pela varredura
- `number` = 0–36 (roleta europeia)
- **Não** uses IDs DGA — são só para o motor de teste

Se o teu **EXPORTAR CONFIG** tiver outro formato, envia um ficheiro de exemplo: adaptamos o `feedAdapter.ts` sem tocar na app.

## Só tens o ficheiro `.prime`?

O `.prime` é **encriptado** — sem o código do bot não há decode offline.

Fluxo com o teu `backup_bot_24-6.prime`:

```
IMPORTAR CONFIG (painel)  →  capture-after-import.js (F12)  →  playtech:export  →  playtech:sim
```

1. Painel Playtech → **IMPORTAR CONFIG** → `backup_bot_24-6.prime`
2. Espera carregar (roletas + placar)
3. F12 → Consola → cola **`playtech-test/capture-after-import.js`**
4. Descarrega o JSON e corre:

```bash
npm run playtech:export -- C:\Users\PC\Downloads\playtech-after-import-....json
npm run playtech:sim -- playtech-test\exports\feed-....json
```

Analisar o .prime (só metadados):

```bash
npm run playtech:import-prime -- C:\Users\PC\Downloads\backup_bot_24-6.prime
```

### Opção A — EXPORTAR CONFIG no teu painel (recomendado)

1. No painel lateral: **EXPORTAR CONFIG** (guarda `.json`)
2. No terminal, na pasta do projeto:

```bash
npm run playtech:export -- C:\caminho\para\export.json
```

3. Simular com o feed normalizado:

```bash
npm run playtech:sim -- playtech-test/exports/feed-....json
```

O comando `playtech:export` detecta automaticamente estes formatos:

| Formato | Exemplo |
|---------|---------|
| Feed já normalizado | `{ "source": "playtech", "tables": [], "events": [] }` |
| Mapa de histórico | `{ "historico": { "Roleta Brasileira": [32,5,17] }, "roletas": [...] }` |
| Lista de mesas | `{ "mesas": [{ "nome": "...", "ativa": true, "numeros": [32,5] }] }` |
| Lista de eventos | `[{ "mesa": "...", "numero": 32, "at": "..." }]` |

Fixture de exemplo (formato painel): `playtech-test/fixtures/panel-export-example.json`

### Opção B — Captura pelo browser (consola F12)

1. Abre o site com o painel Playtech activo
2. F12 → Consola → cola o conteúdo de `playtech-test/browser-capture.js`
3. Descarrega `playtech-capture-....json`
4. Normaliza e simula:

```bash
npm run playtech:export -- C:\Users\PC\Downloads\playtech-capture-....json
npm run playtech:sim -- playtech-test/exports/feed-....json
```

### Opção C — Pipe (colar JSON)

```bash
type export.json | npm run playtech:export -- -
```

Saída por defeito: `playtech-test/exports/feed-<data>.json`

## Extensão Chrome (teste prático Demo / Real)

Instalação:

```bash
npm run extension:copy-desktop
```

Depois: `chrome://extensions` → Modo programador → Carregar → `Desktop\singlestake-extension`

| Modo | Comportamento |
|------|---------------|
| **Demo** (D) | Só destaca botão na mesa |
| **Real** (R) | Clique real na aposta |

Ver `extension/LEIA-ME.txt` e `playtech-test/panel-signal-example.js` para ligar o painel Playtech.

## Comandos

```bash
# Simular estratégia com feed Playtech
npm run playtech:sim

# Com o teu ficheiro exportado pelo scanner / painel
npx tsx playtech-test/run-sim.ts caminho/para/playtech-export.json

# Ver payload que *um dia* iria à extensão (sem abrir a app)
npm run playtech:extension-payload
```

## Integração futura

1. Validar placar e sinais neste módulo com histórico real do painel  
2. Comparar com o placar simulado do painel (WIN 17 × 0 LOSS, etc.)  
3. Só então ligar a lógica Um Fator ao feed ao vivo **ou** à extensão na app principal
