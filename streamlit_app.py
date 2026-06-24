import pandas as pd
import streamlit as st


# Configuracao da Roleta Europeia (Cilindro)
ROULETTE_WHEEL = [
    0,
    32,
    15,
    19,
    4,
    21,
    2,
    25,
    17,
    34,
    6,
    27,
    13,
    36,
    11,
    30,
    8,
    23,
    10,
    5,
    24,
    16,
    33,
    1,
    20,
    14,
    31,
    9,
    22,
    18,
    29,
    7,
    28,
    12,
    35,
    3,
    26,
]

# Setores da Roleta
VOISINS = [22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25]
TIER = [5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3]
ORPHELS = [1, 20, 14, 31, 9, 17, 34, 6]

RED_NUMBERS = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}
BLACK_NUMBERS = {2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35}
SECTOR_GROUPS = {
    "Voisins": VOISINS,
    "Tier": TIER,
    "Orphelins": ORPHELS,
}
WHEEL_INDEX = {number: index for index, number in enumerate(ROULETTE_WHEEL)}


def cor_numero(numero):
    if numero in RED_NUMBERS:
        return "Vermelho"
    if numero in BLACK_NUMBERS:
        return "Preto"
    return "Zero"


def paridade_numero(numero):
    if numero == 0:
        return "Zero"
    return "Par" if numero % 2 == 0 else "Impar"


def altura_numero(numero):
    if numero == 0:
        return "Zero"
    return "Baixo" if numero <= 18 else "Alto"


def distancia_no_cilindro(origem, destino):
    distancia = abs(WHEEL_INDEX[origem] - WHEEL_INDEX[destino])
    return min(distancia, len(ROULETTE_WHEEL) - distancia)


def distancia_minima_zona(numero, historico, janela):
    giros_recentes = historico[: min(janela, len(historico))]

    if not giros_recentes:
        return 0

    return min(distancia_no_cilindro(numero, giro) for giro in giros_recentes)


def contar_sequencia_atual(historico, classificador):
    if not historico:
        return "Sem historico", 0

    caracteristica = classificador(historico[0])
    tamanho = 0

    for numero in historico:
        if classificador(numero) != caracteristica:
            break
        tamanho += 1

    return caracteristica, tamanho


def tem_caracteristica_bloqueada(numero, bloqueios):
    return (
        cor_numero(numero) == bloqueios.get("Cor")
        or paridade_numero(numero) == bloqueios.get("Paridade")
        or altura_numero(numero) == bloqueios.get("Altura")
    )


st.set_page_config(
    page_title="Calculadora de Exclusao - Roleta",
    page_icon="🎰",
    layout="centered",
)

st.title("🎰 Calculadora de Exclusao (Lay)")
st.subheader("Insira as ultimas rodadas para identificar o vacuo de repeticao")

# Inicializar o historico na sessao do usuario
if "historico" not in st.session_state:
    st.session_state.historico = []
if "vitorias_indicacao" not in st.session_state:
    st.session_state.vitorias_indicacao = 0
if "derrotas_indicacao" not in st.session_state:
    st.session_state.derrotas_indicacao = 0
if "ultima_indicacao" not in st.session_state:
    st.session_state.ultima_indicacao = []
if "ultimo_resultado_indicacao" not in st.session_state:
    st.session_state.ultimo_resultado_indicacao = None

st.sidebar.header("Ajustes da Analise")
limite_sequencia = st.sidebar.slider(
    "Sequencia minima para evitar uma caracteristica",
    min_value=2,
    max_value=5,
    value=3,
)
janela_vacuo_cilindro = st.sidebar.slider(
    "Janela do vacuo de zona no cilindro",
    min_value=12,
    max_value=75,
    value=50,
)

# Interface de Entrada
col1, col2 = st.columns([2, 1])

with col1:
    novo_numero = st.number_input(
        "Insira o ultimo numero sorteado:",
        min_value=0,
        max_value=36,
        step=1,
        key="input_num",
    )

with col2:
    st.write("##")
    if st.button("Adicionar Rodada", use_container_width=True):
        numero_sorteado = int(novo_numero)
        indicacao_anterior = st.session_state.ultima_indicacao

        if indicacao_anterior:
            if numero_sorteado in indicacao_anterior:
                st.session_state.derrotas_indicacao += 1
                st.session_state.ultimo_resultado_indicacao = (
                    f"Derrota: saiu {numero_sorteado}, que estava indicado para exclusao."
                )
            else:
                st.session_state.vitorias_indicacao += 1
                st.session_state.ultimo_resultado_indicacao = (
                    f"Vitoria: saiu {numero_sorteado}, fora da indicacao {indicacao_anterior}."
                )

        # Adiciona no inicio da lista para simular o painel do cassino.
        st.session_state.historico.insert(0, numero_sorteado)

