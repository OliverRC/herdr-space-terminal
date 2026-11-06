// node layout.test.mjs
import assert from "node:assert/strict";
import { BODY, SLOT, find, repair, slotNode } from "./layout.js";

const files = { id: "files", type: "block", content: { mod: "files" } };
const changes = { id: "changes", type: "block", content: { mod: "changes" } };
const main = { id: "main", type: "block", content: { tab: "active" } };

// The shipped shape: a hideable "panel" column around the "panel-body" stack.
const healthy = () => ({
  id: "root", type: "row", children: [{
    id: "work-body", type: "row", children: [main, {
      id: "panel", type: "column", size: { px: 368 }, min: 280, max: 900, hidden: false,
      children: [{ id: "panel-body", type: "stack", active: SLOT, children: [files, changes, slotNode()] }],
    }],
  }],
});

// A whole slot is left alone.
assert.deepEqual(repair(healthy(), true), healthy());

// Herdr dropped the ended terminal block and folded the panel column into the stack.
const folded = {
  id: "root", type: "row", children: [{
    id: "work-body", type: "row", children: [main,
      { id: "panel-body", type: "stack", active: "changes", size: { px: 368 }, children: [files, changes] }],
  }],
};
let tree = repair(folded, true);
assert.equal(find(tree, "panel").type, "column");
assert.deepEqual(find(tree, "panel").size, { px: 368 });
assert.equal(find(tree, "panel").hidden, false);
assert.equal(find(tree, "panel-body").size, undefined);
assert.equal(find(tree, "panel-body").active, SLOT);
assert.ok(find(tree, BODY));

// The block went but the slot's column stayed: rebuilt once, not duplicated; a closed panel stays closed.
const partial = healthy();
const stack = find(partial, "panel-body");
stack.children[2] = { id: SLOT, type: "column", children: [slotNode().children[0]] };
stack.active = "files";
find(partial, "panel").hidden = true;
tree = repair(partial, false);
assert.equal(find(tree, "panel-body").children.filter((c) => c.id === SLOT).length, 1);
assert.ok(find(tree, BODY));
assert.equal(find(tree, "panel").hidden, true);
assert.equal(find(tree, "panel-body").active, "files");

// An active child that no longer exists falls back to the first.
const gone = healthy();
find(gone, "panel-body").active = "nope";
assert.equal(find(repair(gone, false), "panel-body").active, "files");

console.log("layout tests passed");
