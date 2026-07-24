import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("throws if DATABASE_URL is missing", () => {
    delete process.env.DATABASE_URL;
    expect(() => loadConfig()).toThrow("DATABASE_URL");
  });

  it("applies documented defaults", () => {
    process.env.DATABASE_URL = "postgres://x";
    delete process.env.HOST;
    delete process.env.PORT;
    delete process.env.TACK_SERVER_URL;

    const config = loadConfig();
    expect(config.host).toBe("0.0.0.0");
    expect(config.port).toBe(8088);
    expect(config.tackServerUrl).toBe("http://localhost:8087");
  });

  it("reads all values from the environment when set", () => {
    process.env.DATABASE_URL = "postgres://real";
    process.env.HOST = "127.0.0.1";
    process.env.PORT = "9999";
    process.env.TACK_SERVER_URL = "http://tack-server.internal";

    const config = loadConfig();
    expect(config).toEqual({
      databaseUrl: "postgres://real",
      host: "127.0.0.1",
      port: 9999,
      tackServerUrl: "http://tack-server.internal",
    });
  });
});
