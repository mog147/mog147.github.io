// Site Flow Mapper - Plugin Backend

figma.showUI(__html__, { width: 340, height: 560, title: "Site Flow Mapper" });

const FILE_KEY = figma.fileKey ?? "";
const BASE_URL = `https://www.figma.com/design/${FILE_KEY}`;

const CARD_W = 260;
const CARD_H = 220;
const THUMB_H = 160;
const FOOTER_H = CARD_H - THUMB_H;   // 60
const H_GAP = 80;
const V_GAP = 60;

function scanFrames(): { id: string; name: string; url: string }[] {
  const frames: { id: string; name: string; url: string }[] = [];

  function collect(node: SceneNode) {
    const nodeId = node.id.replace(":", "-");
    if (node.type === "FRAME" || node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
      frames.push({ id: node.id, name: node.name, url: `${BASE_URL}?node-id=${nodeId}` });
    } else if (node.type === "SECTION" || node.type === "GROUP") {
      // Recurse into sections/groups to find nested frames
      if ("children" in node) {
        for (const child of (node as ChildrenMixin).children) {
          collect(child as SceneNode);
        }
      }
    }
  }

  for (const child of figma.currentPage.children) {
    collect(child);
  }
  return frames;
}

function loadTree(): Record<string, string[]> {
  const raw = figma.currentPage.getPluginData("siteFlowTree");
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function saveTree(tree: Record<string, string[]>) {
  figma.currentPage.setPluginData("siteFlowTree", JSON.stringify(tree));
}

function loadCollapsed(): Record<string, boolean> {
  const raw = figma.currentPage.getPluginData("siteFlowCollapsed");
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function saveCollapsed(collapsed: Record<string, boolean>) {
  figma.currentPage.setPluginData("siteFlowCollapsed", JSON.stringify(collapsed));
}

async function getThumbnail(nodeId: string): Promise<Uint8Array | null> {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node || !("exportAsync" in node)) return null;
  try {
    return await (node as SceneNode & { exportAsync: Function }).exportAsync({
      format: "PNG",
      constraint: { type: "WIDTH", value: 520 },
    });
  } catch { return null; }
}

function subtreeWidth(
  nodeId: string,
  tree: Record<string, string[]>,
  collapsed: Record<string, boolean>
): number {
  const children = (!collapsed[nodeId] && tree[nodeId]) ? tree[nodeId] : [];
  if (children.length === 0) return CARD_W;
  const childWidths = children.map(c => subtreeWidth(c, tree, collapsed));
  const total = childWidths.reduce((a, b) => a + b, 0) + H_GAP * (children.length - 1);
  return Math.max(CARD_W, total);
}

async function placeNode(
  nodeId: string,
  cx: number,
  cy: number,
  tree: Record<string, string[]>,
  collapsed: Record<string, boolean>,
  cardMap: Record<string, FrameNode>,
  connectors: Array<[{x:number,y:number},{x:number,y:number}]>
): Promise<void> {
  const origin = await figma.getNodeByIdAsync(nodeId);
  if (!origin) return;

  const nodeIdDashed = nodeId.replace(":", "-");
  const url = `${BASE_URL}?node-id=${nodeIdDashed}`;

  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });

  const children = tree[nodeId] ?? [];
  const isCollapsed = collapsed[nodeId] ?? false;

  // ---- Card frame ----
  const card = figma.createFrame();
  card.name = `Flow: ${origin.name}`;
  card.resize(CARD_W, CARD_H);
  card.x = cx - CARD_W / 2;
  card.y = cy;
  card.fills = [{ type: "SOLID", color: { r: 0.98, g: 0.98, b: 1 } }];
  card.cornerRadius = 14;
  card.clipsContent = true;
  card.strokes = [{ type: "SOLID", color: { r: 0.88, g: 0.88, b: 0.94 } }];
  card.strokeWeight = 1;
  card.effects = [
    {
      type: "DROP_SHADOW",
      color: { r: 0, g: 0, b: 0, a: 0.1 },
      offset: { x: 0, y: 6 },
      radius: 20,
      spread: 0,
      visible: true,
      blendMode: "NORMAL",
    },
    {
      type: "DROP_SHADOW",
      color: { r: 0, g: 0, b: 0, a: 0.05 },
      offset: { x: 0, y: 1 },
      radius: 4,
      spread: 0,
      visible: true,
      blendMode: "NORMAL",
    },
  ];
  card.setPluginData("originFrameId", nodeId);
  card.setPluginData("flowUrl", url);

  // ---- Thumbnail background (light grey for letterbox areas) ----
  const thumbBg = figma.createRectangle();
  thumbBg.resize(CARD_W, THUMB_H);
  thumbBg.x = 0; thumbBg.y = 0;
  thumbBg.fills = [{ type: "SOLID", color: { r: 0.94, g: 0.94, b: 0.96 } }];
  card.appendChild(thumbBg);

  // ---- Thumbnail image ----
  const thumb = figma.createRectangle();
  thumb.resize(CARD_W, THUMB_H);
  thumb.x = 0; thumb.y = 0;
  thumb.fills = [{ type: "SOLID", color: { r: 0.94, g: 0.94, b: 0.96 } }];
  card.appendChild(thumb);

  // ---- Thin accent line between thumb and footer ----
  const divider = figma.createRectangle();
  divider.resize(CARD_W, 1);
  divider.x = 0; divider.y = THUMB_H;
  divider.fills = [{ type: "SOLID", color: { r: 0.86, g: 0.86, b: 0.92 } }];
  card.appendChild(divider);

  // ---- Footer background ----
  const footer = figma.createRectangle();
  footer.resize(CARD_W, FOOTER_H);
  footer.x = 0; footer.y = THUMB_H + 1;
  footer.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  card.appendChild(footer);

  // ---- Name label ----
  const labelMaxW = children.length > 0 ? CARD_W - 44 : CARD_W - 16;
  const label = figma.createText();
  label.fontName = { family: "Inter", style: "Medium" };
  label.characters = origin.name.length > 30 ? origin.name.slice(0, 28) + "…" : origin.name;
  label.fontSize = 12;
  label.resize(labelMaxW, 20);
  label.x = 12; label.y = THUMB_H + 10;
  label.fills = [{ type: "SOLID", color: { r: 0.08, g: 0.08, b: 0.12 } }];
  label.textAlignHorizontal = "LEFT";
  label.textAlignVertical = "CENTER";
  label.textTruncation = "ENDING";
  card.appendChild(label);

  // ---- URL label ----
  const shortUrl = `figma.com/…?node-id=${nodeId.replace(":", "-")}`;
  const urlLabel = figma.createText();
  urlLabel.fontName = { family: "Inter", style: "Regular" };
  urlLabel.characters = shortUrl.length > 36 ? shortUrl.slice(0, 34) + "…" : shortUrl;
  urlLabel.fontSize = 9;
  urlLabel.resize(CARD_W - 16, 16);
  urlLabel.x = 12; urlLabel.y = THUMB_H + 32;
  urlLabel.fills = [{ type: "SOLID", color: { r: 0.05, g: 0.58, b: 1 } }];
  urlLabel.textAlignHorizontal = "LEFT";
  urlLabel.textAlignVertical = "CENTER";
  card.appendChild(urlLabel);

  // ---- Collapse badge ----
  if (children.length > 0) {
    const badge = figma.createFrame();
    badge.resize(24, 24);
    badge.x = CARD_W - 36; badge.y = THUMB_H + 8;
    badge.cornerRadius = 12;
    badge.fills = [{ type: "SOLID", color: { r: 0.05, g: 0.58, b: 1 } }];
    badge.name = "collapse-badge";
    const badgeTxt = figma.createText();
    badgeTxt.fontName = { family: "Inter", style: "Medium" };
    badgeTxt.characters = isCollapsed ? "+" : "−";
    badgeTxt.fontSize = 14;
    badgeTxt.resize(24, 24);
    badgeTxt.textAlignHorizontal = "CENTER";
    badgeTxt.textAlignVertical = "CENTER";
    badgeTxt.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    badge.appendChild(badgeTxt);
    card.appendChild(badge);
  }

  figma.currentPage.appendChild(card);
  cardMap[nodeId] = card;

  // ---- Fill thumbnail (FIT = show full design without cropping) ----
  const bytes = await getThumbnail(nodeId);
  if (bytes) {
    const img = figma.createImage(bytes);
    thumb.fills = [{ type: "IMAGE", scaleMode: "FIT", imageHash: img.hash }];
  }

  // Place children
  const visibleChildren = isCollapsed ? [] : children;
  if (visibleChildren.length === 0) return;

  const childWidths = visibleChildren.map(c => subtreeWidth(c, tree, collapsed));
  const totalW = childWidths.reduce((a, b) => a + b, 0) + H_GAP * (visibleChildren.length - 1);
  let childX = cx - totalW / 2;
  const childY = cy + CARD_H + V_GAP + 40;

  for (let i = 0; i < visibleChildren.length; i++) {
    const cw = childWidths[i];
    const ccx = childX + cw / 2;
    connectors.push([{ x: cx, y: cy + CARD_H }, { x: ccx, y: childY }]);
    await placeNode(visibleChildren[i], ccx, childY, tree, collapsed, cardMap, connectors);
    childX += cw + H_GAP;
  }
}

