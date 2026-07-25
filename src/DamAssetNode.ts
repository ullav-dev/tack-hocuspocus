import { Node, mergeAttributes } from "@tiptap/core";

/**
 * Schema-only duplicate of `tack`'s `src/tiptap/DamAssetNode.ts` -- this
 * service only ever *reads* Yjs documents (to derive `content_markdown`,
 * see `markdown.ts`), never edits them, so it needs the same node schema
 * (name/attrs/parseHTML/renderHTML) to reconstruct/serialize a page's
 * content correctly, but not the `insertDamAsset` command tack's frontend
 * adds on top of it. Intentionally duplicated rather than shared across
 * repos (no shared package exists for this yet, matching this org's
 * established per-repo-copy convention elsewhere, e.g. `packages/dam-picker`)
 * -- if the frontend's node schema ever changes, this must be updated to
 * match, or derived markdown will silently drop/mis-render DAM images.
 */
const DamAssetNode = Node.create({
  name: "damAsset",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "img[data-dam-asset]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes, { "data-dam-asset": "true", class: "rounded-lg max-w-full" })];
  },
});

export default DamAssetNode;
