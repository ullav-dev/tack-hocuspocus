/**
 * Delegates permission resolution to tack-server's `GET /pages/{id}/permission`
 * rather than reimplementing the ancestor/space-fallback ACL algorithm here
 * in TypeScript. `src/pages_acl.rs` (in tack-server) stays the single source
 * of truth for "who can view/edit this page" — exactly the same principle
 * that already keeps tack-server's own REST and MCP surfaces from
 * duplicating (and potentially drifting on) that logic.
 */

export type PermissionLevel = "view" | "edit";

export class PermissionDeniedError extends Error {}

/**
 * Resolves the caller's effective permission on a page by forwarding their
 * own bearer token to tack-server — the caller is never impersonated by a
 * service-to-service credential; access is exactly what tack-server would
 * grant them directly.
 */
export async function resolvePermission(
  tackServerUrl: string,
  pageId: string,
  token: string,
): Promise<PermissionLevel> {
  const response = await fetch(`${tackServerUrl}/pages/${pageId}/permission`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 403 || response.status === 404) {
    throw new PermissionDeniedError(`No access to page ${pageId}`);
  }
  if (!response.ok) {
    throw new Error(`tack-server returned ${response.status} resolving permission for page ${pageId}`);
  }

  const body = (await response.json()) as { level: PermissionLevel };
  return body.level;
}
