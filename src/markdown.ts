import * as Y from "yjs";
import { TiptapTransformer } from "@hocuspocus/transformer";
import { generateHTML } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import DamAssetNode from "./DamAssetNode.js";
import PageReferenceNode from "./PageReferenceNode.js";

// Must match the extensions actually registered on the frontend editor
// (tack/src/components/PageEditor.tsx) closely enough to reconstruct the
// same node/mark structure -- CollaborationCaret and the Markdown extension
// itself don't affect document *shape* so they're not needed here, but
// StarterKit/Table/DamAssetNode/PageReferenceNode do.
const extensions = [StarterKit, Table, TableRow, TableHeader, TableCell, DamAssetNode, PageReferenceNode];

// Yjs -> ProseMirror JSON -> HTML -> Markdown, rather than driving a full
// Tiptap Editor instance server-side (which needs a live DOM/view, not just
// a schema) -- `@hocuspocus/transformer` and `@tiptap/html` are the
// documented, DOM-light (happy-dom, not a real browser) way to go from a
// Yjs doc to HTML outside a browser. `turndown` (+ its gfm plugin, for
// tables/strikethrough/task lists, which plain turndown doesn't handle)
// converts that HTML to Markdown -- a different path than tack frontend's
// own Markdown export (tiptap-markdown, which reads off a live Editor
// instance), but the last leg of any TipTap-JSON-to-Markdown pipeline
// unavoidably reimplements the same serialization rules somewhere; this
// keeps that logic in one well-maintained third-party library rather than
// hand-rolling a ProseMirror-node-to-Markdown walker here.
const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  // Matches the convention already used elsewhere for hand-authored
  // markdown in this app (tack/src/components/MarkdownToolbar.tsx's own
  // bullet-list button inserts "- "), rather than turndown's own default
  // ("*").
  bulletListMarker: "-",
});
turndownService.use(gfm);
turndownService.addRule("tableCellParagraph", {
  // TipTap's Table extension always wraps a cell's content in a <p>, and
  // turndown's default paragraph rule surrounds it with blank lines --
  // fine for a document, but that literally breaks the one-line-per-row
  // markdown table syntax turndown-plugin-gfm's own table rule produces.
  // Only strip the wrapping inside td/th; a normal paragraph elsewhere in
  // the document is untouched.
  filter: (node) => node.nodeName === "P" && (node.parentNode?.nodeName === "TD" || node.parentNode?.nodeName === "TH"),
  replacement: (content) => content,
});
turndownService.addRule("damAsset", {
  filter: (node) => node.nodeName === "IMG" && node.hasAttribute("data-dam-asset"),
  replacement: (_content, node) => {
    const el = node as unknown as { getAttribute(name: string): string | null };
    const alt = el.getAttribute("alt") ?? "";
    const src = el.getAttribute("src") ?? "";
    return `![${alt}](${src})`;
  },
});
turndownService.addRule("pageReference", {
  filter: (node) => node.nodeName === "A" && node.hasAttribute("data-page-reference"),
  replacement: (_content, node) => {
    const el = node as unknown as { getAttribute(name: string): string | null; textContent: string | null };
    const href = el.getAttribute("href") ?? "";
    const title = el.textContent || "Untitled page";
    return `[${title}](${href})`;
  },
});

/** Derives the current Markdown representation of a page's Yjs document --
 * the `content_markdown` "derived projection" migration 004_pages.sql's own
 * comment describes and defers until Hocuspocus exists. An empty/never-
 * edited document (fresh Y.Doc, no `default` XmlFragment content yet)
 * produces an empty string, not an error. */
export function deriveMarkdown(ydoc: Y.Doc): string {
  const json = TiptapTransformer.extensions(extensions).fromYdoc(ydoc, "default");
  // TipTap's Table extension always renders a <colgroup> (column-width
  // hints only, no semantic content -- markdown tables have no equivalent
  // anyway) before <tbody>. turndown-plugin-gfm's heading-row detection
  // requires the first <tbody> to have no preceding sibling other than an
  // empty <thead>; a <colgroup> in between makes it silently treat the
  // whole table as "no heading row" and fall back to keeping raw HTML
  // instead of converting it. Stripping it is a safe, silent-content-loss-
  // free fix, not a workaround for anything markdown-meaningful.
  const html = generateHTML(json, extensions).replace(/<colgroup>[\s\S]*?<\/colgroup>/g, "");
  return turndownService.turndown(html).trim();
}
