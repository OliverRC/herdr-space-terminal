// One shell per space, shown in the side panel's "terminal" slot.
// Two copies run: the hidden floating one keeps the slot pointed at the shown
// space's shell; the one in the slot (props.placeholder) shows until it is.
import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { BODY, SLOT, find, repair } from "./layout.js";
import { exec, focused, hc, home, layout, panes, props, run, setShared, shared, spaces, theme } from "herdr";

const STORE = "space-terminal"; // { [spaceId]: address }
const FOLDERS = "space-terminal.folders"; // { [address]: folder }, for the title bar
// Remote ids are "<machine>/<id>"; labels on that machine use the bare id.
const localId = (id) => id.slice(id.lastIndexOf("/") + 1);

async function alive(address) {
  if (!address) return false;
  const r = await hc(["get", address, "--json"]);
  if (r.code !== 0) return false;
  try { return JSON.parse(r.stdout).state === "live"; } catch { return false; }
}

async function start(space) {
  // No herdr.space/tab labels, so it never shows up as a tab of its own.
  const args = ["run", "--bg", "--keep", "--no-parent", "--json", "--label", `space-terminal=${localId(space.id)}`];
  // `exit` gives a fresh shell rather than ending the terminal (Herdr would drop the panel's block).
  const loop = ["sh", "-c", 'while :; do "${SHELL:-/bin/sh}" -l || sleep 1; done'];
  // Where the Files panel looks (the focused pane's folder, else the space's), then up to its repo root.
  const f = focused();
  const pane = panes().find((p) => p.pane === f?.pane && p.cwd)
    ?? space.tabs.map((t) => panes().find((p) => p.tab === t.id && p.cwd)).find(Boolean);
  let folder = pane?.cwd || space.folder || (space.machine ? "" : home());
  if (folder) {
    const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd: folder, on: space.machine }).catch(() => null);
    if (top?.code === 0 && top.stdout.trim()) folder = top.stdout.trim();
    args.push("--cwd", folder);
  }
  if (space.machine) args.push("--on", space.machine);
  args.push("--", ...loop);
  const r = await hc(args);
  if (r.code !== 0) throw new Error(r.stderr || r.stdout);
  const address = JSON.parse(r.stdout).address;
  setShared(FOLDERS, { ...(shared(FOLDERS) ?? {}), [address]: folder });
  return address;
}

export default class SpaceTerminal extends View {
  init(_props, cx) {
    if (props()?.placeholder || props()?.header) return;
    this.busy = false;
    cx.timer.every(500, (cx) => this.sync(cx));
  }

  sync(cx) {
    if (this.busy) return;
    const root = layout(), panel = find(root, "panel"), body = find(root, "panel-body"), slot = find(root, BODY);
    if (!body) return;
    // Herdr drops a terminal block whose terminal ends (e.g. `hc kill`) and folds the panel column
    // around it: rebuild both, reopening the slot if it was what the panel showed.
    if (!slot || !panel) {
      try {
        run("layout.set", { layout: repair(JSON.parse(JSON.stringify(root)), this.showing) });
      } catch (e) {
        console.log(`space-terminal: repair failed: ${e}`);
      }
      return;
    }
    this.showing = !panel?.hidden && body.active === SLOT;
    if (!this.showing) return;
    const space = spaces().find((s) => s.active);
    if (!space) return;
    const want = (shared(STORE) ?? {})[space.id];
    const shown = want && slot.content?.terminal === want;
    // Shown already: only check now and then that it's still alive (someone may `exit` it).
    if (shown && Date.now() - (this.checked ?? 0) < 3000) return;
    this.busy = true;
    cx.spawn(async () => {
      try {
        let address = want;
        const live = await alive(address);
        this.checked = Date.now();
        if (shown && live) return;
        if (!live) {
          address = await start(space);
          setShared(STORE, { ...(shared(STORE) ?? {}), [space.id]: address });
        }
        // Re-read: layout.set takes the whole tree, so keep every click made meanwhile.
        const tree = JSON.parse(JSON.stringify(layout()));
        const node = find(tree, BODY);
        if (node && node.content?.terminal !== address && spaces().find((s) => s.active)?.id === space.id) {
          node.content = { terminal: address };
          run("layout.set", { layout: tree });
        }
      } catch (e) {
        console.log(`space-terminal: ${e}`);
      } finally {
        this.busy = false;
      }
    });
  }

  render() {
    const t = theme();
    if (props()?.header) {
      const space = spaces().find((s) => s.active);
      const folder = (shared(FOLDERS) ?? {})[(shared(STORE) ?? {})[space?.id]] ?? "";
      return h_flex().size_full().px(14).gap(8).items_center().border_b(1).border_color(t.border).bg(t.background).text_color(t.foreground).text_size(13)
        .child(div().font_semibold().child("Terminal"))
        .child(div().flex_1().min_w(0).truncate().text_right().text_size(12).text_color(t.dim).child(folder.split(/[\\/]/).pop()));
    }
    if (!props()?.placeholder) return div();
    return div().size_full().flex().items_center().justify_center().text_size(12).text_color(t.dim).child("Starting terminal…");
  }
}
