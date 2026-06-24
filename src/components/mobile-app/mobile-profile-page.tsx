import type { LucideIcon } from "lucide-react";
import {
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
import { useState } from "react";

import {
  ProfileIconAvatar,
  ProfileIconGallery,
  readProfileIconId,
  type ProfileIconId,
} from "@/components/profile-icon-gallery";

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
      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-neutral-100 transition hover:bg-neutral-800/60"
    >
      <Icon className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
      <span className="min-w-0 flex-1">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-neutral-600" aria-hidden />
    </button>
  );
}

export function MobileProfilePage() {
  const [profileIconId, setProfileIconId] = useState<ProfileIconId>(() => readProfileIconId());
  const [iconGalleryOpen, setIconGalleryOpen] = useState(false);

  return (
    <div className="mx-auto min-h-full max-w-lg px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <ProfileIconGallery
        open={iconGalleryOpen}
        onClose={() => setIconGalleryOpen(false)}
        value={profileIconId}
        onChange={setProfileIconId}
      />

      <header className="mb-5">
        <h1 className="text-2xl font-black text-amber-400">Perfil</h1>
        <p className="mt-0.5 text-sm text-neutral-500">Minha conta e preferências</p>
      </header>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-4">
        <div className="relative mx-auto w-fit">
          <ProfileIconAvatar id={profileIconId} size="lg" />
          <button
            type="button"
            className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-neutral-900 bg-amber-400 text-black shadow transition hover:bg-amber-300"
            aria-label="Editar ícone do perfil"
            onClick={() => setIconGalleryOpen(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>

        <p className="mt-3 text-center text-lg font-bold text-white">{DEMO.username}</p>
        <p className="mt-1 flex items-center justify-center gap-1 text-sm text-amber-200/90">
          <Crown className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
          <span>
            <span className="font-semibold">{DEMO.rankLabel}</span>
            <span className="text-neutral-600"> · </span>
            <span className="tabular-nums text-neutral-400">{DEMO.xp} XP</span>
          </span>
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2 divide-x divide-neutral-800 rounded-xl bg-black/40 px-1 py-3">
          <div className="flex flex-col items-center gap-1 px-1 text-center">
            <Trophy className="h-4 w-4 text-amber-400" aria-hidden />
            <span className="text-base font-bold tabular-nums text-white">{DEMO.wins}</span>
            <span className="text-[10px] font-medium text-neutral-500">Vitórias</span>
          </div>
          <div className="flex flex-col items-center gap-1 px-1 text-center">
            <Dice6 className="h-4 w-4 text-amber-400" aria-hidden />
            <span className="text-base font-bold tabular-nums text-white">{DEMO.bets}</span>
            <span className="text-[10px] font-medium text-neutral-500">Apostas</span>
          </div>
          <div className="flex flex-col items-center gap-1 px-1 text-center">
            <PiggyBank className="h-4 w-4 text-amber-400" aria-hidden />
            <span className="text-sm font-bold text-white">{DEMO.wagered}</span>
            <span className="text-[10px] font-medium text-neutral-500">Apostado</span>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-black/50 px-4 py-3 ring-1 ring-neutral-800">
          <p className="text-center text-[10px] font-bold uppercase tracking-wider text-amber-400/80">
            Saldo disponível
          </p>
          <p className="mt-1 text-center text-2xl font-black tabular-nums text-white">{DEMO.balance}</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 py-3 text-sm font-black text-black shadow-lg shadow-amber-500/20"
          >
            Depositar
          </button>
          <button
            type="button"
            className="rounded-xl border border-neutral-700 bg-neutral-800/80 py-3 text-sm font-bold text-white"
          >
            Sacar
          </button>
        </div>
      </div>

      <p className="mb-2 mt-6 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
        Minha conta
      </p>
      <nav className="flex flex-col gap-1 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-1">
        <MenuRow icon={FolderOpen} label="Dados pessoais" />
        <MenuRow icon={PiggyBank} label="Transações" />
        <MenuRow icon={History} label="Histórico de apostas" />
        <MenuRow icon={Shield} label="Segurança" />
        <MenuRow icon={SlidersHorizontal} label="Restrições" />
        <MenuRow icon={FileText} label="Relatórios" />
      </nav>

      <p className="mb-2 mt-6 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
        Suporte
      </p>
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 text-xs text-neutral-500">
        <p>
          Chat 24h · <span className="font-medium text-amber-400/90">ajuda@demo.casino</span>
        </p>
        <p className="mt-1">Linha responsável · autoexclusão no menu Restrições.</p>
      </div>
    </div>
  );
}
