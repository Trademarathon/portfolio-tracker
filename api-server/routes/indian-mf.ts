import type { Request, Response } from "express";
import { DEFAULT_MF_API_BASE } from "../../src/lib/api/indian-markets-config";

const X_INDIAN_MF_API_BASE = "X-Indian-MF-Api-Base";

export async function searchHandler(req: Request, res: Response) {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ error: "Missing query parameter q" });
    }
    const base = (req.headers[X_INDIAN_MF_API_BASE.toLowerCase()] as string)?.trim() || DEFAULT_MF_API_BASE;
    const fetchRes = await fetch(
      `${base.replace(/\/$/, "")}/mf/search?q=${encodeURIComponent(query)}`,
      { headers: { Accept: "application/json" } }
    );
    const data = await fetchRes.json();
    res.json(data);
  } catch (error) {
    console.error("Indian MF search error:", error);
    res.status(500).json([]);
  }
}

export async function navHandler(req: Request, res: Response) {
  try {
    const code = req.params.code;
    if (!code) {
      return res.status(400).json({ error: "Missing scheme code" });
    }
    const base = (req.headers[X_INDIAN_MF_API_BASE.toLowerCase()] as string)?.trim() || DEFAULT_MF_API_BASE;
    const fetchRes = await fetch(
      `${base.replace(/\/$/, "")}/mf/${code}/latest`,
      { headers: { Accept: "application/json" } }
    );
    const data = await fetchRes.json();
    res.json(data);
  } catch (error) {
    console.error("Indian MF NAV error:", error);
    res.status(500).json({ error: "Failed to fetch NAV" });
  }
}

export async function historyHandler(req: Request, res: Response) {
  try {
    const code = req.params.code;
    if (!code) {
      return res.status(400).json({ error: "Missing scheme code" });
    }
    const base = (req.headers[X_INDIAN_MF_API_BASE.toLowerCase()] as string)?.trim() || DEFAULT_MF_API_BASE;
    const fetchRes = await fetch(
      `${base.replace(/\/$/, "")}/mf/${code}`,
      { headers: { Accept: "application/json" } }
    );
    const data = await fetchRes.json();
    res.json(data);
  } catch (error) {
    console.error("Indian MF history error:", error);
    res.status(500).json({ error: "Failed to fetch NAV history" });
  }
}
