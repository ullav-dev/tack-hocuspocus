import { Node, mergeAttributes } from "@tiptap/core";

/**
 * Schema-only duplicate of `tack`'s `src/tiptap/PageReferenceNode.ts` --
 * same rationale as `DamAssetNode.ts` in this file: this service only
 * *reads* Yjs documents to derive `content_markdown`, so it needs the node's
 * schema (name/attrs/parseHTML/renderHTML) but not the frontend's
 * `insertPageReference` command. If the frontend's node schema changes,
 * this must be updated to match, or derived markdown will silently
 * drop/mis-render page references.
 */
const PageReferenceNode = Node.create({
  name: "pageReference",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      pageId: { default: null },
      spaceId: { default: null },
      title: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-page-reference]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        "data-page-reference": "true",
        href: `/spaces/${node.attrs.spaceId}/pages/${node.attrs.pageId}`,
      }),
      node.attrs.title || "Untitled page",
    ];
  },
});

export default PageReferenceNode;
