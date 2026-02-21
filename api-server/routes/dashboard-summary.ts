import type { Request, Response } from "express";

type BalanceRow = {
  symbol: string;
  balance: number;
};

function normalizeSymbol(raw: string): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/^W(?=HBAR$)/, "");
}

const SYMBOL_TO_ID: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  BNB: "binancecoin",
  SOL: "solana",
  XRP: "ripple",
  USDC: "usd-coin",
  USDT: "tether",
  ADA: "cardano",
  AVAX: "avalanche-2",
  DOGE: "dogecoin",
  DOT: "polkadot",
  TRX: "tron",
  LINK: "chainlink",
  MATIC: "matic-network",
  WBTC: "wrapped-bitcoin",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  ATOM: "cosmos",
  XLM: "stellar",
  FIL: "filecoin",
  HBAR: "hbar",
  APT: "aptos",
  ARB: "arbitrum",
  OP: "optimism",
  SUI: "sui",
  INJ: "injective-protocol",
  TON: "the-open-network",
};

async function fetchSimplePrices(symbols: string[]): Promise<Record<string, { price: number; change24h: number }>> {
  if (symbols.length === 0) return {};
  const ids = Array.from(
    new Set(
      symbols
        .map((s) => normalizeSymbol(s))
        .map((s) => SYMBOL_TO_ID[s] || s.toLowerCase())
        .filter(Boolean)
    )
  );
  if (ids.length === 0) return {};

  const url =
    "https://api.coingecko.com/api/v3/simple/price" +
    `?ids=${encodeURIComponent(ids.join(","))}&vs_currencies=usd&include_24hr_change=true`;

  const response = await fetch(url);
  if (!response.ok) return {};

  const idToSymbol = new Map<string, string>();
  for (const [symbol, id] of Object.entries(SYMBOL_TO_ID)) {
    idToSymbol.set(id, symbol);
  }

  const json = (await response.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;
  const result: Record<string, { price: number; change24h: number }> = {};
  for (const [id, row] of Object.entries(json)) {
    const symbol = idToSymbol.get(id) || normalizeSymbol(id);
    const price = Number(row?.usd || 0);
    if (price > 0) {
      result[symbol] = {
        price,
        change24h: Number(row?.usd_24h_change || 0),
      };
    }
  }
  return result;
}

export async function dashboardSummaryHandler(req: Request, res: Response) {
  const address = (req.query.address as string | undefined)?.trim();
  const chain = (req.query.chain as string | undefined)?.trim().toUpperCase();
  const type = (req.query.type as string | undefined)?.trim().toLowerCase();

  try {
    const walletModule = (await import("../../src/lib/api/wallet")) as Record<string, any>;
    const zerionModule = (await import("../../src/lib/api/zerion")) as Record<string, any>;

    const walletSource = walletModule.default ?? walletModule;
    const zerionSource = zerionModule.default ?? zerionModule;

    const getEvmPortfolio = walletSource.getEvmPortfolio as ((address: string, chain?: string) => Promise<BalanceRow[]>);
    const getSolanaPortfolio = walletSource.getSolanaPortfolio as ((address: string) => Promise<BalanceRow[]>);
    const getBitcoinPortfolio = walletSource.getBitcoinPortfolio as ((address: string) => Promise<BalanceRow[]>);
    const getHederaPortfolio = walletSource.getHederaPortfolio as ((address: string) => Promise<BalanceRow[]>);
    const getSuiPortfolio = walletSource.getSuiPortfolio as ((address: string) => Promise<BalanceRow[]>);
    const getAptosPortfolio = walletSource.getAptosPortfolio as ((address: string) => Promise<BalanceRow[]>);
    const getTonPortfolio = walletSource.getTonPortfolio as ((address: string) => Promise<BalanceRow[]>);
    const getTronPortfolio = walletSource.getTronPortfolio as ((address: string) => Promise<BalanceRow[]>);
    const getXrpPortfolio = walletSource.getXrpPortfolio as ((address: string) => Promise<BalanceRow[]>);
    const getZerionFullPortfolio = zerionSource.getZerionFullPortfolio as ((address: string) => Promise<any>);

    if (typeof getEvmPortfolio !== "function" || typeof getZerionFullPortfolio !== "function") {
      throw new Error("Wallet modules are unavailable at runtime");
    }

    let totalValueUsd = 0;
    let assetCount = 0;

    if (address) {
      if (type === "zerion") {
        const portfolio = await getZerionFullPortfolio(address);
        totalValueUsd = Number(portfolio.totalValue || 0);
        assetCount =
          (portfolio.tokens?.length || 0) +
          (portfolio.nfts?.length || 0) +
          (portfolio.defi?.length || 0);
      } else {
        let balances: BalanceRow[] = [];

        if (type === "solana" || chain === "SOL") {
          balances = await getSolanaPortfolio(address);
        } else if (type === "bitcoin" || chain === "BTC") {
          balances = await getBitcoinPortfolio(address);
        } else if (type === "hedera" || chain === "HBAR") {
          balances = await getHederaPortfolio(address);
        } else if (type === "sui" || chain === "SUI") {
          balances = await getSuiPortfolio(address);
        } else if (type === "aptos" || chain === "APT") {
          balances = await getAptosPortfolio(address);
        } else if (type === "ton" || chain === "TON") {
          balances = await getTonPortfolio(address);
        } else if (type === "tron" || chain === "TRX" || chain === "TRON") {
          balances = await getTronPortfolio(address);
        } else if (type === "xrp" || chain === "XRP") {
          balances = await getXrpPortfolio(address);
        } else {
          balances = await getEvmPortfolio(address, (chain as any) || "ETH");
        }

        const tradableBalances = balances.filter((b) => b.balance > 0 && b.symbol);
        assetCount = tradableBalances.length;

        const symbols = Array.from(
          new Set(tradableBalances.map((b) => normalizeSymbol(b.symbol)).filter(Boolean))
        );

        const priceBySymbol = await fetchSimplePrices(symbols);

        totalValueUsd = tradableBalances.reduce((sum, row) => {
          const price = priceBySymbol[normalizeSymbol(row.symbol)]?.price || 0;
          return sum + row.balance * price;
        }, 0);
      }
    }

    const btc = await fetchSimplePrices(["BTC"]);
    const btcRow = btc.BTC;

    res.json({
      totalValueUsd,
      totalPnlUsd: 0,
      totalPnlPercent: 0,
      btcPrice: Number(btcRow?.price || 0),
      btcChange24h: Number(btcRow?.change24h || 0),
      assetCount,
      addressProvided: Boolean(address),
      generatedAt: Date.now(),
    });
  } catch (error: any) {
    console.error("Dashboard Summary Error:", error);
    res.status(500).json({ error: error?.message || "Failed to compute summary" });
  }
}
