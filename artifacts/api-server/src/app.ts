import { createRequire } from "node:module";
import type { ServerResponse } from "node:http";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { mediaUploadDir } from "./lib/mediaStorage.js";
import { ensureSeedData } from "./lib/storeData.js";

const require = createRequire(import.meta.url);
const express = require("express") as typeof import("express");

type ApiResponse = {
  status(code: number): ApiResponse;
  json(body: { error: string }): void;
};

const sessionSecret = process.env["SESSION_SECRET"];
if (!sessionSecret || Buffer.byteLength(sessionSecret) < 32) {
  throw new Error("SESSION_SECRET must contain at least 32 characters.");
}

const app = express();
let seedPromise: Promise<void> | null = null;

app.set("trust proxy", 1);
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cookieParser(sessionSecret));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  "/api/uploads",
  express.static(mediaUploadDir, {
    dotfiles: "deny",
    index: false,
    immutable: true,
    maxAge: "1y",
    setHeaders(response: Pick<ServerResponse, "setHeader">) {
      response.setHeader("X-Content-Type-Options", "nosniff");
    },
  }),
);
app.use("/api", (_req: unknown, res: ApiResponse, next: () => void) => {
  if (process.env["VERCEL"] !== "1") {
    next();
    return;
  }
  const pendingSeed = seedPromise ?? ensureSeedData();
  seedPromise = pendingSeed;
  void pendingSeed.then(() => next()).catch((error: unknown) => {
    logger.error({ err: error }, "Failed to initialize store data");
    res.status(503).json({ error: "La tienda todavía no está disponible." });
  });
});
app.use("/api", router);

export default app;
