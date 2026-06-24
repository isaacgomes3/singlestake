import {
  ProfileIconAvatar,
  ProfileIconGallery,
  readProfileIconId,
  type ProfileIconId,
} from "@/components/profile-icon-gallery";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ChevronRight,
  Crown,
  Dice6,
  FileText,
  FolderOpen,
  History,
  Pencil,
  PiggyBank,
  Shield,
  SlidersHorizontal,
  Trophy,
} from "lucide-react";
import { useEffect, useState } from "react";

type MinhaContaPanelProps = {
  open: boolean;
  onClose: () => void;
};

/** Dados de demonstração (sem API). */
const DEMO = {
  username: "isaacgomes31815",
  rankLabel: "Ouro",
  xp: "61.794,92",
  wins: "1.436",
  bets: "2.013",
  wagered: "R$ 62 mil",
  balance: "R$ 347,45",
} as const;

function MenuRow({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-white transition hover:bg-white/5"
    >
      <Icon className="h-4 w-4 shrink-0 text-cyan-400" aria-hidden />
      <span className="min-w-0 flex-1">{label}</span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
    </button>
  );
}

export function MinhaContaPanel({ open, onClose }: MinhaContaPanelProps) {
  const [profileIconId, setProfileIconId] = useState<ProfileIconId>(() => readProfileIconId());
  const [iconGalleryOpen, setIconGalleryOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (open) setProfileIconId(readProfileIconId());
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
        aria-label="Fechar painel"
        onClick={onClose}
      />
      <div
        className="animate-in slide-in-from-right fade-in duration-300 relative ml-auto flex h-full max-h-[100dvh] w-full max-w-[min(100%,20rem)] flex-col bg-[#0b1224] shadow-2xl sm:max-w-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="minha-conta-titulo"
      >
        <ProfileIconGallery
          open={iconGalleryOpen}
          onClose={() => setIconGalleryOpen(false)}
          value={profileIconId}
          onChange={setProfileIconId}
        />
        <header className="flex shrink-0 items-center gap-2 border-b border-white/5 bg-[#0b1224] px-3 py-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white transition hover:bg-white/10"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 id="minha-conta-titulo" className="flex-1 text-center text-sm font-bold text-white">
            Minha conta
          </h1>
          <span className="w-8" aria-hidden />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 pt-2">
          <div className="rounded-xl border border-white/5 bg-[#161d31] p-3 shadow-inner">
            <div className="relative mx-auto w-fit">
              <ProfileIconAvatar id={profileIconId} size="lg" />
              <button
                type="button"
                className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#161d31] bg-cyan-500 text-slate-950 shadow transition hover:bg-cyan-400"
                aria-label="Editar ícone do perfil"
                onClick={() => setIconGalleryOpen(true)}
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>

            <p className="mt-2 text-center text-base font-bold leading-tight tracking-tight text-white">
              {DEMO.username}
            </p>
            <p className="mt-1 flex items-center justify-center gap-1 text-xs text-amber-200/95">
              <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
              <span>
                <span className="font-semibold">{DEMO.rankLabel}</span>
                <span className="text-slate-500"> — </span>
                <span className="tabular-nums text-slate-400">{DEMO.xp} XP</span>
              </span>
            </p>

            <div className="mt-2.5 grid grid-cols-3 gap-1 divide-x divide-white/10 rounded-lg bg-black/25 px-1 py-2">
              <div className="flex flex-col items-center gap-0.5 px-0.5 text-center">
                <Trophy className="h-3.5 w-3.5 text-cyan-400" aria-hidden />
                <span className="text-sm font-bold tabular-nums leading-none text-white">
                  {DEMO.wins}
                </span>
                <span className="text-[10px] font-medium leading-tight text-slate-500">
                  Vitórias
                </span>
              </div>
              <div className="flex flex-col items-center gap-0.5 px-0.5 text-center">
                <Dice6 className="h-3.5 w-3.5 text-cyan-400" aria-hidden />
                <span className="text-sm font-bold tabular-nums leading-none text-white">
                  {DEMO.bets}
                </span>
                <span className="text-[10px] font-medium leading-tight text-slate-500">
                  Apostas
                </span>
              </div>
              <div className="flex flex-col items-center gap-0.5 px-0.5 text-center">
                <PiggyBank className="h-3.5 w-3.5 text-cyan-400" aria-hidden />
                <span className="text-xs font-bold leading-tight text-white">{DEMO.wagered}</span>
                <span className="text-[10px] font-medium leading-tight text-slate-500">
                  Apostado
                </span>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-lg bg-black/20 p-2 text-[10px] leading-snug">
              <div>
                <p className="text-slate-500">Último login</p>
                <p className="font-semibold text-slate-200">Hoje, 14:32</p>
              </div>
              <div>
                <p className="text-slate-500">Moeda</p>
                <p className="font-semibold text-slate-200">BRL</p>
              </div>
              <div>
                <p className="text-slate-500">Bónus ativo</p>
                <p className="font-semibold text-emerald-400/90">R$ 15,00</p>
              </div>
              <div>
                <p className="text-slate-500">Cashback nível</p>
                <p className="font-semibold text-cyan-300/90">3,2%</p>
              </div>
            </div>

            <div className="mt-2 rounded-lg bg-[#0f1526] px-3 py-2 ring-1 ring-white/5">
              <p className="text-center text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-400/85">
                Saldo disponível
              </p>
              <p className="mt-0.5 text-center text-lg font-bold tabular-nums text-white">
                {DEMO.balance}
              </p>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="rounded-lg bg-cyan-400 py-2 text-center text-xs font-bold text-slate-950 shadow-md shadow-cyan-500/15 transition hover:bg-cyan-300"
              >
                + Depositar
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-600/80 bg-slate-800/80 py-2 text-center text-xs font-bold text-white transition hover:bg-slate-700/80"
              >
                ↑ Sacar
              </button>
            </div>
          </div>

          <p className="mb-1 mt-3 px-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Minha conta
          </p>
          <nav className="flex flex-col gap-px rounded-xl border border-white/5 bg-[#161d31]/80 p-0.5">
            <MenuRow icon={FolderOpen} label="Dados pessoais" />
            <MenuRow icon={PiggyBank} label="Transações" />
            <MenuRow icon={History} label="Histórico de apostas" />
            <MenuRow icon={Shield} label="Segurança" />
            <MenuRow icon={SlidersHorizontal} label="Restrições" />
            <MenuRow icon={FileText} label="Relatórios" />
          </nav>

          <p className="mb-1 mt-3 px-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Suporte
          </p>
          <div className="rounded-xl border border-white/5 bg-[#161d31]/80 px-2.5 py-2 text-[10px] text-slate-400">
            <p>
              Chat 24h · <span className="font-medium text-cyan-400/90">ajuda@demo.casino</span>
            </p>
            <p className="mt-1 text-slate-500">
              Linha responsável · autoexclusão no menu Restrições.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
