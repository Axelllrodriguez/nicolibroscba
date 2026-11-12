import app from "./app";
import { logger } from "./lib/logger";
import { ensureSeedData } from "./lib/storeData";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const host = process.env["HOST"];

await ensureSeedData();

const server = host ? app.listen(port, host) : app.listen(port);

server.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});

server.on("listening", () => {
  logger.info({ host, port }, "Server listening");
});