function drawConnector(p1: {x:number,y:number}, p2: {x:number,y:number}): VectorNode {
  const line = figma.createVector();
  const midY = (p1.y + p2.y) / 2;
  line.vectorPaths = [{
    windingRule: "NONE",
    data: `M ${p1.x} ${p1.y} C ${p1.x} ${midY} ${p2.x} ${midY} ${p2.x} ${p2.y}`,
  }];
  line.strokes = [{ type: "SOLID", color: { r: 0.6, g: 0.7, b: 0.9 } }];
  line.strokeWeight = 2;
  line.fills = [];
  line.name = "FlowConnector";
  figma.currentPage.appendChild(line);
  return line;
}

function clearFlowElements() {
  const toRemove: SceneNode[] = [];
  for (const node of figma.currentPage.children) {
    if (node.name.startsWith("Flow: ") || node.name === "FlowConnector") {
      toRemove.push(node);
    }
  }
  for (const n of toRemove) n.remove();
}

async function generateMap(roots: string[], tree: Record<string, string[]>) {
  const collapsed = loadCollapsed();
  clearFlowElements();
  const cardMap: Record<string, FrameNode> = {};
  const connectors: Array<[{x:number,y:number},{x:number,y:number}]> = [];
  let startX = 200;
  for (const rootId of roots) {
    const w = subtreeWidth(rootId, tree, collapsed);
    await placeNode(rootId, startX + w / 2, 200, tree, collapsed, cardMap, connectors);
    startX += w + H_GAP * 2;
  }
  for (const [p1, p2] of connectors) drawConnector(p1, p2);
  const allCards = Object.values(cardMap);
  if (allCards.length > 0) figma.viewport.scrollAndZoomIntoView(allCards);
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === "scan") {
    const frames = scanFrames();
    const tree = loadTree();
    const collapsed = loadCollapsed();
    figma.ui.postMessage({ type: "scan-result", frames, tree, collapsed });
  }

  if (msg.type === "save-tree") {
    saveTree(msg.tree);
  }

  if (msg.type === "toggle-collapse") {
    const collapsed = loadCollapsed();
    collapsed[msg.nodeId] = !collapsed[msg.nodeId];
    saveCollapsed(collapsed);
    figma.ui.postMessage({ type: "collapsed-updated", collapsed });
  }

  if (msg.type === "generate") {
    saveTree(msg.tree);
    await generateMap(msg.roots, msg.tree);
    figma.notify("遷移図を生成しました！");
  }

  if (msg.type === "regenerate") {
    const tree = loadTree();
    await generateMap(msg.roots, tree);
    figma.notify("遷移図を再描画しました");
  }

  if (msg.type === "jump-to-design") {
    const node = await figma.getNodeByIdAsync(msg.nodeId);
    if (node && "x" in node) {
      figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
      figma.currentPage.selection = [node as SceneNode];
    }
  }

  if (msg.type === "link-canvas-node") {
    const sel = figma.currentPage.selection;
    if (!sel.length) return;
    sel[0].setPluginData("linkedDesignId", msg.targetId as string);
    const linked = await figma.getNodeByIdAsync(msg.targetId as string);
    figma.notify(`"${linked?.name ?? msg.targetId}" をリンクしました ✓`);
    await pushCanvasSelection();
    return;
  }

  if (msg.type === "unlink-canvas-node") {
    const sel = figma.currentPage.selection;
    if (!sel.length) return;
    sel[0].setPluginData("linkedDesignId", "");
    sel[0].setPluginData("originFrameId", "");
    figma.notify("リンクを解除しました");
    await pushCanvasSelection();
    return;
  }

  if (msg.type === "get-thumbnail") {
    const node = await figma.getNodeByIdAsync(msg.nodeId);
    if (!node || !("exportAsync" in node)) {
      figma.ui.postMessage({ type: "thumbnail-result", nodeId: msg.nodeId, bytes: null });
      return;
    }
    try {
      const bytes = await (node as SceneNode & {
        exportAsync: (o: object) => Promise<Uint8Array>;
      }).exportAsync({ format: "PNG", constraint: { type: "WIDTH", value: 480 } });
      figma.ui.postMessage({ type: "thumbnail-result", nodeId: msg.nodeId, bytes: Array.from(bytes) });
    } catch {
      figma.ui.postMessage({ type: "thumbnail-result", nodeId: msg.nodeId, bytes: null });
    }
  }
};

