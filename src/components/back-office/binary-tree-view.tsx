import type { BinaryTreeNodeView } from "@/lib/back-office/network-types";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { cn } from "@/lib/utils";

function TreeNode({ node, isRoot }: { node: BinaryTreeNodeView; isRoot?: boolean }) {
  const { t } = useI18n();
  const left = node.children.find((c) => c.side === "left");
  const right = node.children.find((c) => c.side === "right");

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={cn(
          "rounded-xl border px-4 py-2 text-center text-sm font-semibold",
          isRoot
            ? "border-violet-500/40 bg-violet-500/10 text-violet-100"
            : "border-border-color bg-bg-secondary text-text-primary",
        )}
      >
        {node.name}
        {node.side ? (
          <span className="ml-1.5 text-[10px] font-normal uppercase text-text-secondary">
            ({node.side === "left" ? "E" : "D"})
          </span>
        ) : null}
      </div>

      {left || right ? (
        <div className="flex gap-8 sm:gap-16">
          <div className="flex min-w-[88px] flex-col items-center">
            {left ? (
              <TreeNode node={left} />
            ) : (
              <div className="rounded-md border border-dashed border-border-color px-3 py-1.5 text-xs text-text-secondary">
                {t("network.binary.empty")}
              </div>
            )}
          </div>
          <div className="flex min-w-[88px] flex-col items-center">
            {right ? (
              <TreeNode node={right} />
            ) : (
              <div className="rounded-md border border-dashed border-border-color px-3 py-1.5 text-xs text-text-secondary">
                {t("network.binary.empty")}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function BinaryTreeView({ root }: { root: BinaryTreeNodeView }) {
  return (
    <div className="overflow-x-auto py-2">
      <TreeNode node={root} isRoot />
    </div>
  );
}
