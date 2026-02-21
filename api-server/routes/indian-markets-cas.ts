import type { Request, Response } from "express";
import {
  casToTransactions,
  type CASParsedData,
} from "../../src/lib/api/cas-to-transactions";
import { unifiedResponseToCasData } from "../../src/lib/api/cas-unified-adapter";

const CAS_PARSER_API_BASE = "https://portfolio-parser.api.casparser.in";

export async function parseJsonHandler(req: Request, res: Response) {
  try {
    const body = req.body;
    if (!body || typeof body !== "object") {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
    const data = body as CASParsedData;
    const { mfTransactions, stockTransactions } = casToTransactions(data);
    res.json({
      success: true,
      mfTransactions,
      stockTransactions,
      summary: {
        mfCount: mfTransactions.length,
        stockCount: stockTransactions.length,
      },
    });
  } catch (error) {
    console.error("CAS JSON parse error:", error);
    res.status(500).json({ error: "Failed to parse CAS JSON" });
  }
}

export async function parsePdfHandler(req: Request, res: Response) {
  try {
    const apiKey = req.headers["x-cas-parser-api-key"] as string | undefined;
    if (!apiKey?.trim()) {
      return res.status(400).json({
        error: "CAS Parser API key required. Add it in Settings > Indian Markets.",
      });
    }
    const file = (req as any).file;
    const password = (req.body?.password as string)?.trim() ?? "";

    if (!file || !file.buffer) {
      return res.status(400).json({ error: "PDF file is required" });
    }

    const base64 = file.buffer.toString("base64");
    const fetchRes = await fetch(`${CAS_PARSER_API_BASE}/v4/smart/parse`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey.trim(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pdf_file: base64,
        password: password || undefined,
      }),
    });

    if (!fetchRes.ok) {
      const errText = await fetchRes.text();
      return res.status(fetchRes.status === 401 ? 401 : 502).json({
        error: `CAS Parser failed: ${errText || fetchRes.statusText}`,
      });
    }

    const unified = await fetchRes.json();
    const casData = unifiedResponseToCasData(unified);
    const { mfTransactions, stockTransactions } = casToTransactions(casData);

    res.json({
      success: true,
      mfTransactions,
      stockTransactions,
      summary: {
        mfCount: mfTransactions.length,
        stockCount: stockTransactions.length,
      },
    });
  } catch (error) {
    console.error("CAS PDF parse error:", error);
    res.status(500).json({ error: "Failed to parse CAS PDF" });
  }
}
