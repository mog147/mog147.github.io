// Interactive Product Mapper - Backend

figma.showUI(__html__, { width: 320, height: 500, title: "Product Mapper Pro" });

// 選択変更を監視
figma.on("selectionchange", async () => {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 1) {
    const node = selection[0];
    const originId = node.getPluginData("originFrameId");
    
    if (originId) {
      const originNode = figma.getNodeById(originId);
      if (originNode && "exportAsync" in originNode) {
        await sendPreview(originNode as SceneNode);
      }
    } else if ("exportAsync" in node) {
      await sendPreview(node as SceneNode);
    }
  }
});

// UIからのメッセージを処理
figma.ui.onmessage = async (msg) => {
  if (msg.type === "add-to-map") {
    const selection = figma.currentPage.selection;
    if (selection.length !== 1) {
      figma.notify("紐づけるデザインを選択してください。");
      return;
    }

    const originNode = selection[0];
    if (!("exportAsync" in originNode)) {
      figma.notify("書き出し可能な要素を選択してください。");
      return;
    }

    const mapNode = await createMapNode(originNode);
    mapNode.x = originNode.x + originNode.width + 200;
    mapNode.y = originNode.y;

    figma.notify("マップカードを生成しました。");
  }

  if (msg.type === "jump-to-design") {
    const node = figma.getNodeById(msg.originId);
    if (node && "x" in node) {
      figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
      figma.currentPage.selection = [node as SceneNode];
    }
  }
};

async function createMapNode(originNode: SceneNode): Promise<FrameNode> {
  const mapNode = figma.createFrame();
  mapNode.name = `Map: ${originNode.name}`;
  mapNode.resize(160, 100);
  mapNode.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  mapNode.cornerRadius = 12;
  mapNode.effects = [{
    type: "DROP_SHADOW",
    color: { r: 0, g: 0, b: 0, a: 0.1 },
    offset: { x: 0, y: 4 },
    radius: 12,
    visible: true,
    blendMode: "NORMAL"
  }];
  
  const label = figma.createText();
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  label.characters = originNode.name;
  label.fontSize = 12;
  label.textAlignHorizontal = "CENTER";
  label.textAlignVertical = "CENTER";
  mapNode.appendChild(label);
  label.resize(140, 80);
  label.x = 10;
  label.y = 10;

  mapNode.setPluginData("originFrameId", originNode.id);
  return mapNode;
}

async function sendPreview(node: SceneNode) {
  try {
    const bytes = await node.exportAsync({
      format: "PNG",
      constraint: { type: "SCALE", value: 1.5 }
    });
    figma.ui.postMessage({ 
      type: "preview-bytes", 
      bytes: bytes, 
      name: node.name,
      id: node.id 
    });
  } catch (e) {
    console.error("Preview export failed", e);
  }
}
