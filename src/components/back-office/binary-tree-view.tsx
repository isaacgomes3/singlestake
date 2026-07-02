import { ChevronDown, Loader2, User } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  BINARY_TREE_NODE_HEIGHT,
  BINARY_TREE_NODE_WIDTH,
  layoutBinaryTree,
  mergeBinarySubtree,
  type PositionedBinaryNode,
} from "@/lib/back-office/binary-tree-layout";
import { fetchBinarySubtree } from "@/lib/back-office/network-api";
import type { BinaryTreeNodeView } from "@/lib/back-office/network-types";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useFormat } from "@/lib/i18n/use-format";
import { cn } from "@/lib/utils";

type Props = {
  root: BinaryTreeNodeView;
};

type SelectedNode = {
  node: BinaryTreeNodeView;
  x: number;
  y: number;
};

function truncateName(name: string, max = 18): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

function treeNodeId(node: BinaryTreeNodeView): string | null {
  return node.userId ?? node.treeUserId ?? null;
}

function TreeNodeCard({
  positioned,
  isRoot,
  isSelected,
  isExpanding,
  onSelect,
  onExpand,
  emptyLabel,
  sideLeftLabel,
  sideRightLabel,
  expandLabel,
}: {
  positioned: PositionedBinaryNode;
  isRoot: boolean;
  isSelected: boolean;
  isExpanding: boolean;
  onSelect: () => void;
  onExpand: () => void;
  emptyLabel: string;
  sideLeftLabel: string;
  sideRightLabel: string;
  expandLabel: string;
}) {
  const { node } = positioned;
  const isEmpty = node.isEmpty;
  const nodeId = treeNodeId(node);
  const sideBadge =
    node.side === "left" ? sideLeftLabel : node.side === "right" ? sideRightLabel : null;

  const hoverTitle = isEmpty
    ? emptyLabel
    : [node.name, sideBadge, node.details?.email].filter(Boolean).join(" · ");

  return (
    <foreignObject
      x={positioned.x}
      y={positioned.y}
      width={BINARY_TREE_NODE_WIDTH}
      height={BINARY_TREE_NODE_HEIGHT}
      className="overflow-visible"
    >
      <button
        type="button"
        disabled={isEmpty && !node.canExpand}
        title={hoverTitle}
        onClick={onSelect}
        className={cn(
          "flex h-full w-full flex-col items-center justify-center rounded-full border-2 px-2 text-center shadow-sm transition",
          isEmpty
            ? "cursor-default border-dashed border-border-color/80 bg-bg-secondary/40 text-text-secondary"
            : "cursor-pointer hover:scale-[1.03] hover:shadow-md",
          !isEmpty && isRoot && "border-violet-500/60 bg-violet-500/15 text-violet-100",
          !isEmpty &&
            !isRoot &&
            node.side === "left" &&
            "border-sky-500/50 bg-sky-500/10 text-text-primary",
          !isEmpty &&
            !isRoot &&
            node.side === "right" &&
            "border-amber-500/50 bg-amber-500/10 text-text-primary",
          !isEmpty && isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-bg-card",
          node.canExpand && !isEmpty && "border-b-4 border-b-primary/70",
        )}
      >
        {isEmpty ? (
          <>
            <span className="text-[11px] font-medium">{emptyLabel}</span>
            {node.canExpand && nodeId ? (
              <span
                role="presentation"
                onClick={(e) => {
                  e.stopPropagation();
                  onExpand();
                }}
                className={cn(
                  "mt-1 inline-flex items-center gap-0.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-semibold text-primary",
                  isExpanding && "opacity-60",
                )}
              >
                {isExpanding ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden />
                ) : (
                  <ChevronDown className="h-2.5 w-2.5" aria-hidden />
                )}
                {expandLabel}
              </span>
            ) : null}
          </>
        ) : (
          <>
            <span className="line-clamp-2 text-[11px] font-semibold leading-tight">
              {truncateName(node.name)}
            </span>
            {sideBadge ? (
              <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wide opacity-70">
                {sideBadge}
              </span>
            ) : null}
            {node.canExpand ? (
              <span
                role="presentation"
                onClick={(e) => {
                  e.stopPropagation();
                  onExpand();
                }}
                className={cn(
                  "mt-1 inline-flex items-center gap-0.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-semibold text-primary",
                  isExpanding && "opacity-60",
                )}
              >
                {isExpanding ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden />
                ) : (
                  <ChevronDown className="h-2.5 w-2.5" aria-hidden />
                )}
                {expandLabel}
              </span>
            ) : null}
          </>
        )}
      </button>
    </foreignObject>
  );
}

