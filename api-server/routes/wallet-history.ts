import type { Request, Response } from "express";
// Dynamic imports are used below to avoid ESM resolution errors with tsx

export async function historyHandler(req: Request, res: Response) {
  const address = req.query.address as string;
  const chain = req.query.chain as string;
  const type = req.query.type as string;

  if (!address) {
    return res.status(400).json({ error: "Missing address" });
  }

  try {
    const walletModule = (await import("../../src/lib/api/wallet")) as Record<string, any>;
    const walletSource = walletModule.default ?? walletModule;

    let history: any[] = [];
    if (type === "solana" || chain === "SOL") {
      history = await walletSource.getSolanaHistory(address);
    } else if (type === "sui" || chain === "SUI") {
      history = await walletSource.getSuiHistory(address);
    } else if (type === "aptos" || chain === "APT") {
      history = await walletSource.getAptosHistory(address);
    } else if (type === "ton" || chain === "TON") {
      history = await walletSource.getTonHistory(address);
    } else if (type === "tron" || chain === "TRX") {
      history = await walletSource.getTronHistory(address);
    } else if (type === "xrp" || chain === "XRP") {
      history = await walletSource.getXrpHistory(address);
    } else if (type === "btc" || chain === "BTC") {
      history = await walletSource.getBitcoinHistory(address);
    } else if (type === "hbar" || chain === "HBAR") {
      history = await walletSource.getHederaHistory(address);
    } else {
      history = await walletSource.getEvmHistory(address, (chain as any) || "ETH");
    }
    res.json(history);
  } catch (error: any) {
    console.error("Wallet History Proxy Error:", error);
    res.status(500).json({ error: error.message });
  }
}
