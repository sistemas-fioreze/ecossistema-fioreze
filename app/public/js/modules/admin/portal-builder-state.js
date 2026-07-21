export function deleteVisualBlock(document, blockId) {
  const index = blockIndex(document, blockId);
  if (index < 0) return { changed: false, selectedId: blockId, removed: null };
  const [removed] = document.blocks.splice(index, 1);
  return {
    changed: true,
    removed,
    selectedId: document.blocks[index]?.id || document.blocks[index - 1]?.id || null,
  };
}

export function duplicateVisualBlock(document, blockId, nextId) {
  const index = blockIndex(document, blockId);
  if (index < 0) return { changed: false, selectedId: blockId, block: null };
  const block = structuredClone(document.blocks[index]);
  block.id = nextId;
  document.blocks.splice(index + 1, 0, block);
  return { changed: true, selectedId: block.id, block };
}

export function moveVisualBlock(document, blockId, delta) {
  const index = blockIndex(document, blockId);
  const next = index + delta;
  if (index < 0 || next < 0 || next >= document.blocks.length) {
    return { changed: false, selectedId: blockId };
  }
  const [block] = document.blocks.splice(index, 1);
  document.blocks.splice(next, 0, block);
  return { changed: true, selectedId: block.id };
}

export function reorderVisualBlock(document, blockId, targetIndex) {
  const index = blockIndex(document, blockId);
  if (index < 0) return { changed: false, selectedId: blockId };
  const boundedTarget = Math.max(0, Math.min(Number(targetIndex), document.blocks.length));
  const adjusted = index < boundedTarget ? boundedTarget - 1 : boundedTarget;
  if (adjusted === index) return { changed: false, selectedId: blockId };
  const [block] = document.blocks.splice(index, 1);
  document.blocks.splice(adjusted, 0, block);
  return { changed: true, selectedId: block.id };
}

function blockIndex(document, blockId) {
  return document?.blocks?.findIndex((block) => block.id === blockId) ?? -1;
}