// ── Selection change → show canvas node preview ──────────────────────────
async function pushCanvasSelection() {
  const sel = figma.currentPage.selection;
  if (sel.length === 0) {
    figma.ui.postMessage({ type: "canvas-selection", selNodeId: null });
    return;
  }
  const node = sel[0];
  const originId = node.getPluginData("originFrameId") || null;
  const linkedId = node.getPluginData("linkedDesignId") || null;
  const targetId = originId || linkedId;

  // Always report the selected node so UI can offer linking
  if (!targetId) {
    figma.ui.postMessage({
      type: "canvas-selection",
      selNodeId: node.id,
      selNodeName: node.name,
      linkedId: null,
      bytes: null,
    });
    return;
  }

  const target = await figma.getNodeByIdAsync(targetId);
  if (!target) {
    node.setPluginData("linkedDesignId", "");
    figma.ui.postMessage({
      type: "canvas-selection",
      selNodeId: node.id,
      selNodeName: node.name,
      linkedId: null,
      bytes: null,
    });
    return;
  }

  let bytes: number[] | null = null;
  if ("exportAsync" in target) {
    try {
      const raw = await (target as SceneNode & {
        exportAsync: (o: object) => Promise<Uint8Array>;
      }).exportAsync({ format: "PNG", constraint: { type: "WIDTH", value: 600 } });
      bytes = Array.from(raw);
    } catch { /* skip */ }
  }

  figma.ui.postMessage({
    type: "canvas-selection",
    selNodeId: node.id,
    selNodeName: node.name,
    linkedId: targetId,
    linkedName: target.name,
    bytes,
  });
}

figma.on("selectionchange", () => { pushCanvasSelection(); });

(async () => {
  const frames = scanFrames();
  const tree = loadTree();
  const collapsed = loadCollapsed();
  figma.ui.postMessage({ type: "scan-result", frames, tree, collapsed });
  await pushCanvasSelection();
})();
