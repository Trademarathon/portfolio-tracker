import type { SupportedChain } from '@/lib/api/types';

const HEX_REGEX = /^0x[0-9a-fA-F]+$/;

/** Display names for "Chain: [name]" in the wallet-add UI */
export const CHAIN_DISPLAY_NAMES: Record<SupportedChain, string> = {
  ETH: 'Ethereum', ARB: 'Arbitrum', MATIC: 'Polygon', OP: 'Optimism', BASE: 'Base', BSC: 'BNB Chain',
  AVAX: 'Avalanche', FTM: 'Fantom', CELO: 'Celo', CRONOS: 'Cronos', GNOSIS: 'Gnosis', LINEA: 'Linea',
  SCROLL: 'Scroll', ZKSYNC: 'zkSync', MANTLE: 'Mantle', BLAST: 'Blast',
  SOL: 'Solana', BTC: 'Bitcoin', SUI: 'Sui', APT: 'Aptos', TON: 'TON', TRX: 'Tron', NEAR: 'NEAR',
  COSMOS: 'Cosmos', HBAR: 'Hedera', XRP: 'XRP', ADA: 'Cardano', DOT: 'Polkadot', ALGO: 'Algorand',
  XLM: 'Stellar', DOGE: 'Dogecoin', LTC: 'Litecoin', BCH: 'Bitcoin Cash', XTZ: 'Tezos', EOS: 'EOS',
  FIL: 'Filecoin', VET: 'VeChain', EGLD: 'MultiversX', KAVA: 'Kava', INJ: 'Injective',
};

/**
 * Detect blockchain from wallet address format (heuristic, no API).
 * Returns null when address is empty or format is ambiguous/unknown.
 */
export function detectChainFromAddress(address: string): SupportedChain | null {
  const raw = address.trim();
  if (!raw) return null;

  // EVM: 0x + 40 hex chars (length 42)
  if (raw.startsWith('0x')) {
    if (HEX_REGEX.test(raw)) {
      if (raw.length === 42) return 'ETH';
      if (raw.length === 66) return 'APT'; // Aptos (0x + 32 bytes); Sui same length, default to Aptos
    }
    // Other 0x lengths (e.g. 64 hex) treat as EVM fallback
    if (raw.length >= 42 && HEX_REGEX.test(raw)) return 'ETH';
    return null;
  }

  // Bitcoin
  if (raw.startsWith('bc1') || (raw.startsWith('1') && raw.length >= 26 && raw.length <= 34) || (raw.startsWith('3') && raw.length >= 26 && raw.length <= 34)) {
    return 'BTC';
  }

  // TON
  if (raw.startsWith('EQ') || raw.startsWith('UQ')) return 'TON';

  // Tron: T + 33 more = 34 total
  if (raw.startsWith('T') && raw.length === 34) return 'TRX';

  // Hedera: 0.0.123456 style (shard.realm.num)
  if (/^0\.\d+\.\d+$/.test(raw)) return 'HBAR';

  // XRP classic
  if (raw.startsWith('r') && raw.length >= 25 && raw.length <= 35) return 'XRP';

  // Solana: Base58, typically 32-44 chars (no 0x)
  if (raw.length >= 32 && raw.length <= 44 && !raw.includes('.')) return 'SOL';

  return null;
}
