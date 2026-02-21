import type { Request, Response } from "express";

export async function postHandler(req: Request, res: Response) {
  try {
    const { apiKey, apiSecret } = req.body;
    if (!apiKey || !apiSecret) {
      return res.status(400).json({ error: "Missing credentials" });
    }
    const fetchRes = await fetch("https://fapi.binance.com/fapi/v1/listenKey", {
      method: "POST",
      headers: { "X-MBX-APIKEY": apiKey },
    });
    if (!fetchRes.ok) {
      const errorText = await fetchRes.text();
      throw new Error(`Binance API Error: ${fetchRes.status} ${errorText}`);
    }
    const data = await fetchRes.json();
    res.json({ listenKey: data.listenKey });
  } catch (error: any) {
    console.error("Binance ListenKey Futures Error:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function putHandler(req: Request, res: Response) {
  try {
    const { apiKey, listenKey } = req.body;
    if (!apiKey || !listenKey) {
      return res.status(400).json({ error: "Missing credentials" });
    }
    const fetchRes = await fetch("https://fapi.binance.com/fapi/v1/listenKey", {
      method: "PUT",
      headers: { "X-MBX-APIKEY": apiKey, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ listenKey }),
    });
    res.json({ success: fetchRes.ok });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
