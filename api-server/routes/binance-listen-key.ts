import type { Request, Response } from "express";

export async function postHandler(req: Request, res: Response) {
  try {
    const { apiKey, apiSecret, marketType } = req.body;
    if (!apiKey || !apiSecret) {
      return res.status(400).json({ error: "Missing API credentials" });
    }
    const baseUrl =
      marketType === "futures"
        ? "https://fapi.binance.com/fapi/v1/listenKey"
        : "https://api.binance.com/api/v3/userDataStream";
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: { "X-MBX-APIKEY": apiKey },
    });
    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error: `Binance ${marketType || "Spot"} Error: ${error}` });
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("ListenKey Error:", error);
    res.status(500).json({ error: "Failed to create ListenKey" });
  }
}

export async function putHandler(req: Request, res: Response) {
  try {
    const { apiKey, listenKey, marketType } = req.body;
    if (!apiKey || !listenKey) {
      return res.status(400).json({ error: "Missing parameters" });
    }
    const baseUrl =
      marketType === "futures"
        ? "https://fapi.binance.com/fapi/v1/listenKey"
        : "https://api.binance.com/api/v3/userDataStream";
    let url = baseUrl;
    if (marketType !== "futures") url = `${baseUrl}?listenKey=${listenKey}`;
    const response = await fetch(url, {
      method: "PUT",
      headers: { "X-MBX-APIKEY": apiKey },
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: "Failed to keep-alive ListenKey" });
    }
    res.json({ success: true });
  } catch (_error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
}
