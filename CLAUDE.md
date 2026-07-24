# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**tack-hocuspocus** is the self-hosted [Hocuspocus](https://tiptap.dev/docs/hocuspocus) real-time Yjs sync server for [Tack](https://github.com/ullav-dev/tack-server)'s Pages content type — see `tack-server/CLAUDE.md`'s "Pages" section and `/Users/colin/github/CLAUDE.md` for full platform context.

This is Pages step 8b (of the plan's implementation sequencing): tack-server's Pages schema/CRUD/ACL (step 8a) already exists and treats page content as plain markdown written through its REST API. This service adds real-time collaborative editing on top — TipTap's collaborative editing stack (Yjs CRDT + Hocuspocus sync server), which is what TipTap itself supports in production, rather than an unsupported custom sync layer.

This is the **first non-Rust, non-Next.js backend service** in this org. Node/TypeScript was chosen because Hocuspocus is the reference-implementation Yjs sync server for TipTap (the editor already used elsewhere in this platform), not reimplemented from scratch in Rust — a `yrs`-based Rust reimplementation would be a much larger, riskier undertaking than adopting the maintained upstream server.

## Architecture

- **Framework:** `@hocuspocus/server` v4 (Node 22+; the WebSocket/real-time sync engine). No web framework (Express/Fastify) — Hocuspocus's `onRequest` hook handles the one plain-HTTP route needed (`GET /health`) directly.
- **Auth is delegated, never reimplemented here.** `src/auth.ts`'s `resolvePermission` forwards the connecting client's own bearer token (never a service-to-service credential — the caller only ever gets exactly what tack-server would grant them directly) to tack-server's `GET /pages/{id}/permission` endpoint. The `onAuthenticate` hook in `src/index.ts` sets `connectionConfig.readOnly = level !== 'edit'`, and throws (rejecting the connection outright) if tack-server returns 403/404. This keeps `src/pages_acl.rs`'s live ancestor/space-fallback ACL algorithm as the single source of truth — exactly the same principle that already keeps tack-server's own REST and MCP surfaces from duplicating (and drifting on) that logic. **Do not reimplement permission resolution here in TypeScript** even if it looks like it'd save a network hop; that was an explicit decision, not an oversight.
- **Persistence is direct to Postgres**, not through tack-server's API. `src/db.ts` opens its own `pg.Pool` against the same `DATABASE_URL` tack-server uses, reading/writing only `page_docs.yjs_doc_state` — this mirrors `tack-indexer`'s existing pattern (a second process with direct DB access alongside the API server), not a new architectural pattern for this platform. `page_docs` is hash-partitioned by `organization_id` in Postgres, but queries here filter on `page_id` alone (a WebSocket connection only knows the Yjs `documentName`, which is the page id) — Postgres satisfies this by scanning across partitions, an acceptable trade-off since a collaborative-editing session is opened once per document, not a high-QPS path.
- **`onLoadDocument`** returns the stored `yjs_doc_state` bytes, or `undefined` if the page has never been opened in the collaborative editor before (any page created only through tack-server's plain-markdown REST API starts with a `NULL` `yjs_doc_state`). Hocuspocus then starts that document from an empty Y.Doc.
  - **Known, deliberate gap**: existing `content_markdown` is *not* auto-imported into the Yjs doc the first time a page is opened collaboratively — the page starts blank in the editor even if it has markdown content from the REST-only era. A markdown→Yjs importer (using `y-prosemirror`'s document conversion helpers) is real, separate scope, deferred to a follow-up, not silently broken behavior — flag this clearly to anyone building the frontend integration.
- **`onStoreDocument`** encodes the current state via `Y.encodeStateAsUpdate(document)` and `UPDATE`s (never inserts — every page's `page_docs` row already exists, created transactionally by tack-server at page-creation time) `page_docs.yjs_doc_state`. Debounced by Hocuspocus itself; safe to throw on failure (Hocuspocus keeps the document in memory and retries).
- **Not yet done in this pass** (explicit follow-ups): deriving `page_docs.content_markdown` from the Yjs state on save (so `GET /pages/:id` and search indexing see live content — currently `content_markdown` only reflects whatever was last written through the plain REST API, and silently goes stale once a page is edited collaboratively); the actual TipTap frontend wiring (`@tiptap/extension-collaboration` + `@hocuspocus/provider` in the `tack` repo); indexing page content into OpenSearch via the outbox worker.

## Configuration

All from environment (`.env` locally, loaded via `dotenv`): `DATABASE_URL` (required), `TACK_SERVER_URL` (default `http://localhost:8087`), `HOST` (default `0.0.0.0`), `PORT` (default `8088`).

## Verification

Verified live end-to-end against real Postgres + a real running `tack-server`: real space/page created via tack-server's REST API; two independent Yjs clients (using `@hocuspocus/provider`) proved both real-time sync (an edit from one client is observed by another, already-connected client, without reconnecting) and persistence (a fresh third client, connecting after the first two disconnected, saw the persisted content — confirmed directly in Postgres, `page_docs.yjs_doc_state` populated with real bytes). Also verified the read-only enforcement path with a **genuinely separate, freshly created non-admin user**: restricted a page to `view`-only for that user via tack-server's `POST /pages/{id}/permissions`, connected a Hocuspocus client with that user's real JWT, confirmed the connection authenticated but a write from that client was silently rejected (Postgres content unchanged), while an admin's write to the same document persisted normally. Also ran the full sequence again against the actual built Docker image (not just local `npm run dev`), which built and ran cleanly on the first attempt (small dependency graph — no native/C++ deps, unlike tack-server's `fastembed`, so none of that repo's Docker gotchas apply here).

## Branch Policy

Feature branches merge to `main` via PR; do not commit directly to `main` (this repo's `main` has exactly one sanctioned exception: the initial bootstrap commit for the brand-new empty repo).
