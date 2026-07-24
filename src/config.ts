export interface Config {
  host: string;
  port: number;
  databaseUrl: string;
  /** Base URL of tack-server, used to resolve each connection's permission level. */
  tackServerUrl: string;
}

export function loadConfig(): Config {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  const tackServerUrl = process.env.TACK_SERVER_URL ?? "http://localhost:8087";

  return {
    host: process.env.HOST ?? "0.0.0.0",
    port: Number(process.env.PORT ?? 8088),
    databaseUrl,
    tackServerUrl,
  };
}
