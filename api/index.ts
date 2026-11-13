import type { RequestHandler } from "express";
import app from "../artifacts/api-server/dist/app.mjs";

const handler: RequestHandler = (req, res, next) => {
  const requestUrl = new URL(req.url ?? "/", "http://localhost");
  const routePath = requestUrl.searchParams.get("__api_path");
  if (routePath === null) {
    app(req, res, next);
    return;
  }
  if (!routePath.startsWith("/") || routePath.startsWith("//")) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "La ruta solicitada no es válida." }));
    return;
  }

  requestUrl.searchParams.delete("__api_path");
  req.url = `/api${routePath}${requestUrl.search}`;
  app(req, res, next);
};

export default handler;
