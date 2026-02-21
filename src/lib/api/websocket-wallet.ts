import { ethers } from 'ethers';
import { Connection, PublicKey } from '@solana/web3.js';
import { WebSocketMessage } from './websocket-types';
import { WS_ENDPOINTS } from './websocket-endpoints';

type WalletUpdateHandler = (message: WebSocketMessage) => void;

interface WalletMonitor {
    address: string;
    chain: string;
    ws?: WebSocket;
    provider?: unknown;
    unsubscribe?: () => void;
}

const RPC_HEALTH_CACHE = new Map<string, { ok: boolean; ts: number }>();
const RPC_OK_TTL_MS = 5 * 60 * 1000;
const RPC_FAIL_TTL_MS = 60 * 1000;

export class WalletWebSocketManager {
    private monitors: Map<string, WalletMonitor> = new Map();

    constructor(private onUpdate: WalletUpdateHandler) { }

    public async startMonitoring(address: string, chain: string, name: string) {
        const monitorId = `${chain}_${address}`;

        if (this.monitors.has(monitorId)) {
            console.log(`[Wallet WS] Already monitoring ${chain} address: ${address}`);
            return;
        }

        console.log(`[Wallet WS] Starting monitor for ${chain} address: ${address}`);

        try {
            if (chain === 'ETH' || chain === 'ARB' || chain === 'MATIC' || chain === 'OP' ||
                chain === 'BASE' || chain === 'AVAX' || chain === 'BSC') {
                await this.monitorEVM(address, chain, name);
            } else if (chain === 'SOL') {
                await this.monitorSolana(address, name);
            } else if (chain === 'BTC') {
                await this.monitorBitcoin(address, name);
            } else if (chain === 'HBAR') {
                await this.monitorHedera(address, name);
            }
        } catch (error) {
            console.warn(`[Wallet WS] Failed to start monitoring ${chain}:`, error);
        }
    }

