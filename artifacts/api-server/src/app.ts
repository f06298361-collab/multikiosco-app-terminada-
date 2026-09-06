import fs from "node:fs";
import path from "node:path";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { resolveKioskFromRequest } from "./lib/kiosk-resolver";
import { ensureSettingsForKiosk } from "./routes/settings";

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
// Servir archivos estáticos con index: false para que la raíz '/' y rutas SPA pasen al inyector de metadatos Open Graph
app.use(express.static(frontendDist, { index: false }));

function escapeHtml(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

let cachedIndexHtml: string | null = null;
let lastIndexHtmlReadTime = 0;

function getIndexHtml(): string | null {
  const now = Date.now();
  if (cachedIndexHtml && now - lastIndexHtmlReadTime < 4000) {
    return cachedIndexHtml;
  }
  const indexPath = path.join(frontendDist, "index.html");
  if (fs.existsSync(indexPath)) {
    try {
      cachedIndexHtml = fs.readFileSync(indexPath, "utf8");
      lastIndexHtmlReadTime = now;
      return cachedIndexHtml;
    } catch {}
  }
  return null;
}

app.use(async (req, res, next) => {
  if (req.method !== "GET" || req.originalUrl.startsWith("/api") || req.path.startsWith("/api")) {
    return next();
  }

  const template = getIndexHtml();
  if (!template) {
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
    return;
  }

  try {
    const kiosk = await resolveKioskFromRequest(req);

    const proto = (req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim();
    const host = (req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
    const baseUrl = `${proto}://${host}`;

    let shopName = "FerRap · Pedidos Online";
    let description = "Hacé tu pedido online en tu comercio de cercanía de forma rápida y sencilla.";
    let kioskSlug = "";
    let ogImageUrl = `${baseUrl}/opengraph.jpg`;

    if (kiosk.exists) {
      const settings = await ensureSettingsForKiosk(kiosk.id);
      const customShopName = settings?.shopName || kiosk.name;
      if (customShopName) {
        shopName = customShopName;
      }
      if (settings?.description) {
        description = settings.description;
      } else {
        description = `Hacé tu pedido online en ${shopName}. Mirá el catálogo y realizá tu pedido directamente por WhatsApp.`;
      }
      kioskSlug = kiosk.slug || kiosk.id;
      ogImageUrl = settings?.logoUrl
        ? `${baseUrl}/api/kiosk-og-image?kiosk=${encodeURIComponent(kioskSlug)}`
        : `${baseUrl}/opengraph.jpg`;
    }

    const pageUrl = kioskSlug ? `${baseUrl}/?kiosk=${encodeURIComponent(kioskSlug)}` : `${baseUrl}/`;
    const pageTitle = kiosk.exists ? `${shopName} · Pedidos Online` : "FerRap · Pedidos Online";

    let html = template;

    // 1. Título
    html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(pageTitle)}</title>`);

    // 2. Descripción
    if (html.match(/<meta\s+name=["']description["'][^>]*>/i)) {
      html = html.replace(
        /<meta\s+name=["']description["'][^>]*>/i,
        `<meta name="description" content="${escapeHtml(description)}" />`
      );
    } else {
      html = html.replace("</head>", `  <meta name="description" content="${escapeHtml(description)}" />\n</head>`);
    }

    // 3. Open Graph: Title
    if (html.match(/<meta\s+property=["']og:title["'][^>]*>/i)) {
      html = html.replace(
        /<meta\s+property=["']og:title["'][^>]*>/i,
        `<meta property="og:title" content="${escapeHtml(pageTitle)}" />`
      );
    } else {
      html = html.replace("</head>", `  <meta property="og:title" content="${escapeHtml(pageTitle)}" />\n</head>`);
    }

    // 4. Open Graph: Description
    if (html.match(/<meta\s+property=["']og:description["'][^>]*>/i)) {
      html = html.replace(
        /<meta\s+property=["']og:description["'][^>]*>/i,
        `<meta property="og:description" content="${escapeHtml(description)}" />`
      );
    } else {
      html = html.replace("</head>", `  <meta property="og:description" content="${escapeHtml(description)}" />\n</head>`);
    }

    // 5. Open Graph: Image (Raster JPEG o PNG para compatibilidad absoluta con WhatsApp, Facebook, iMessage)
    if (html.match(/<meta\s+property=["']og:image["'][^>]*>/i)) {
      html = html.replace(
        /<meta\s+property=["']og:image["'][^>]*>/i,
        `<meta property="og:image" content="${escapeHtml(ogImageUrl)}" />`
      );
    } else {
      html = html.replace("</head>", `  <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />\n</head>`);
    }

    // 6. Open Graph: URL canónica
    if (html.match(/<meta\s+property=["']og:url["'][^>]*>/i)) {
      html = html.replace(
        /<meta\s+property=["']og:url["'][^>]*>/i,
        `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`
      );
    } else {
      html = html.replace("</head>", `  <meta property="og:url" content="${escapeHtml(pageUrl)}" />\n</head>`);
    }

    // 7. Open Graph: Site Name
    if (html.match(/<meta\s+property=["']og:site_name["'][^>]*>/i)) {
      html = html.replace(
        /<meta\s+property=["']og:site_name["'][^>]*>/i,
        `<meta property="og:site_name" content="${escapeHtml(shopName)}" />`
      );
    } else {
      html = html.replace("</head>", `  <meta property="og:site_name" content="${escapeHtml(shopName)}" />\n</head>`);
    }

    // 8. Twitter Card Tags
    if (html.match(/<meta\s+name=["']twitter:title["'][^>]*>/i)) {
      html = html.replace(
        /<meta\s+name=["']twitter:title["'][^>]*>/i,
        `<meta name="twitter:title" content="${escapeHtml(pageTitle)}" />`
      );
    } else {
      html = html.replace("</head>", `  <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />\n</head>`);
    }

    if (html.match(/<meta\s+name=["']twitter:description["'][^>]*>/i)) {
      html = html.replace(
        /<meta\s+name=["']twitter:description["'][^>]*>/i,
        `<meta name="twitter:description" content="${escapeHtml(description)}" />`
      );
    } else {
      html = html.replace("</head>", `  <meta name="twitter:description" content="${escapeHtml(description)}" />\n</head>`);
    }

    if (html.match(/<meta\s+name=["']twitter:image["'][^>]*>/i)) {
      html = html.replace(
        /<meta\s+name=["']twitter:image["'][^>]*>/i,
        `<meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />`
      );
    } else {
      html = html.replace("</head>", `  <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />\n</head>`);
    }

    // 9. Favicon, Apple Touch Icon y PWA Manifest según el negocio
    if (kioskSlug) {
      const iconUrl = `${baseUrl}/api/kiosk-icon?kiosk=${encodeURIComponent(kioskSlug)}`;
      const manifestUrl = `/api/manifest.json?kiosk=${encodeURIComponent(kioskSlug)}`;

      if (html.match(/<link\s+[^>]*rel=["']apple-touch-icon["'][^>]*>/i)) {
        html = html.replace(
          /<link\s+[^>]*rel=["']apple-touch-icon["'][^>]*>/i,
          `<link rel="apple-touch-icon" href="${escapeHtml(iconUrl)}" />`
        );
      }
      if (html.match(/<link\s+[^>]*id=["']app-manifest["'][^>]*>/i)) {
        html = html.replace(
          /<link\s+[^>]*id=["']app-manifest["'][^>]*>/i,
          `<link id="app-manifest" rel="manifest" href="${escapeHtml(manifestUrl)}" />`
        );
      } else if (html.match(/<link\s+[^>]*rel=["']manifest["'][^>]*>/i)) {
        html = html.replace(
          /<link\s+[^>]*rel=["']manifest["'][^>]*>/i,
          `<link id="app-manifest" rel="manifest" href="${escapeHtml(manifestUrl)}" />`
        );
      }
    }

    res.status(200).type("html").send(html);
  } catch (err) {
    logger.error({ err }, "Error injecting dynamic metadata into index.html");
    res.status(200).type("html").send(template);
  }
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

