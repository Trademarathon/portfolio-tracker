import type { Request, Response } from "express";
import { prisma } from "../../src/lib/db";

export async function getHandler(_req: Request, res: Response) {
  try {
    const trades = await prisma.trade.findMany({ orderBy: { date: "desc" } });
    res.json(trades);
  } catch (error) {
    console.error("Failed to fetch trades:", error);
    res.status(500).json({ error: "Failed to fetch trades" });
  }
}

export async function postHandler(req: Request, res: Response) {
  try {
    const body = req.body;
    const trade = await prisma.trade.create({
      data: {
        symbol: body.symbol,
        side: body.side,
        entryPrice: parseFloat(body.entryPrice),
        size: parseFloat(body.size),
        notes: body.notes,
        status: "open",
      },
    });
    res.json(trade);
  } catch (error) {
    console.error("Failed to create trade:", error);
    res.status(500).json({ error: "Failed to create trade" });
  }
}