# Botao para resetar o painel
if st.sidebar.button("Limpar Historico"):
    st.session_state.historico = []
    st.session_state.vitorias_indicacao = 0
    st.session_state.derrotas_indicacao = 0
    st.session_state.ultima_indicacao = []
    st.session_state.ultimo_resultado_indicacao = None
    st.rerun()

total_rodadas = len(st.session_state.historico)
total_avaliacoes = st.session_state.vitorias_indicacao + st.session_state.derrotas_indicacao
aproveitamento = (
    (st.session_state.vitorias_indicacao / total_avaliacoes) * 100
    if total_avaliacoes
    else 0
)

st.markdown("### Placar da Indicacao")
col_score1, col_score2, col_score3, col_score4 = st.columns(4)
col_score1.metric("Rodadas Inseridas", total_rodadas)
col_score2.metric("Vitorias", st.session_state.vitorias_indicacao)
col_score3.metric("Derrotas", st.session_state.derrotas_indicacao)
col_score4.metric("Aproveitamento", f"{aproveitamento:.1f}%")

if st.session_state.ultimo_resultado_indicacao:
    if st.session_state.ultimo_resultado_indicacao.startswith("Vitoria"):
        st.success(st.session_state.ultimo_resultado_indicacao)
    else:
        st.error(st.session_state.ultimo_resultado_indicacao)

