/**
 * Trade Marathon® API Server
 * Standalone Express server for desktop app (Tauri) - proxies API routes
 * that require server-side execution (API keys, CCXT, Prisma, etc.)
 */
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import dotenv from "dotenv";

// Load .env from project root (parent of api-server/) so it works regardless of cwd
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "..", ".env") });

import express from "express";
import cors from "cors";
import multer from "multer";

const app = express();
const PORT = process.env.API_PORT ? parseInt(process.env.API_PORT, 10) : 35821;
const upload = multer({ storage: multer.memoryStorage() });

/** Wrap async route handlers so rejections are caught and we never send 500. */
function asyncRoute(
  fn: (req: express.Request, res: express.Response) => Promise<void>
): express.RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch((err) => {
      console.error("[API Server] Unhandled route error:", err);
      if (!res.headersSent) {
        res.status(502).json({
          error: "Server error",
          details: err instanceof Error ? err.message : String(err),
        });
      }
      next();
    });
  };
}

app.use(cors({ origin: true }));
app.use(express.json({ limit: "10mb" }));

// Calendar events
app.get("/api/calendar/events", async (_req, res) => {
  const { calendarHandler } = await import("./routes/calendar");
  calendarHandler(_req, res);
});

// CEX
app.post("/api/cex/balance", async (req, res) => {
  const { balanceHandler } = await import("./routes/cex-balance");
  balanceHandler(req, res);
});
app.post("/api/cex/open-orders", async (req, res) => {
  const { openOrdersHandler } = await import("./routes/cex-open-orders");
  openOrdersHandler(req, res);
});
app.post("/api/cex/place-order", async (req, res) => {
  const { placeOrderHandler } = await import("./routes/cex-place-order");
  placeOrderHandler(req, res);
});
app.post("/api/cex/register-connection", async (req, res) => {
  const { registerConnectionHandler } = await import("./routes/cex-register-connection");
  registerConnectionHandler(req, res);
});
app.post("/api/cex/positions", async (req, res) => {
  const { positionsHandler } = await import("./routes/cex-positions");
  positionsHandler(req, res);
});
app.post("/api/cex/trades", async (req, res) => {
  const { tradesHandler } = await import("./routes/cex-trades");
  tradesHandler(req, res);
});
app.post("/api/cex/transfers", async (req, res) => {
  const { transfersHandler } = await import("./routes/cex-transfers");
  transfersHandler(req, res);
});

// Binance
app.post("/api/binance/listen-key", async (req, res) => {
  const { postHandler } = await import("./routes/binance-listen-key");
  postHandler(req, res);
});
app.put("/api/binance/listen-key", async (req, res) => {
  const { putHandler } = await import("./routes/binance-listen-key");
  putHandler(req, res);
});
app.post("/api/binance/listen-key-futures", async (req, res) => {
  const { postHandler } = await import("./routes/binance-listen-key-futures");
  postHandler(req, res);
});
app.put("/api/binance/listen-key-futures", async (req, res) => {
  const { putHandler } = await import("./routes/binance-listen-key-futures");
  putHandler(req, res);
});

// Wallet
app.get("/api/wallet/portfolio", async (req, res) => {
  const { portfolioHandler } = await import("./routes/wallet-portfolio");
  portfolioHandler(req, res);
});
app.get("/api/wallet/history", async (req, res) => {
  const { historyHandler } = await import("./routes/wallet-history");
  historyHandler(req, res);
});
app.get("/api/dashboard/summary", async (req, res) => {
  const { dashboardSummaryHandler } = await import("./routes/dashboard-summary");
  dashboardSummaryHandler(req, res);
});

// Journal
app.get("/api/journal", async (_req, res) => {
  const { getHandler } = await import("./routes/journal");
  getHandler(_req, res);
});
app.post("/api/journal", async (req, res) => {
  const { postHandler } = await import("./routes/journal");
  postHandler(req, res);
});
app.post("/api/journal/sync", async (req, res) => {
  const { syncHandler } = await import("./routes/journal-sync");
  syncHandler(req, res);
});

// Screener
app.get("/api/screener/markets", async (_req, res) => {
  const { marketsHandler } = await import("./routes/screener-markets");
  marketsHandler(_req, res);
});
app.get("/api/screener/ccxt-data", async (_req, res) => {
  const { ccxtDataHandler } = await import("./routes/screener-ccxt-data");
  ccxtDataHandler(_req, res);
});

// Social (X)
app.get("/api/social/x/auth", async (req, res) => {
  const { xAuthHandler } = await import("./routes/social-x");
  xAuthHandler(req, res);
});
app.get("/api/social/x/callback", async (req, res) => {
  const { xCallbackHandler } = await import("./routes/social-x");
  xCallbackHandler(req, res);
});
app.get("/api/social/x/status", async (req, res) => {
  const { xStatusHandler } = await import("./routes/social-x");
  xStatusHandler(req, res);
});
app.post("/api/social/x/disconnect", async (req, res) => {
  const { xDisconnectHandler } = await import("./routes/social-x");
  xDisconnectHandler(req, res);
});
app.get("/api/social/x/search", async (req, res) => {
  const { xSearchHandler } = await import("./routes/social-x");
  xSearchHandler(req, res);
});

// Alerts
app.post("/api/alerts/send", async (req, res) => {
  const { sendHandler } = await import("./routes/alerts-send");
  sendHandler(req, res);
});
app.post("/api/alerts/test", async (req, res) => {
  const { testHandler } = await import("./routes/alerts-test");
  testHandler(req, res);
});
app.post("/api/integrations/health", async (req, res) => {
  const { integrationsHealthHandler } = await import("./routes/integrations-health");
  integrationsHealthHandler(req, res);
});

