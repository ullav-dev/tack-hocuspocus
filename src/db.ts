import pg from "pg";

const { Pool } = pg;

/**
 * Direct Postgres access, mirroring tack-server's own `tack-indexer` binary:
 * a second process with its own connection pool to the same database,
 * reading/writing only the one table it owns responsibility for
 * (`page_docs.yjs_doc_state`). This is not a new architectural pattern for
 * this codebase — outbox/CDC already establishes "more than one process
 * talks to Postgres directly" as normal here.
 *
 * `page_docs` is hash-partitioned by `organization_id` (see
 * tack-server/migrations/004_pages.sql), but a Hocuspocus connection only
 * knows the page id (the Yjs `documentName`), not its organization —
 * queries here filter on `page_id` alone, which Postgres satisfies by
 * scanning across partitions. That's an acceptable trade-off: a real-time
 * sync connection is opened once per document-editing session, not a
 * high-QPS path worth partition-pruning for.
 */
export function createPool(databaseUrl: string): pg.Pool {
  return new Pool({ connectionString: databaseUrl });
}

/**
 * Loads a page's stored Yjs document state, or `undefined` if the page has
 * never been saved through the collaborative editor yet (a page created
 * only through the plain-markdown REST API starts with a `NULL`
 * `yjs_doc_state` — see tack-server's CLAUDE.md "Pages" section). Hocuspocus
 * then starts that document from an empty state; migrating existing
 * markdown content into the Yjs doc on first open is a deliberate,
 * documented gap in this pass, not silently-wrong behavior.
 */
export async function loadDocState(pool: pg.Pool, pageId: string): Promise<Uint8Array | undefined> {
  const result = await pool.query<{ yjs_doc_state: Buffer | null }>(
    "SELECT yjs_doc_state FROM page_docs WHERE page_id = $1",
    [pageId],
  );
  const row = result.rows[0];
  if (!row || row.yjs_doc_state === null) {
    return undefined;
  }
  return new Uint8Array(row.yjs_doc_state);
}

/**
 * Persists a page's current Yjs document state, and (if markdown
 * derivation in `markdown.ts` succeeded) the Markdown derived from it into
 * `page_docs.content_markdown` -- the "derived projection" `content_markdown`
 * becomes once Hocuspocus exists, per migration 004_pages.sql's own comment.
 * `markdown: null` (derivation failed/threw) leaves the existing
 * `content_markdown` value alone via `COALESCE` -- persisting the Yjs
 * state is the actually-critical write here, and a transient derivation
 * failure must never clobber the last-known-good markdown with an empty
 * string. One `UPDATE` (not two separate ones), so both columns land in
 * the same statement/`updated_at`. Always an `UPDATE`, never an insert —
 * every page's `page_docs` row is created transactionally by tack-server
 * at page-creation time, before this service is ever involved.
 */
export async function storeDocument(
  pool: pg.Pool,
  pageId: string,
  state: Uint8Array,
  markdown: string | null,
): Promise<void> {
  await pool.query(
    "UPDATE page_docs SET yjs_doc_state = $1, content_markdown = COALESCE($2, content_markdown), updated_at = NOW() WHERE page_id = $3",
    [Buffer.from(state), markdown, pageId],
  );
}