export function BinaryTreeView({ root }: Props) {
  const { t } = useI18n();
  const { money } = useFormat();
  const [tree, setTree] = useState(root);
  const [selected, setSelected] = useState<SelectedNode | null>(null);
  const [expandingId, setExpandingId] = useState<string | null>(null);

  useEffect(() => {
    setTree(root);
    setSelected(null);
  }, [root]);

  const layout = useMemo(() => layoutBinaryTree(tree), [tree]);

  const handleExpand = useCallback(
    async (userId: string) => {
      setExpandingId(userId);
      const result = await fetchBinarySubtree(userId);
      setExpandingId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTree((prev) => mergeBinarySubtree(prev, userId, result.subtree));
      toast.success(t("network.binary.treeExpanded"));
    },
    [t],
  );

  const sideLeftShort = t("network.binary.sideLeftShort");
  const sideRightShort = t("network.binary.sideRightShort");

  return (
    <div className="relative">
      <div className="overflow-x-auto rounded-xl border border-border-color bg-bg-secondary/30 p-4">
        <svg
          width={layout.width}
          height={layout.height}
          className="mx-auto min-w-max"
          role="img"
          aria-label={t("network.binary.treeTitle")}
        >
          {layout.edges.map((edge, i) => (
            <line
              key={`edge-${i}`}
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke="currentColor"
              strokeWidth={1.5}
              className="text-border-color"
            />
          ))}

          {layout.nodes.map((positioned) => (
            <TreeNodeCard
              key={positioned.key}
              positioned={positioned}
              isRoot={positioned.node.level === 0}
              isSelected={selected?.node.userId === positioned.node.userId}
              isExpanding={expandingId === treeNodeId(positioned.node)}
              emptyLabel={t("network.binary.empty")}
              sideLeftLabel={sideLeftShort}
              sideRightLabel={sideRightShort}
              expandLabel={t("network.binary.expandLevels")}
              onSelect={() => {
                if (positioned.node.isEmpty) return;
                setSelected({
                  node: positioned.node,
                  x: positioned.centerX,
                  y: positioned.y,
                });
              }}
              onExpand={() => {
                const expandId = treeNodeId(positioned.node);
                if (expandId && positioned.node.canExpand) {
                  void handleExpand(expandId);
                }
              }}
            />
          ))}
        </svg>
      </div>

      <p className="mt-2 text-center text-[11px] text-text-secondary">
        {t("network.binary.treeInteractionHint")}
      </p>

      {selected && !selected.node.isEmpty ? (
        <div className="mt-4 rounded-xl border border-border-color bg-bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <User className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-text-primary">{selected.node.name}</p>
              {selected.node.side ? (
                <p className="text-xs text-text-secondary">
                  {t("network.binary.positionLabel")}:{" "}
                  {selected.node.side === "left"
                    ? t("network.binary.sideLeft")
                    : t("network.binary.sideRight")}
                  {" · "}
                  {t("network.binary.levelLabel", { level: selected.node.level + 1 })}
                </p>
              ) : (
                <p className="text-xs text-text-secondary">
                  {t("network.binary.root")} · {t("network.binary.levelLabel", { level: 1 })}
                </p>
              )}
              {selected.node.details ? (
                <dl className="mt-3 grid gap-1.5 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-text-secondary">{t("network.binary.detailEmail")}</dt>
                    <dd className="truncate font-medium text-text-primary">
                      {selected.node.details.email}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">{t("network.binary.colJoined")}</dt>
                    <dd className="font-medium text-text-primary">
                      {selected.node.details.joinedAt}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">{t("network.binary.colStatus")}</dt>
                    <dd
                      className={cn(
                        "font-medium",
                        selected.node.details.hasActiveStart ? "text-success" : "text-warning",
                      )}
                    >
                      {selected.node.details.hasActiveStart
                        ? t("network.binary.startActive")
                        : t("network.binary.awaitingStart")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">{t("network.binary.detailVolume")}</dt>
                    <dd className="font-medium tabular-nums text-text-primary">
                      {money(selected.node.details.packageAmount)}
                    </dd>
                  </div>
                </dl>
              ) : null}
              {selected.node.canExpand && selected.node.userId ? (
                <button
                  type="button"
                  disabled={expandingId === selected.node.userId}
                  onClick={() => void handleExpand(selected.node.userId!)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-primary bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-50"
                >
                  {expandingId === selected.node.userId ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {t("network.binary.expandLevels")}
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="shrink-0 text-xs text-text-secondary hover:text-text-primary"
            >
              {t("network.binary.closeDetails")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
