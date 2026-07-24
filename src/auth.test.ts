import { describe, expect, it, vi, afterEach } from "vitest";
import { PermissionDeniedError, resolvePermission } from "./auth.js";

describe("resolvePermission", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(status: number, body: unknown) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status,
        ok: status >= 200 && status < 300,
        json: async () => body,
      }),
    );
  }

  it("forwards the caller's own bearer token, not a service credential", async () => {
    stubFetch(200, { level: "edit" });
    await resolvePermission("http://tack-server.local", "page-1", "the-users-token");
    expect(fetch).toHaveBeenCalledWith(
      "http://tack-server.local/pages/page-1/permission",
      expect.objectContaining({ headers: { Authorization: "Bearer the-users-token" } }),
    );
  });

  it("returns the level tack-server grants", async () => {
    stubFetch(200, { level: "view" });
    await expect(resolvePermission("http://tack-server.local", "page-1", "token")).resolves.toBe("view");
  });

  it("throws PermissionDeniedError on 403", async () => {
    stubFetch(403, { error: "forbidden" });
    await expect(resolvePermission("http://tack-server.local", "page-1", "token")).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
  });

  it("throws PermissionDeniedError on 404 (page not found is treated the same as denied)", async () => {
    stubFetch(404, { error: "not found" });
    await expect(resolvePermission("http://tack-server.local", "page-1", "token")).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
  });

  it("throws a plain error on an unexpected status", async () => {
    stubFetch(500, { error: "boom" });
    await expect(resolvePermission("http://tack-server.local", "page-1", "token")).rejects.toThrow(/500/);
  });
});
