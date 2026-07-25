// No @types package exists for turndown-plugin-gfm -- minimal ambient
// declaration for just the one export (`gfm`) this service actually uses
// (table/strikethrough/task-list conversion rules, which plain turndown
// doesn't handle on its own).
declare module "turndown-plugin-gfm" {
  import type TurndownService from "turndown";

  export function gfm(service: TurndownService): void;
}
