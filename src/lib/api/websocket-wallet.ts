import { ethers } from 'ethers';
import { Connection, PublicKey } from '@solana/web3.js';
import { WebSocketMessage } from './websocket-types';

type WalletUpdateHandler = (message: WebSocketMessage) => void;

interface WalletMonitor {
    address: string;
    chain: string;
    ws?: WebSocket;
    provider?: any;
    unsubscribe?: () => void;
}

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

        const rpcUrl = rpcUrls[chain] || rpcUrls['ETH'];
        // Use JsonRpcProvider instead of WebSocketProvider for better stability with public nodes
        // It uses polling for events which is more reliable than WSS on free tiers
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        // Add error listener to prevent unhandled 'error' events
        // @ts-ignore - ethers v6 EventEmitter
        provider.on('error', (error: any) => {
            console.warn(`[EVM Monitor] Provider Error (${chain}):`, error);
        });

        const monitorId = `${chain}_${address}`;

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

    // Bitcoin Wallet Monitor
    private async monitorBitcoin(address: string, name: string) {
        const ws = new WebSocket('wss://ws.blockchain.info/inv');
        const monitorId = `BTC_${address}`;

        ws.onopen = () => {
            console.log(`[Bitcoin Monitor] Connected for address: ${address}`);
            // Subscribe to address
            ws.send(JSON.stringify({
                op: 'addr_sub',
                addr: address
            }));
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.op === 'utx') {
                // New unconfirmed transaction
                const tx = data.x;
                const isIncoming = tx.out.some((output: any) => output.addr === address);
                const isOutgoing = tx.inputs.some((input: any) => input.prev_out?.addr === address);

                this.onUpdate({
                    source: name,
                    connectionId: monitorId,
                    type: 'blockchain',
                    data: {
                        chain: 'BTC',
                        address,
                        transaction: {
                            hash: tx.hash,
                            value: tx.out.reduce((sum: number, out: any) =>
                                out.addr === address ? sum + out.value : sum, 0) / 1e8,
                            type: isIncoming ? 'incoming' : 'outgoing'
                        }
                    },
                    timestamp: Date.now()
                });
            }
        };

        ws.onerror = (error) => {
            console.warn(`[Bitcoin Monitor] WebSocket error:`, error);
        };

        ws.onclose = () => {
            console.log(`[Bitcoin Monitor] Disconnected for address: ${address}`);
            // TODO: Implement reconnection logic
        };

        this.monitors.set(monitorId, {
            address,
            chain: 'BTC',
            ws,
            unsubscribe: () => {
                ws.close();
            }
        });
    }

    // Hedera (HBAR) Wallet Monitor
    private async monitorHedera(address: string, name: string) {
        // Note: Hedera uses account IDs like "0.0.123456", not traditional addresses
        // This is a simplified implementation - production would need proper Hedera SDK
        const ws = new WebSocket('wss://mainnet.mirrornode.hedera.com/v1/topics/messages');
        const monitorId = `HBAR_${address}`;

        ws.onopen = () => {
            console.log(`[Hedera Monitor] Connected for account: ${address}`);
            // Subscribe to account updates
            // Note: Actual implementation would need Hedera Mirror Node REST API polling
            // or Hedera Consensus Service topic subscription
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            this.onUpdate({
                source: name,
                connectionId: monitorId,
                type: 'blockchain',
                data: {
                    chain: 'HBAR',
                    address,
                    message: data
                },
                timestamp: Date.now()
            });
        };

        ws.onerror = (error) => {
            console.warn(`[Hedera Monitor] WebSocket error:`, error);
        };

        ws.onclose = () => {
            console.log(`[Hedera Monitor] Disconnected for account: ${address}`);
        };

        this.monitors.set(monitorId, {
            address,
            chain: 'HBAR',
            ws,
            unsubscribe: () => {
                ws.close();
            }
        });
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
        for (const [id, monitor] of this.monitors.entries()) {
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
