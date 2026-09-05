import path from "node:path";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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
app.use(cors());
// Límite ampliado para imágenes de productos en base64 (hasta ~8 MB real → ~11 MB en base64)
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

app.get("/manifest.json", (req, res, next) => {
  router(req, res, next);
});

app.use("/api", router);

// Any unhandled /api route MUST return JSON 404, never HTML
app.use("/api", (req, res) => {
  res.status(404).json({ error: `Ruta de API no encontrada: ${req.method} ${req.originalUrl}` });
});

const frontendDist = path.resolve(process.cwd(), "artifacts/kiosco-franco/dist/public");
app.use(express.static(frontendDist));

app.use((req, res, next) => {
  if (req.method !== "GET" || req.originalUrl.startsWith("/api") || req.path.startsWith("/api")) {
    return next();
  }
  res.sendFile(path.join(frontendDist, "index.html"), (err) => {
    if (err) {
      res.status(200).send(`<!DOCTYPE html>
<html>
<head><title>Tienda Online</title></head>
<body>
  <div style="font-family: system-ui, sans-serif; display: flex; height: 100vh; align-items: center; justify-content: center; flex-direction: column;">
    <h2>Iniciando sistema...</h2>
    <p>El frontend se está construyendo. Por favor refresca en unos segundos.</p>
  </div>
</body>
</html>`);
    }
  });
});

// Global error handler middleware
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Unhandled server error");
  if (req.originalUrl.startsWith("/api") || req.path.startsWith("/api") || req.headers.accept?.includes("application/json")) {
    res.status(err.status || 500).json({ error: err.message || "Error interno del servidor" });
  } else {
    res.status(500).send("Error interno del servidor");
  }
});

export default app;

