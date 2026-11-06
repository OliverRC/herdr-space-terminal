// Pure layout-tree helpers, kept apart from main.js so layout.test.mjs can run them under Node.

export const SLOT = "terminal";        // the panel-body child: a card like Files and Changes
export const BODY = "terminal-body";   // the block inside it that shows the space's shell

// The card's frame matches Files/Changes: radius 10, 1px border, 42px title bar.
export const slotNode = () => ({
  id: SLOT, type: "column", radius: 10, border: { width: 1, color: "border" }, background: "background",
  children: [
    { id: "terminal-head", type: "block", size: { px: 42 }, content: { mod: "space-terminal", props: { header: true } } },
    { id: BODY, type: "block", content: { mod: "space-terminal", props: { placeholder: true } } },
  ],
});

export function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

function parentOf(node, id) {
  for (const child of node?.children ?? []) {
    if (child.id === id) return node;
    const found = parentOf(child, id);
    if (found) return found;
  }
  return null;
}

// The shipped layout's shape: a hideable "panel" column holding the "panel-body" stack.
export function repair(tree, show) {
  const body = find(tree, "panel-body");
  if (!find(tree, BODY)) {
    body.children = body.children.filter((c) => c.id !== SLOT);
    body.children.push(slotNode());
  }
  let panel = find(tree, "panel");
  if (!panel) {
    const parent = parentOf(tree, "panel-body");
    const { size, min, max, ...rest } = body;
    panel = { id: "panel", type: "column", children: [rest], size: size ?? { px: 368 }, min: min ?? 280, max: max ?? 900, hidden: true };
    parent.children[parent.children.indexOf(body)] = panel;
  }
  const stack = find(tree, "panel-body");
  if (show) { stack.active = SLOT; panel.hidden = false; }
  else if (!stack.children.some((c) => c.id === stack.active)) stack.active = stack.children[0].id;
  return tree;
}
