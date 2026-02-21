import type { Request, Response } from "express";

export async function portfolioHandler(req: Request, res: Response) {
  const address = req.query.address as string;
  const chain = req.query.chain as string;
  const type = req.query.type as string;

  if (!address) {
    return res.status(400).json({ error: "Missing address" });
  }

  try {
    const walletModule = (await import("../../src/lib/api/wallet")) as Record<string, any>;
    const walletSource = walletModule.default ?? walletModule;

    let balances: any = [];
    if (type === "zerion") {
      const zerionModule = await import("../../src/lib/api/zerion");
      const getZerionPort = zerionModule.getZerionFullPortfolio || ((zerionModule as any).default && (zerionModule as any).default.getZerionFullPortfolio);
      if (getZerionPort) {
        balances = await getZerionPort(address);
      }
    } else if (type === "solana" || chain === "SOL") {
      balances = await walletSource.getSolanaPortfolio(address);
    } else if (type === "bitcoin" || chain === "BTC") {
      balances = await walletSource.getBitcoinPortfolio(address);
    } else if (type === "hedera" || chain === "HBAR") {
      balances = await walletSource.getHederaPortfolio(address);
    } else if (type === "sui" || chain === "SUI") {
      balances = await walletSource.getSuiPortfolio(address);
    } else if (type === "aptos" || chain === "APT") {
      balances = await walletSource.getAptosPortfolio(address);
    } else if (type === "ton" || chain === "TON") {
      balances = await walletSource.getTonPortfolio(address);
    } else if (type === "tron" || chain === "TRX" || chain === "TRON") {
      balances = await walletSource.getTronPortfolio(address);
    } else if (type === "xrp" || chain === "XRP") {
      balances = await walletSource.getXrpPortfolio(address);
    } else {
      balances = await walletSource.getEvmPortfolio(address, (chain as any) || "ETH");
    }
    res.json(balances);
  } catch (error: any) {
    console.error("Wallet Proxy Error:", error);
    res.status(500).json({ error: error.message });
  }
}
