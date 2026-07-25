import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { TiptapTransformer } from "@hocuspocus/transformer";
import StarterKit from "@tiptap/starter-kit";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import DamAssetNode from "./DamAssetNode.js";
import { deriveMarkdown } from "./markdown.js";

const extensions = [StarterKit, Table, TableRow, TableHeader, TableCell, DamAssetNode];

function ydocFromJson(json: Record<string, unknown>): Y.Doc {
  return TiptapTransformer.extensions(extensions).toYdoc(json, "default", extensions);
}

describe("deriveMarkdown", () => {
  it("returns an empty string for a never-edited document", () => {
    expect(deriveMarkdown(new Y.Doc())).toBe("");
  });

  it("renders headings, bold text, and bullet lists", () => {
    const ydoc = ydocFromJson({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Title" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hello " },
            { type: "text", marks: [{ type: "bold" }], text: "world" },
          ],
        },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "one" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "two" }] }] },
          ],
        },
      ],
    });

    const markdown = deriveMarkdown(ydoc);
    expect(markdown).toContain("# Title");
    expect(markdown).toContain("**world**");
    // turndown pads list-item continuation lines to a fixed 4-char indent
    // regardless of marker length (its own documented default, not a bug
    // here) -- assert on the marker + item text, not exact spacing.
    expect(markdown).toMatch(/^- {1,3}one$/m);
    expect(markdown).toMatch(/^- {1,3}two$/m);
  });

  it("renders a table (via the gfm turndown plugin)", () => {
    const ydoc = ydocFromJson({
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "A" }] }] },
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "B" }] }] },
              ],
            },
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "1" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "2" }] }] },
              ],
            },
          ],
        },
      ],
    });

    const markdown = deriveMarkdown(ydoc);
    expect(markdown).toContain("| A | B |");
    expect(markdown).toContain("| 1 | 2 |");
  });

  it("renders a damAsset node as a markdown image link", () => {
    const ydoc = ydocFromJson({
      type: "doc",
      content: [{ type: "damAsset", attrs: { src: "http://localhost:8087/api/dam/assets/x/thumbnail", alt: "photo" } }],
    });

    const markdown = deriveMarkdown(ydoc);
    expect(markdown).toBe("![photo](http://localhost:8087/api/dam/assets/x/thumbnail)");
  });
});
