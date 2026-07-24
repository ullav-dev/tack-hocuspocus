import "dotenv/config";
import { Server } from "@hocuspocus/server";
import * as Y from "yjs";

import { loadConfig } from "./config.js";
import { createPool, loadDocState, storeDocState } from "./db.js";
import { PermissionDeniedError, resolvePermission } from "./auth.js";

const config = loadConfig();
const pool = createPool(config.databaseUrl);

interface ConnectionContext {
  token: string;
}

const server = new Server({
  port: config.port,
  address: config.host,

  onRequest({ request, response }) {
    return new Promise<void>((resolve, reject) => {
      if (request.url === "/health") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ status: "ok" }));
        reject();
        return;
      }
      resolve();
    });
  },

  // Delegates to tack-server's live-resolved page ACL (src/pages_acl.rs) —
  // see src/auth.ts for why this isn't reimplemented here. `documentName`
  // is the page id: the TipTap collaboration provider is configured with
  // `document: pageId` on the frontend.
  async onAuthenticate(data) {
    const { token, documentName, connectionConfig } = data;
    if (!token) {
      throw new Error("Missing auth token");
    }

    try {
      const level = await resolvePermission(config.tackServerUrl, documentName, token);
      connectionConfig.readOnly = level !== "edit";
    } catch (error) {
      if (error instanceof PermissionDeniedError) {
        throw new Error("You don't have access to this page.");
      }
      throw error;
    }

    return { token } satisfies ConnectionContext;
  },

  // Hydrates the Y.Doc from Postgres. Returning `undefined` (no stored
  // state yet -- see db.ts) leaves Hocuspocus to start from a fresh, empty
  // document rather than erroring.
  async onLoadDocument({ documentName }) {
    return loadDocState(pool, documentName);
  },

  // Persists the current document state on every (debounced) change.
  // Throwing here is safe -- Hocuspocus keeps the document in memory and
  // retries, per its own documented behavior.
  async onStoreDocument({ documentName, document }) {
    const state = Y.encodeStateAsUpdate(document);
    await storeDocState(pool, documentName, state);
  },
});

server.listen();

// eslint-disable-next-line no-console
console.log(`tack-hocuspocus listening on ${config.host}:${config.port}`);