# Mostrar o painel de numeros inseridos
if st.session_state.historico:
    st.write("### Painel de Resultados Recentes:")
    st.code(" ➔ ".join(map(str, st.session_state.historico[:12])), language="text")

    # --- LOGICA DE ANALISE PREDITIVA ---
    # Contagem de frequencia global no historico atual
    freq = {num: st.session_state.historico.count(num) for num in ROULETTE_WHEEL}
    maior_freq = max(freq.values()) if freq else 0
    ultimo_giro = st.session_state.historico[0]

    # Identificar o setor mais ativo recentemente (ultimas 5 bolas)
    ultimas_bolas = st.session_state.historico[:5]
    setores_ativos = {"Voisins": 0, "Tier": 0, "Orphelins": 0}

    for bola in ultimas_bolas:
        if bola in VOISINS:
            setores_ativos["Voisins"] += 1
        if bola in TIER:
            setores_ativos["Tier"] += 1
        if bola in ORPHELS:
            setores_ativos["Orphelins"] += 1

    # Setor que esta saindo menos (vacuo)
    setor_frio = min(setores_ativos, key=setores_ativos.get)

    sequencias = {
        "Cor": contar_sequencia_atual(st.session_state.historico, cor_numero),
        "Paridade": contar_sequencia_atual(st.session_state.historico, paridade_numero),
        "Altura": contar_sequencia_atual(st.session_state.historico, altura_numero),
    }
    bloqueios = {
        nome: valor
        for nome, (valor, tamanho) in sequencias.items()
        if valor != "Zero" and tamanho >= limite_sequencia
    }

    # Filtrar candidatos para exclusao: nao sairam nas ultimas 15 rodadas.
    recentes_15 = set(st.session_state.historico[:15])
    candidatos = [num for num in ROULETTE_WHEEL if num not in recentes_15]

    # Se nao houver candidatos suficientes sem sair, pega os de menor frequencia geral.
    if len(candidatos) < 2:
        candidatos = sorted(ROULETTE_WHEEL, key=lambda x: freq[x])

    numeros_permitidos = [
        numero
        for numero in ROULETTE_WHEEL
        if not tem_caracteristica_bloqueada(numero, bloqueios)
    ]
    base_ranqueamento = numeros_permitidos if len(numeros_permitidos) >= 2 else ROULETTE_WHEEL

    def pontuar_numero(numero):
        vacuo_zona = distancia_minima_zona(
            numero,
            st.session_state.historico,
            janela_vacuo_cilindro,
        )
        pontos = vacuo_zona * 100

        # Desempate leve: entre zonas igualmente vazias, prefere menor frequencia.
        pontos += (maior_freq - freq[numero]) * 2

        if tem_caracteristica_bloqueada(numero, bloqueios):
            pontos -= 35

        d_ultimo = distancia_no_cilindro(ultimo_giro, numero)
        if 0 < d_ultimo <= 3:
            pontos -= (4 - d_ultimo) * 28

        if (
            numero != 0
            and ultimo_giro != 0
            and cor_numero(numero) == cor_numero(ultimo_giro)
            and altura_numero(numero) == altura_numero(ultimo_giro)
        ):
            pontos -= 72

        return pontos

    ranking = sorted(base_ranqueamento, key=pontuar_numero, reverse=True)
    indicados = ranking[:2]
    st.session_state.ultima_indicacao = indicados.copy()

    analise_candidatos = []
    for numero in sorted(ROULETTE_WHEEL, key=pontuar_numero, reverse=True):
        analise_candidatos.append(
            {
                "Numero": numero,
                "Score": pontuar_numero(numero),
                "Vacuo de Zona": distancia_minima_zona(
                    numero,
                    st.session_state.historico,
                    janela_vacuo_cilindro,
                ),
                "Distancia do Ultimo Giro": distancia_no_cilindro(ultimo_giro, numero),
                "Aparicoes": freq[numero],
                "Fora das Ultimas 15": "Sim" if numero not in recentes_15 else "Nao",
                "Setor Frio": "Sim" if numero in SECTOR_GROUPS[setor_frio] else "Nao",
                "Cor": cor_numero(numero),
                "Paridade": paridade_numero(numero),
                "Altura": altura_numero(numero),
                "Evita Sequencia": "Sim"
                if tem_caracteristica_bloqueada(numero, bloqueios)
                else "Nao",
            }
        )

    # --- PAINEL DE INDICACAO ---
    st.markdown("---")
    st.markdown("### 🎯 INDICACAO PARA DEIXAR DE COBRIR:")

    col_ind1, col_ind2 = st.columns(2)
    with col_ind1:
        distancia_1 = distancia_no_cilindro(ultimo_giro, indicados[0])
        vacuo_1 = distancia_minima_zona(
            indicados[0],
            st.session_state.historico,
            janela_vacuo_cilindro,
        )
        st.metric(label="Numero Exclusao 1", value=f"🚫 {indicados[0]}")
        st.caption(
            f"Vacuo zona: {vacuo_1} casas | Distancia ultimo: {distancia_1} casas | "
            f"{cor_numero(indicados[0])}, "
            f"{paridade_numero(indicados[0])}, {altura_numero(indicados[0])}"
        )
    with col_ind2:
        distancia_2 = distancia_no_cilindro(ultimo_giro, indicados[1])
        vacuo_2 = distancia_minima_zona(
            indicados[1],
            st.session_state.historico,
            janela_vacuo_cilindro,
        )
        st.metric(label="Numero Exclusao 2", value=f"🚫 {indicados[1]}")
        st.caption(
            f"Vacuo zona: {vacuo_2} casas | Distancia ultimo: {distancia_2} casas | "
            f"{cor_numero(indicados[1])}, "
            f"{paridade_numero(indicados[1])}, {altura_numero(indicados[1])}"
        )

    bloqueios_texto = (
        ", ".join(f"{nome}: {valor}" for nome, valor in bloqueios.items())
        if bloqueios
        else "nenhuma caracteristica bloqueada"
    )
    st.info(
        f"💡 Analise de Tendencia: O setor {setor_frio} esta mostrando menor "
        f"forca de tracao nas ultimas 5 rodadas. Ultimo giro: {ultimo_giro}. "
        "A escolha agora prioriza o vacuo de zona no cilindro: numeros cuja "
        f"regiao ficou mais distante dos ultimos {janela_vacuo_cilindro} giros. "
        f"Sequencias evitadas: {bloqueios_texto}."
    )

    # Tabela auxiliar de frequencia
    with st.expander("Ver Sequencias Atuais"):
        df_sequencias = pd.DataFrame(
            [
                {
                    "Caracteristica": nome,
                    "Valor Atual": valor,
                    "Tamanho da Sequencia": tamanho,
                    "Bloqueada": "Sim" if nome in bloqueios else "Nao",
                }
                for nome, (valor, tamanho) in sequencias.items()
            ]
        )
        st.dataframe(df_sequencias, hide_index=True)

    with st.expander("Ver Ranking Completo da Analise"):
        st.dataframe(pd.DataFrame(analise_candidatos).head(12), hide_index=True)

    with st.expander("Ver Analise Completa de Frequencia"):
        df_freq = pd.DataFrame(
            list(freq.items()),
            columns=["Numero", "Aparicoes"],
        ).sort_values(by="Aparicoes", ascending=False)
        st.dataframe(df_freq.head(10), hide_index=True)
else:
    st.info("Insira os numeros das rodadas acima para comecar a gerar as indicacoes.")
