import type { Request, Response } from "express";

async function loadGateway() {
  return import("../../src/lib/server/ai-gateway");
}

function headerFromExpress(
  req: Request,
  name: string
): string | null | undefined | string[] {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value;
  return null;
}

export async function chatHandler(req: Request, res: Response) {
  try {
    const gateway = await loadGateway();
    const creds = gateway.resolveAICredentialsFromHeaders((name) =>
      headerFromExpress(req, name)
    );
    const result = await gateway.executeAIChat(
      (req.body || {}) as Record<string, unknown>,
      creds
    );
    return res.status(result.ok ? 200 : result.status).json(result);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "AI request failed",
    });
  }
}

export async function providersHandler(req: Request, res: Response) {
  try {
    const gateway = await loadGateway();
    const creds = gateway.resolveAICredentialsFromHeaders((name) =>
      headerFromExpress(req, name)
    );
    const providers = await gateway.checkProviderAvailability(creds);
    return res.json({ ok: true, providers });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to check providers",
    });
  }
}
