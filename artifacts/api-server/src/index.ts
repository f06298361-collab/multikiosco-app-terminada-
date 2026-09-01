import app from "./app";
import { logger } from "./lib/logger";
import { ensureSuperAdminSeed } from "./lib/auth";

const port = 3000;

// Ensure database has seeded SuperAdmin account on startup
ensureSuperAdminSeed().catch((err) => {
  logger.warn({ err }, "Could not seed SuperAdmin on startup");
});

const server = app.listen(port, "0.0.0.0", () => {

  logger.info({ port }, `Server listening on 0.0.0.0:${port}`);
});

server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    logger.error({ err }, `Port ${port} is already in use.`);
  } else {
    logger.error({ err }, "Error listening on port");
  }
  process.exit(1);
});

process.on("SIGTERM", () => {
  server.close(() => {
    logger.info("Server closed on SIGTERM");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  server.close(() => {
    logger.info("Server closed on SIGINT");
    process.exit(0);
  });
});

