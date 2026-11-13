import app from "./app.js";
import { logger } from "./lib/logger.js";
import { ensureSeedData } from "./lib/storeData.js";

const rawPort = process.env["PORT"];
const parsedPort = rawPort ? Number(rawPort) : 3000;
const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3000;

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
