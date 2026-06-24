import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

const STORAGE_KEY = "game-odds-glow:profile-icon";

/** Grelha 5×4 no ficheiro `public/profile/avatars-grid.png` (20 avatares). */
const AVATAR_COLS = 5;
const AVATAR_ROWS = 4;
const AVATAR_GRID_URL = "/profile/avatars-grid.png";

export const PROFILE_AVATAR_IDS = [
  "avatar-01",
  "avatar-02",
  "avatar-03",
  "avatar-04",
  "avatar-05",
  "avatar-06",
  "avatar-07",
  "avatar-08",
  "avatar-09",
  "avatar-10",
  "avatar-11",
  "avatar-12",
  "avatar-13",
  "avatar-14",
  "avatar-15",
  "avatar-16",
  "avatar-17",
  "avatar-18",
  "avatar-19",
  "avatar-20",
] as const;

export type ProfileIconId = (typeof PROFILE_AVATAR_IDS)[number];

const DEFAULT_AVATAR: ProfileIconId = "avatar-01";

function isProfileIconId(v: string): v is ProfileIconId {
  return (PROFILE_AVATAR_IDS as readonly string[]).includes(v);
}

function avatarIndex(id: ProfileIconId): number {
  return PROFILE_AVATAR_IDS.indexOf(id);
}

/** Posição do sprite (percentagens) para cada célula da grelha. */
function spriteStyleForIndex(index: number): CSSProperties {
  const col = index % AVATAR_COLS;
  const row = Math.floor(index / AVATAR_COLS);
  const xPct = AVATAR_COLS <= 1 ? 0 : (col / (AVATAR_COLS - 1)) * 100;
  const yPct = AVATAR_ROWS <= 1 ? 0 : (row / (AVATAR_ROWS - 1)) * 100;
  return {
    backgroundImage: `url(${AVATAR_GRID_URL})`,
    backgroundSize: `${AVATAR_COLS * 100}% ${AVATAR_ROWS * 100}%`,
    backgroundPosition: `${xPct}% ${yPct}%`,
    backgroundRepeat: "no-repeat",
  };
}

export function readProfileIconId(): ProfileIconId {
  if (typeof window === "undefined") return DEFAULT_AVATAR;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && isProfileIconId(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_AVATAR;
}

export const PROFILE_ICON_CHANGED_EVENT = "game-odds-glow:profile-icon-changed";

export function writeProfileIconId(id: ProfileIconId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(PROFILE_ICON_CHANGED_EVENT, { detail: { id } }));
    }
  } catch {
    /* ignore */
  }
}

type ProfileIconAvatarProps = {
  id: ProfileIconId;
  /** `sm` = cabeçalho lobby (círculo); `md` / `lg` = painel. */
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function ProfileIconAvatar({ id, size = "lg", className }: ProfileIconAvatarProps) {
  const idx = avatarIndex(id);
  const box =
    size === "lg"
      ? "h-14 w-14"
      : size === "md"
        ? "h-11 w-11"
        : "h-9 w-9 border border-slate-600/80";

  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden rounded-full bg-slate-800 shadow ring-1 ring-cyan-400/30",
        box,
        className,
      )}
      style={spriteStyleForIndex(idx >= 0 ? idx : 0)}
      aria-hidden
    />
  );
}

type ProfileIconGalleryProps = {
  open: boolean;
  onClose: () => void;
  value: ProfileIconId;
  onChange: (id: ProfileIconId) => void;
};

export function ProfileIconGallery({ open, onClose, value, onChange }: ProfileIconGalleryProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const [draft, setDraft] = useState<ProfileIconId>(value);
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const grid = useMemo(() => [...PROFILE_AVATAR_IDS], []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        aria-label="Fechar galeria de ícones"
        onClick={onClose}
      />
      <div
        className="animate-in slide-in-from-bottom fade-in duration-200 relative z-[81] mt-auto max-h-[min(88dvh,36rem)] w-full max-w-md overflow-hidden rounded-t-2xl border border-cyan-950/40 bg-[#0b1224] shadow-2xl sm:mt-0 sm:max-w-lg sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-icon-gallery-title"
      >
        <div className="border-b border-white/5 px-4 py-3">
          <h2 id="profile-icon-gallery-title" className="text-center text-sm font-bold text-white">
            Ícone do perfil
          </h2>
          <p className="mt-1 text-center text-[11px] text-slate-500">
            Escolhe um avatar. A seleção fica guardada neste dispositivo.
          </p>
        </div>

        <div className="max-h-[min(62dvh,26rem)] overflow-y-auto overscroll-contain px-3 pb-3 pt-3 sm:max-h-[min(55vh,24rem)]">
          <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
            {grid.map((id) => {
              const selected = draft === id;
              const i = avatarIndex(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDraft(id)}
                  aria-label={`Avatar ${String(i + 1).padStart(2, "0")}`}
                  className={cn(
                    "aspect-square overflow-hidden rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1224]",
                    selected
                      ? "border-cyan-400 ring-2 ring-cyan-400/50"
                      : "border-transparent hover:border-cyan-500/40",
                  )}
                >
                  <span
                    className="block h-full w-full rounded-full bg-slate-800"
                    style={spriteStyleForIndex(i)}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2 border-t border-white/5 bg-[#0b1224] px-3 py-3">
          <button
            type="button"
            className="flex-1 rounded-lg border border-white/10 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-white/5"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="flex-1 rounded-lg bg-cyan-500 py-2.5 text-xs font-bold text-slate-950 shadow-md shadow-cyan-500/20 transition hover:bg-cyan-400"
            onClick={() => {
              writeProfileIconId(draft);
              onChange(draft);
              onClose();
            }}
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}
