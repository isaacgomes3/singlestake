export type DamasOwner = 0 | 1;

export type Pos = { r: number; c: number };

export type DamasPiece = { owner: DamasOwner; king: boolean };

/** 8×8; células (r+c)%2===0 ignoradas (null). Nas escuras: null = vazio. */
export type DamasBoard = (DamasPiece | null)[][];

export type DamasMove = {
  from: Pos;
  to: Pos;
  /** Casas onde removemos peça adversária (saltos). */
  jumped: Pos[];
};

export type DamasPublicState = {
  roomId: string;
  /** Quem pediu o estado (0 = vermelhas topo, 1 = brancas fundo). */
  seat: DamasOwner | null;
  hostName: string;
  guestName: string | null;
  board: DamasBoard;
  turn: DamasOwner;
  winner: DamasOwner | "draw" | null;
  /** Se não null, só esta peça pode jogar e só capturas. */
  mustContinueFrom: Pos | null;
  version: number;
  /** Sala ainda sem anfitrião (só salas fixas do lobby). */
  lobbyEmpty?: boolean;
};

/** Resumo público para cartões do lobby (sem segredos). */
export type DamasLobbySlotSnapshot =
  | {
      kind: "slot";
      roomId: string;
      label: string;
      playerCount: 0 | 1 | 2;
      /** Texto curto para o rodapé da carta. */
      footerStatus: "Vazia" | "Aguardando jogador" | "Em jogo" | "Partida terminada";
      hostName: string | null;
      guestName: string | null;
      version: number;
    }
  | {
      kind: "vip";
      roomId: string;
      label: string;
      footerStatus: "Programado — em breve";
    };