// AI Gateway (multi-provider: openai | gemini | ollama | auto)
app.get("/api/ai/providers", async (req, res) => {
  const { providersHandler } = await import("./routes/ai-chat");
  providersHandler(req, res);
});
app.post("/api/ai/chat", async (req, res) => {
  const { chatHandler } = await import("./routes/ai-chat");
  chatHandler(req, res);
});

// Transcribe (POST needs multer for file upload)
app.get("/api/transcribe", async (req, res) => {
  const { getHandler } = await import("./routes/transcribe");
  getHandler(req, res);
});
app.post("/api/transcribe", upload.single("file"), async (req, res) => {
  const { postHandler } = await import("./routes/transcribe");
  postHandler(req, res);
});

// Indian MF
app.get("/api/indian-mf/search", async (req, res) => {
  const { searchHandler } = await import("./routes/indian-mf");
  searchHandler(req, res);
});
app.get("/api/indian-mf/nav/:code", async (req, res) => {
  const { navHandler } = await import("./routes/indian-mf");
  navHandler(req, res);
});
app.get("/api/indian-mf/history/:code", async (req, res) => {
  const { historyHandler } = await import("./routes/indian-mf");
  historyHandler(req, res);
});

// Indian stocks
app.get("/api/indian-stocks/search", async (req, res) => {
  const { searchHandler } = await import("./routes/indian-stocks");
  searchHandler(req, res);
});
app.get("/api/indian-stocks/price", async (req, res) => {
  const { priceHandler } = await import("./routes/indian-stocks");
  priceHandler(req, res);
});
app.get("/api/indian-stocks/batch", async (req, res) => {
  const { batchHandler } = await import("./routes/indian-stocks");
  batchHandler(req, res);
});

// Indian markets CAS (parse-pdf needs multer for file upload)
app.post("/api/indian-markets/cas-import/parse-json", async (req, res) => {
  const { parseJsonHandler } = await import("./routes/indian-markets-cas");
  parseJsonHandler(req, res);
});
app.post("/api/indian-markets/cas-import/parse-pdf", upload.single("file"), async (req, res) => {
  const { parsePdfHandler } = await import("./routes/indian-markets-cas");
  parsePdfHandler(req, res);
});

// Backup (Firebase Storage bridge; auth via Supabase JWT)
app.get("/api/backup/list", async (req, res) => {
  const { listHandler } = await import("./routes/backup");
  listHandler(req, res);
});
app.post("/api/backup/upload", async (req, res) => {
  const { uploadHandler } = await import("./routes/backup");
  uploadHandler(req, res);
});
app.get("/api/backup/download", async (req, res) => {
  const { downloadHandler } = await import("./routes/backup");
  downloadHandler(req, res);
});
app.delete("/api/backup/delete", async (req, res) => {
  const { deleteHandler } = await import("./routes/backup");
  deleteHandler(req, res);
});

// Admin (builder only) — wrapped so failures return 502, not 500
app.get("/api/admin/users", asyncRoute(async (req, res) => {
  const { usersHandler } = await import("./routes/admin");
  await usersHandler(req, res);
}));
app.get("/api/admin/storage", asyncRoute(async (req, res) => {
  const { storageHandler } = await import("./routes/admin");
  await storageHandler(req, res);
}));
app.delete("/api/admin/users/:userId", asyncRoute(async (req, res) => {
  const { deleteUserHandler } = await import("./routes/admin");
  await deleteUserHandler(req, res);
}));
app.post("/api/admin/users/:userId/notify-storage-full", asyncRoute(async (req, res) => {
  const { notifyStorageFullHandler } = await import("./routes/admin");
  await notifyStorageFullHandler(req, res);
}));
app.delete("/api/admin/users/:userId/notify-storage-full", asyncRoute(async (req, res) => {
  const { clearStorageFullHandler } = await import("./routes/admin");
  await clearStorageFullHandler(req, res);
}));
app.get("/api/admin/users/:userId/subscription", asyncRoute(async (req, res) => {
  const { getSubscriptionHandler } = await import("./routes/admin");
  await getSubscriptionHandler(req, res);
}));
app.put("/api/admin/users/:userId/subscription", asyncRoute(async (req, res) => {
  const { putSubscriptionHandler } = await import("./routes/admin");
  await putSubscriptionHandler(req, res);
}));

// Admin referral (builder only)
app.get("/api/admin/referral/bybit-users", asyncRoute(async (req, res) => {
  const { bybitUsersHandler } = await import("./routes/admin-referral");
  await bybitUsersHandler(req, res);
}));
app.post("/api/admin/referral/verify", asyncRoute(async (req, res) => {
  const { verifyHandler } = await import("./routes/admin-referral");
  await verifyHandler(req, res);
}));
app.get("/api/admin/referral/links", asyncRoute(async (req, res) => {
  const { linksHandler } = await import("./routes/admin-referral");
  await linksHandler(req, res);
}));

// Health check (no auth); frontend uses this to show the right Admin error message
app.get("/api/health", (_req, res) => {
  const supabaseConfigured =
    !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  res.json({
    ok: true,
    timestamp: Date.now(),
    supabaseConfigured,
  });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`[API Server] Listening on http://127.0.0.1:${PORT}`);
  const hasSupabase =
    !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log(
    `[API Server] Supabase env: ${hasSupabase ? "OK" : "MISSING (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env)"}`
  );
  // Server-side screener alert checker (alerts when app is closed)
  if (hasSupabase) {
    import("./routes/alert-checker").then((m) => {
      m.runServerSideAlertCheck().catch(() => {});
      setInterval(() => m.runServerSideAlertCheck().catch(() => {}), 60 * 1000);
    }).catch(() => {});
  }
});
