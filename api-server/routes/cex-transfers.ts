import type { Request, Response } from "express";

import { getExchangeInstance } from "../lib/exchange-manager";

export async function transfersHandler(req: Request, res: Response) {
  try {
    const exchange = req.body?.exchange ?? req.body?.exchangeId;
    const { apiKey, secret } = req.body;
    if (!exchange || !apiKey || !secret) {
      return res.status(400).json({ error: "Missing credentials" });
    }
    let client: any;
    try {
      client = getExchangeInstance(exchange, apiKey, secret);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }

    const since = Date.now() - 90 * 24 * 60 * 60 * 1000;
    let deposits: any[] = [];
    let withdrawals: any[] = [];
    try {
      [deposits, withdrawals] = await Promise.all([
        client.fetchDeposits(undefined, since),
        client.fetchWithdrawals(undefined, since),
      ]);
    } catch (_e) {
      // continue to exchange-specific fallback below
    }

    if (exchange === "bybit" && (!Array.isArray(deposits) || deposits.length === 0) && (!Array.isArray(withdrawals) || withdrawals.length === 0)) {
      try {
        const depFn = (client as any).privateGetV5AssetDepositQueryRecord;
        if (typeof depFn === "function") {
          const depRaw = await depFn.call(client, { limit: 50 });
          const list = depRaw?.result?.rows || depRaw?.result?.list || [];
          if (Array.isArray(list)) {
            deposits = list.map((d: any) => ({
              id: d.id || d.txID || `dep-${d.coin}-${d.amount}-${d.successAt || d.createTime || Date.now()}`,
              currency: d.coin,
              amount: parseFloat(d.amount || "0") || 0,
              status: d.status || d.depositStatus || "ok",
              timestamp: Number(d.successAt || d.createTime || Date.now()),
              datetime: undefined,
              txid: d.txID || d.txId,
              address: d.toAddress || d.address,
              network: d.chain || d.chainType,
              fee: d.fee ? { cost: parseFloat(d.fee || "0") || 0, currency: d.coin } : undefined,
              info: d,
            }));
          }
        }
      } catch {
        // ignore
      }
      try {
        const wdFn = (client as any).privateGetV5AssetWithdrawQueryRecord;
        if (typeof wdFn === "function") {
          const wdRaw = await wdFn.call(client, { limit: 50 });
          const list = wdRaw?.result?.rows || wdRaw?.result?.list || [];
          if (Array.isArray(list)) {
            withdrawals = list.map((w: any) => ({
              id: w.id || w.withdrawId || `wd-${w.coin}-${w.amount}-${w.successAt || w.createTime || Date.now()}`,
              currency: w.coin,
              amount: parseFloat(w.amount || "0") || 0,
              status: w.status || w.withdrawStatus || "ok",
              timestamp: Number(w.successAt || w.createTime || Date.now()),
              datetime: undefined,
              txid: w.txID || w.txId,
              address: w.toAddress || w.address,
              network: w.chain || w.chainType,
              fee: w.fee ? { cost: parseFloat(w.fee || "0") || 0, currency: w.coin } : undefined,
              info: w,
            }));
          }
        }
      } catch {
        // ignore
      }
    }
    const normalize = (items: any[], type: "Deposit" | "Withdraw") =>
      items.map((item) => ({
        id: item.id || item.txid || `${type}-${item.timestamp}`,
        type,
        asset: item.currency,
        symbol: item.currency,
        amount: item.amount,
        status: item.status,
        timestamp: item.timestamp,
        datetime: item.datetime,
        txHash: item.txid,
        address: item.address,
        tag: item.tag,
        network: item.network,
        chain: item.network || item.chain,
        from: type === "Deposit" ? (item.address || "External") : exchange,
        to: type === "Withdraw" ? (item.address || "External") : exchange,
        exchange,
        fee: typeof item.fee?.cost === "number" ? item.fee.cost : undefined,
        feeAsset: item.fee?.currency || item.currency,
        feeUsd: typeof item.fee?.cost === "number" ? item.fee.cost : undefined,
        info: item.info || {},
        sourceType: "cex",
      }));
    const allTransfers = [
      ...normalize(deposits, "Deposit"),
      ...normalize(withdrawals, "Withdraw"),
    ].sort((a, b) => b.timestamp - a.timestamp);
    res.json({ transfers: allTransfers });
  } catch (error: any) {
    console.error("CEX Transfers Error:", error);
    res.status(500).json({ error: error.message });
  }
}