    // EVM Wallet Monitor (ETH, ARB, MATIC, OP, BASE, AVAX, BSC)
    private async monitorEVM(address: string, chain: string, name: string) {
        const rpcUrls: { [key: string]: string } = {
            'ETH': 'https://cloudflare-eth.com',
            'ARB': 'https://arb1.arbitrum.io/rpc',
            'MATIC': 'https://polygon-rpc.com',
            'OP': 'https://mainnet.optimism.io',
            'BASE': 'https://mainnet.base.org',
            'AVAX': 'https://api.avax.network/ext/bc/C/rpc',
            'BSC': 'https://bsc-dataseed.binance.org'
        };
        const chainIds: { [key: string]: number } = {
            'ETH': 1,
            'ARB': 42161,
            'MATIC': 137,
            'OP': 10,
            'BASE': 8453,
            'AVAX': 43114,
            'BSC': 56
        };

        const rpcUrl = rpcUrls[chain] || rpcUrls['ETH'];
        const chainId = chainIds[chain] || chainIds['ETH'];

        const probeRpc = async (url: string, expectedChainId: number): Promise<boolean> => {
            const cached = RPC_HEALTH_CACHE.get(url);
            if (cached) {
                const ttl = cached.ok ? RPC_OK_TTL_MS : RPC_FAIL_TTL_MS;
                if (Date.now() - cached.ts < ttl) return cached.ok;
            }
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 3500);
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
                    signal: controller.signal
                });
                const raw = await response.text();
                if (!raw) return false;
                let data: any;
                try {
                    data = JSON.parse(raw);
                } catch {
                    return false;
                }
                if (!data?.result) {
                    RPC_HEALTH_CACHE.set(url, { ok: false, ts: Date.now() });
                    return false;
                }
                const parsed = typeof data.result === 'string' ? parseInt(data.result, 16) : Number(data.result);
                const ok = Number.isFinite(parsed) && parsed === expectedChainId;
                RPC_HEALTH_CACHE.set(url, { ok, ts: Date.now() });
                return ok;
            } catch {
                RPC_HEALTH_CACHE.set(url, { ok: false, ts: Date.now() });
                return false;
            } finally {
                clearTimeout(timer);
            }
        };

        const rpcOk = await probeRpc(rpcUrl, chainId);
        if (!rpcOk) {
            console.warn(`[EVM Monitor] RPC preflight failed (${chain}).`);
            return;
        }
        // Use JsonRpcProvider instead of WebSocketProvider for better stability with public nodes
        // It uses polling for events which is more reliable than WSS on free tiers
        const provider = new ethers.JsonRpcProvider(rpcUrl, { name: chain, chainId }, { staticNetwork: true });
        provider.pollingInterval = 15000;
        // Add error listener to prevent unhandled 'error' events
        (provider as unknown as { on: (event: string, cb: (error: unknown) => void) => void }).on('error', (error: unknown) => {
            console.warn(`[EVM Monitor] Provider Error (${chain}):`, error);
        });

        const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
            let timer: ReturnType<typeof setTimeout> | null = null;
            return new Promise<T>((resolve, reject) => {
                timer = setTimeout(() => reject(new Error('RPC timeout')), ms);
                promise
                    .then(resolve)
                    .catch(reject)
                    .finally(() => {
                        if (timer) clearTimeout(timer);
                    });
            });
        };

        const monitorId = `${chain}_${address}`;
        try {
            await withTimeout(provider.getBlockNumber(), 6000);
        } catch (error) {
            console.warn(`[EVM Monitor] RPC not reachable (${chain}):`, error);
            provider.removeAllListeners();
            if (provider.destroy) {
                provider.destroy();
            }
            return;
        }

        // Subscribe to new blocks to check balance changes
        provider.on('block', async (blockNumber) => {
            try {
                const balance = await provider.getBalance(address);

                this.onUpdate({
                    source: name,
                    connectionId: monitorId,
                    type: 'blockchain',
                    data: {
                        chain,
                        address,
                        balance: ethers.formatEther(balance),
                        blockNumber
                    },
                    timestamp: Date.now()
                });
            } catch (error) {
                console.warn(`[EVM Monitor] Error checking balance for ${address}:`, error);
            }
        });

        // Monitor for pending transactions involving this address
        // Disabled to prevent "Method not supported" errors on some RPCs
        /*
        provider.on('pending', async (txHash) => {
            try {
                const tx = await provider.getTransaction(txHash);
                if (tx && (tx.from === address || tx.to === address)) {
                    this.onUpdate({
                        source: name,
                        connectionId: monitorId,
                        type: 'blockchain',
                        data: {
                            chain,
                            address,
                            transaction: {
                                hash: txHash,
                                from: tx.from,
                                to: tx.to,
                                value: ethers.formatEther(tx.value),
                                type: tx.from === address ? 'outgoing' : 'incoming'
                            }
                        },
                        timestamp: Date.now()
                    });
                }
            } catch (error) {
                // Transaction might not be available yet, ignore
            }
        });
        */

        this.monitors.set(monitorId, {
            address,
            chain,
            provider,
            unsubscribe: () => {
                provider.removeAllListeners();
                if (provider.destroy) {
                    provider.destroy();
                }
            }
        });

        console.log(`[EVM Monitor] Successfully started monitoring ${chain} address: ${address}`);
    }

    // Solana Wallet Monitor
    private async monitorSolana(address: string, name: string) {
        const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
        const publicKey = new PublicKey(address);
        const monitorId = `SOL_${address}`;

        try {
            // Polling implementation instead of WebSocket for better stability
            const fetchBalance = async () => {
                try {
                    const accountInfo = await connection.getAccountInfo(publicKey);
                    if (accountInfo) {
                        this.onUpdate({
                            source: name,
                            connectionId: monitorId,
                            type: 'blockchain',
                            data: {
                                chain: 'SOL',
                                address,
                                balance: accountInfo.lamports / 1e9,
                                owner: accountInfo.owner.toString()
                            },
                            timestamp: Date.now()
                        });
                    }
                } catch (e) {
                    console.warn(`[Solana Poll] Error:`, e);
                }
            };

            // Initial fetch
            fetchBalance();

            // Poll every 30 seconds
            const intervalId = setInterval(fetchBalance, 30000);

            this.monitors.set(monitorId, {
                address,
                chain: 'SOL',
                unsubscribe: () => {
                    clearInterval(intervalId);
                }
            });

            console.log(`[Solana Monitor] Successfully started monitoring address: ${address}`);
        } catch (error) {
            console.warn(`[Solana Monitor] Error:`, error);
        }
    }

    // Bitcoin Wallet Monitor (with reconnection)
    private async monitorBitcoin(address: string, name: string) {
        const monitorId = `BTC_${address}`;
        let reconnectAttempts = 0;
        const maxReconnectAttempts = 10;
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
        let currentWs: WebSocket | null = null;
        let stopped = false;

        const connect = () => {
            if (stopped) return;
            const ws = new WebSocket(WS_ENDPOINTS.blockchainInfo.ws);
            currentWs = ws;

            ws.onopen = () => {
                console.log(`[Bitcoin Monitor] Connected for address: ${address}`);
                reconnectAttempts = 0;
                ws.send(JSON.stringify({ op: 'addr_sub', addr: address }));
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data) as Record<string, unknown>;
                    if (msg.op === 'utx') {
                        const tx = (msg.x || {}) as Record<string, unknown>;
                        const outs = (tx.out as unknown[]) || [];
                        const isIncoming = outs.some((o) => (o as Record<string, unknown>).addr === address);
                        this.onUpdate({
                            source: name,
                            connectionId: monitorId,
                            type: 'blockchain',
                            data: {
                                chain: 'BTC',
                                address,
                        transaction: {
                            hash: String(tx.hash || ''),
                            value: outs.reduce((s: number, o: unknown) => {
                                const ro = o as Record<string, unknown>;
                                return ro.addr === address ? s + Number(ro.value || 0) : s;
                            }, 0) / 1e8,
                            type: isIncoming ? 'incoming' : 'outgoing'
                        }
                            },
                            timestamp: Date.now()
                        });
                    }
                } catch (e) {
                    console.warn(`[Bitcoin Monitor] Parse error:`, e);
                }
            };

            ws.onerror = () => {
                console.warn(`[Bitcoin Monitor] WebSocket error for ${address}`);
            };

            ws.onclose = () => {
                currentWs = null;
                console.log(`[Bitcoin Monitor] Disconnected for address: ${address}`);
                if (!stopped && reconnectAttempts < maxReconnectAttempts) {
                    reconnectAttempts++;
                    const delay = Math.min(2000 * Math.pow(2, reconnectAttempts - 1), 60000);
                    reconnectTimer = setTimeout(connect, delay);
                }
            };
        };

        connect();
        this.monitors.set(monitorId, {
            address,
            chain: 'BTC',
            unsubscribe: () => {
                stopped = true;
                if (reconnectTimer) clearTimeout(reconnectTimer);
                reconnectTimer = null;
                if (currentWs) {
                    currentWs.close();
                    currentWs = null;
                }
            }
        });
    }

    // Hedera (HBAR) Wallet Monitor - uses polling (Mirror Node REST API)
    private async monitorHedera(address: string, name: string) {
        const monitorId = `HBAR_${address}`;
        const MIRROR_URL = 'https://mainnet.mirrornode.hedera.com';
        const accountId = /^0\.0\.\d+$/.test(address) ? address : `0.0.${address}`;

        const fetchBalance = async () => {
            try {
                const res = await fetch(`${MIRROR_URL}/api/v1/accounts/${accountId}`);
                if (!res.ok) return;
                const data = await res.json();
                const balance = data.balance?.balance ?? 0;
                this.onUpdate({
                    source: name,
                    connectionId: monitorId,
                    type: 'blockchain',
                    data: {
                        chain: 'HBAR',
                        address,
                        balance: Number(balance) / 1e8,
                        accountId
                    },
                    timestamp: Date.now()
                });
            } catch (e) {
                console.warn(`[Hedera Monitor] Poll error:`, e);
            }
        };

        await fetchBalance();
        const intervalId = setInterval(fetchBalance, 30000);

        this.monitors.set(monitorId, {
            address,
            chain: 'HBAR',
            unsubscribe: () => {
                clearInterval(intervalId);
            }
        });
        console.log(`[Hedera Monitor] Started polling for account: ${accountId}`);
    }

    public stopMonitoring(address: string, chain: string) {
        const monitorId = `${chain}_${address}`;
        const monitor = this.monitors.get(monitorId);

        if (monitor && monitor.unsubscribe) {
            monitor.unsubscribe();
            this.monitors.delete(monitorId);
            console.log(`[Wallet WS] Stopped monitoring ${chain} address: ${address}`);
        }
    }

    public stopAll() {
        for (const [_id, monitor] of this.monitors.entries()) {
            if (monitor.unsubscribe) {
                monitor.unsubscribe();
            }
        }
        this.monitors.clear();
        console.log('[Wallet WS] Stopped all wallet monitors');
    }

    public getActiveMonitors(): string[] {
        return Array.from(this.monitors.keys());
    }
}
