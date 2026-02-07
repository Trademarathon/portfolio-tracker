
import { Transaction } from './types';
import { CexTransfer } from './cex';

export interface InternalTransfer {
    id: string;
    type: 'Internal';
    asset: string;
    amount: number;
    from: string; // Exchange/Wallet Name
    to: string;   // Exchange/Wallet Name
    timestamp: number;
    status: 'completed' | 'pending';
    txHash?: string;
}

export type UnifiedActivity =
    | (Transaction & { activityType: 'trade' })
    | (CexTransfer & { activityType: 'transfer' })
    | (InternalTransfer & { activityType: 'internal' });

// Wallets map: address -> name
export function processActivities(
    trades: Transaction[],
    transfers: CexTransfer[],
    walletAddresses: { [address: string]: string }
): UnifiedActivity[] {
    const activities: UnifiedActivity[] = [];

    // 1. Mark Trades
    trades.forEach(t => activities.push({ ...t, activityType: 'trade' }));

    // 2. Process Transfers for Internal Matches
    // We look for:
    // A) Withdrawal from Exchange A to Address X, where Address X is in walletAddresses
    // B) Two transfers (Withdrawal A -> Deposit B) with similar amount/time (Heuristic)

    const processedTransferIds = new Set<string>();

    // Sort transfers by time descending
    const sortedTransfers = [...transfers].sort((a, b) => b.timestamp - a.timestamp);

    for (const t of sortedTransfers) {
        if (processedTransferIds.has(t.id)) continue;

        // Check A: Known Destination Address
        if (t.type === 'Withdraw' && t.address && walletAddresses[t.address] && t.address.length > 5) {
            // It's a transfer to our own wallet!
            activities.push({
                id: `internal-${t.id}`,
                type: 'Internal',
                activityType: 'internal',
                asset: t.asset,
                amount: t.amount,
                from: 'Exchange', // We might not know exact name here unless passed in transfer
                to: walletAddresses[t.address],
                timestamp: t.timestamp,
                status: t.status as any,
                txHash: t.txHash
            });
            processedTransferIds.add(t.id);
            continue;
        }

        // Check B: Match Withdrawal/Deposit Pair
        // Look for companion
        if (t.type === 'Withdraw') {
            // Find a Deposit of same asset, similar amount, slightly later time
            const match = sortedTransfers.find(d =>
                d.type === 'Deposit' &&
                !processedTransferIds.has(d.id) &&
                d.asset === t.asset &&
                d.timestamp >= t.timestamp &&
                d.timestamp <= t.timestamp + (60 * 60 * 1000) && // Within 1 hour
                Math.abs(d.amount - t.amount) / t.amount < 0.05 // Within 5% (fees)
            );

            if (match) {
                activities.push({
                    id: `internal-${t.id}-${match.id}`,
                    type: 'Internal',
                    activityType: 'internal',
                    asset: t.asset,
                    amount: match.amount, // Use received amount
                    from: 'Exchange', // Ideally t.exchangeName
                    to: 'Exchange',   // Ideally match.exchangeName
                    timestamp: match.timestamp, // Use arrival time
                    status: 'completed',
                    txHash: t.txHash || match.txHash
                });
                processedTransferIds.add(t.id);
                processedTransferIds.add(match.id);
                continue;
            }
        }

        // If no match, add as regular transfer
        activities.push({ ...t, activityType: 'transfer' });
        processedTransferIds.add(t.id);
    }

    return activities.sort((a, b) => b.timestamp - a.timestamp);
}
