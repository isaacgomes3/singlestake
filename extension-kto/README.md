# stake37 — Extensão KTO

Extensão Chrome **independente** da extensão br4. Estratégia **2 Fatores · cruzamento sequencial** na Brazilian Roulette (mesa 237) do site KTO.

## Instalação

1. Compile o motor: `npm run extension:kto:build`
2. Abra `chrome://extensions`
3. Active «Modo de programador»
4. «Carregar sem compactação» → seleccione a pasta `extension-kto/`

## Uso

1. Abra [roleta ao vivo KTO](https://www.kto.bet.br/app/cassino/game/roleta-ao-vivo/) e aguarde o jogo carregar
2. Calibre as apostas (Par, Ímpar, cor, altura, Repetir/Dobrar) no popup ou use o painel flutuante no site
3. Escolha **Demo** ou **Real** no popup ou no painel
4. Clique **Ligar** para activar a estratégia

## Notas

- A extensão br4 (`extension/`) **não** é alterada por esta pasta
- Em modo Real, feche o DevTools na aba da roleta (o CDP precisa do debugger)
- Se o DGA não ligar, ajuste o **Casino ID** na configuração avançada do popup
