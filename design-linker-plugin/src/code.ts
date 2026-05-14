// Design Linker - Plugin Backend

figma.showUI(__html__, { width: 400, height: 720, title: "Design Linker" });

const LINK_KEY = "linkedDesignId";
const FILE_KEY = figma.fileKey ?? "";
const BASE_URL = `https://www.figma.com/design/${FILE_KEY}`;

type Frame = { id: string; name: string; url: string };

function scanFrames(): Frame[] {
  const frames: Frame[] = [];
  function collect(node: SceneNode) {
    const nodeId = node.id.replace(":", "-");
    if (
      node.type === "FRAME" ||
      node.type === "COMPONENT" ||
      node.type === "COMPONENT_SET"
    ) {
      frames.push({
        id: node.id,
        name: node.name,
        url: `${BASE_URL}?node-id=${nodeId}`,
      });
    }
    if ("children" in node) {
      for (const child of (node as ChildrenMixin).children) {
        collect(child as SceneNode);
      }
    }
  }
  for (const child of figma.currentPage.children) collect(child);
  return frames;
}

async function exportThumbnail(node: BaseNode): Promise<Uint8Array | null> {
  if (!("exportAsync" in node)) return null;
  try {
    return await (node as SceneNode & {
      exportAsync: (opts: object) => Promise<Uint8Array>;
    }).exportAsync({ format: "PNG", constraint: { type: "WIDTH", value: 800 } });
  } catch {
    return null;
  }
}

async function pushSelectionUpdate() {
  const sel = figma.currentPage.selection;

  if (sel.length === 0) {
    figma.ui.postMessage({
      type: "selection-update",
      nodeName: null,
      nodeType: null,
      linkedId: null,
      linkedName: null,
      previewBytes: null,
    });
    return;
  }

  const node = sel[0];
  const linkedId = node.getPluginData(LINK_KEY) || null;

  let linkedName: string | null = null;
  let previewBytes: number[] | null = null;

  if (linkedId) {
    const linked = await figma.getNodeByIdAsync(linkedId);
    if (linked) {
      linkedName = linked.name;
      const bytes = await exportThumbnail(linked);
      if (bytes) previewBytes = Array.from(bytes);
    } else {
      node.setPluginData(LINK_KEY, "");
    }
  }

  figma.ui.postMessage({
    type: "selection-update",
    nodeName: node.name,
    nodeType: node.type,
    linkedId,
    linkedName,
    previewBytes,
  });
}

async function stampToCanvas(linkedId: string) {
  const sel = figma.currentPage.selection;
  if (!sel.length) {
    figma.notify("オブジェクトを選択してください");
    return;
  }

  const linkedNode = await figma.getNodeByIdAsync(linkedId);
  if (!linkedNode) {
    figma.notify("リンク先フレームが見つかりません");
    return;
  }

  const anchor = sel[0] as SceneNode & {
    x: number; y: number; width: number; height: number;
  };

  const STAMP_W = 260;
  const THUMB_H = 180;
  const FOOTER_H = 36;

  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });

  const card = figma.createFrame();
  card.name = `🔗 ${linkedNode.name}`;
  card.resize(STAMP_W, THUMB_H + FOOTER_H);
  card.x = anchor.x + anchor.width + 24;
  card.y = anchor.y;
  card.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  card.cornerRadius = 10;
  card.clipsContent = true;
  card.strokes = [{ type: "SOLID", color: { r: 0.8, g: 0.85, b: 0.95 } }];
  card.strokeWeight = 1;
  card.effects = [
    {
      type: "DROP_SHADOW",
      color: { r: 0, g: 0, b: 0, a: 0.12 },
      offset: { x: 0, y: 6 },
      radius: 20,
      spread: 0,
      visible: true,
      blendMode: "NORMAL",
    },
  ];

  // Thumbnail area
  const thumb = figma.createRectangle();
  thumb.resize(STAMP_W, THUMB_H);
  thumb.x = 0; thumb.y = 0;
  thumb.fills = [{ type: "SOLID", color: { r: 0.94, g: 0.95, b: 0.97 } }];
  card.appendChild(thumb);

  const bytes = await exportThumbnail(linkedNode);
  if (bytes) {
    const img = figma.createImage(bytes);
    thumb.fills = [{ type: "IMAGE", scaleMode: "FIT", imageHash: img.hash }];
  }

  // Divider
  const divider = figma.createRectangle();
  divider.resize(STAMP_W, 1);
  divider.x = 0; divider.y = THUMB_H;
  divider.fills = [{ type: "SOLID", color: { r: 0.88, g: 0.9, b: 0.95 } }];
  card.appendChild(divider);

  // Footer
  const footer = figma.createRectangle();
  footer.resize(STAMP_W, FOOTER_H - 1);
  footer.x = 0; footer.y = THUMB_H + 1;
  footer.fills = [{ type: "SOLID", color: { r: 0.98, g: 0.98, b: 1 } }];
  card.appendChild(footer);

  // Link icon text
  const icon = figma.createText();
  icon.fontName = { family: "Inter", style: "Regular" };
  icon.characters = "🔗";
  icon.fontSize = 11;
  icon.x = 9; icon.y = THUMB_H + 9;
  card.appendChild(icon);

  // Label
  const label = figma.createText();
  label.fontName = { family: "Inter", style: "Medium" };
  const raw = linkedNode.name;
  label.characters = raw.length > 26 ? raw.slice(0, 24) + "…" : raw;
  label.fontSize = 11;
  label.resize(STAMP_W - 36, 18);
  label.x = 28; label.y = THUMB_H + 9;
  label.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.18 } }];
  label.textAlignVertical = "CENTER";
  card.appendChild(label);

  figma.currentPage.appendChild(card);
  figma.viewport.scrollAndZoomIntoView([card]);
  figma.notify(`プレビューカードをカンバスに貼り付けました ✓`);
}

figma.on("selectionchange", () => {
  pushSelectionUpdate();
});

figma.ui.onmessage = async (msg) => {
  if (msg.type === "scan") {
    figma.ui.postMessage({ type: "scan-result", frames: scanFrames() });
    return;
  }

  if (msg.type === "link") {
    const sel = figma.currentPage.selection;
    if (!sel.length) {
      figma.notify("オブジェクトを選択してから「リンク」を押してください");
      return;
    }
    sel[0].setPluginData(LINK_KEY, msg.targetId as string);
    const linked = await figma.getNodeByIdAsync(msg.targetId as string);
    figma.notify(`"${linked?.name ?? msg.targetId}" をリンクしました ✓`);
    await pushSelectionUpdate();
    return;
  }

  if (msg.type === "unlink") {
    const sel = figma.currentPage.selection;
    if (!sel.length) return;
    sel[0].setPluginData(LINK_KEY, "");
    figma.notify("リンクを解除しました");
    await pushSelectionUpdate();
    return;
  }

  if (msg.type === "jump") {
    const node = await figma.getNodeByIdAsync(msg.nodeId as string);
    if (node && "x" in node) {
      figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
      figma.currentPage.selection = [node as SceneNode];
    }
    return;
  }

  if (msg.type === "stamp") {
    await stampToCanvas(msg.linkedId as string);
    return;
  }
};

(async () => {
  figma.ui.postMessage({ type: "scan-result", frames: scanFrames() });
  await pushSelectionUpdate();
})();
