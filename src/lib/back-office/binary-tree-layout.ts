import type { BinaryTreeNodeView } from "@/lib/back-office/network-types";

export const BINARY_TREE_NODE_WIDTH = 132;
export const BINARY_TREE_NODE_HEIGHT = 56;
export const BINARY_TREE_LEVEL_GAP = 88;
export const BINARY_TREE_LEAF_GAP = 28;

export type PositionedBinaryNode = {
  key: string;
  node: BinaryTreeNodeView;
  x: number;
  y: number;
  centerX: number;
  centerY: number;
};

export type BinaryTreeEdge = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type BinaryTreeLayout = {
  nodes: PositionedBinaryNode[];
  edges: BinaryTreeEdge[];
  width: number;
  height: number;
};

function nodeKey(node: BinaryTreeNodeView, parentKey: string): string {
  if (node.userId) return node.userId;
  return `empty:${parentKey}:${node.side ?? "x"}:${node.level}`;
}

export function layoutBinaryTree(root: BinaryTreeNodeView): BinaryTreeLayout {
  const nodes: PositionedBinaryNode[] = [];
  const edges: BinaryTreeEdge[] = [];
  const counter = { value: 0 };

  function layout(
    node: BinaryTreeNodeView,
    depth: number,
    parentKey: string,
    parentCenter?: { x: number; y: number },
  ): { centerX: number; minX: number; maxX: number } {
    const key = nodeKey(node, parentKey);
    const y = depth * BINARY_TREE_LEVEL_GAP;

    if (node.children.length === 0) {
      const centerX =
        counter.value * (BINARY_TREE_NODE_WIDTH + BINARY_TREE_LEAF_GAP) + BINARY_TREE_NODE_WIDTH / 2;
      counter.value += 1;
      const x = centerX - BINARY_TREE_NODE_WIDTH / 2;
      const centerY = y + BINARY_TREE_NODE_HEIGHT / 2;
      nodes.push({ key, node, x, y, centerX, centerY });

      if (parentCenter) {
        edges.push({
          x1: parentCenter.x,
          y1: parentCenter.y + BINARY_TREE_NODE_HEIGHT / 2,
          x2: centerX,
          y2: y,
        });
      }

      return { centerX, minX: x, maxX: x + BINARY_TREE_NODE_WIDTH };
    }

    const childLayouts = node.children.map((child) => layout(child, depth + 1, key));
    const centerX =
      (childLayouts[0]!.centerX + childLayouts[childLayouts.length - 1]!.centerX) / 2;
    const x = centerX - BINARY_TREE_NODE_WIDTH / 2;
    const centerY = y + BINARY_TREE_NODE_HEIGHT / 2;
    nodes.push({ key, node, x, y, centerX, centerY });

    for (const child of childLayouts) {
      edges.push({
        x1: centerX,
        y1: y + BINARY_TREE_NODE_HEIGHT,
        x2: child.centerX,
        y2: (depth + 1) * BINARY_TREE_LEVEL_GAP,
      });
    }

    if (parentCenter) {
      edges.push({
        x1: parentCenter.x,
        y1: parentCenter.y + BINARY_TREE_NODE_HEIGHT / 2,
        x2: centerX,
        y2: y,
      });
    }

    return {
      centerX,
      minX: childLayouts[0]!.minX,
      maxX: childLayouts[childLayouts.length - 1]!.maxX,
    };
  }

  const bounds = layout(root, 0, "root");
  const padding = 28;
  const width = bounds.maxX - bounds.minX + padding * 2;
  const maxY = Math.max(...nodes.map((n) => n.y), 0);
  const height = maxY + BINARY_TREE_NODE_HEIGHT + padding * 2;

  const offsetX = padding - bounds.minX;
  if (offsetX !== 0) {
    for (const n of nodes) {
      n.x += offsetX;
      n.centerX += offsetX;
    }
    for (const e of edges) {
      e.x1 += offsetX;
      e.x2 += offsetX;
    }
  }

  return { nodes, edges, width, height };
}

function renumberTreeLevels(node: BinaryTreeNodeView, baseLevel: number): BinaryTreeNodeView {
  return {
    ...node,
    level: baseLevel,
    children: node.children.map((child) => renumberTreeLevels(child, baseLevel + 1)),
  };
}

export function mergeBinarySubtree(
  root: BinaryTreeNodeView,
  targetUserId: string,
  subtree: BinaryTreeNodeView,
): BinaryTreeNodeView {
  if (root.userId === targetUserId) {
    return renumberTreeLevels({ ...subtree, side: root.side }, root.level);
  }

  return {
    ...root,
    children: root.children.map((child) =>
      child.userId === targetUserId || hasDescendant(child, targetUserId)
        ? mergeBinarySubtree(child, targetUserId, subtree)
        : child,
    ),
  };
}

function hasDescendant(node: BinaryTreeNodeView, userId: string): boolean {
  if (node.userId === userId) return true;
  return node.children.some((c) => hasDescendant(c, userId));
}

export function findBinaryTreeNode(
  root: BinaryTreeNodeView,
  userId: string,
): BinaryTreeNodeView | null {
  if (root.userId === userId) return root;
  for (const child of root.children) {
    const found = findBinaryTreeNode(child, userId);
    if (found) return found;
  }
  return null;
}
