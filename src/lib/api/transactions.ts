
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
    const seenIds = new Set<string>();

    const addActivity = (act: UnifiedActivity) => {
        // Create a unique compound key if ID isn't enough (e.g. for CEX with non-unique IDs)
        // For standard txs, ID or TxHash is usually sufficient. 
        // We Use ID + Type to be safe.
        const uniqueKey = `${act.id}-${act.activityType}`;

        if (!seenIds.has(uniqueKey)) {
            seenIds.add(uniqueKey);
            activities.push(act);
        }
    };

    // 1. Mark Trades
    trades.forEach(t => addActivity({ ...t, activityType: 'trade' }));

    // 2. Process Transfers
    const processedTransferIds = new Set<string>();

    // Sort transfers by time descending to prioritize matching
    const sortedTransfers = [...transfers].sort((a, b) => b.timestamp - a.timestamp);

    // Optimization: Create a map of possible deposits for O(1) lookup
    // Key: `${asset}-${approx_timestamp}-${amount}` bucket? 
    // Easier: Map<Asset, Deposit[]> sorted by time.
    const depositsByAsset = new Map<string, CexTransfer[]>();
    sortedTransfers.forEach(t => {
        if (t.type === 'Deposit') {
            if (!depositsByAsset.has(t.asset)) depositsByAsset.set(t.asset, []);
            depositsByAsset.get(t.asset)!.push(t);
        }
    });

    for (const t of sortedTransfers) {
        if (processedTransferIds.has(t.id)) continue;

        // Check A: Known Destination Address (Internal Transfer)
        if (t.type === 'Withdraw' && t.address && walletAddresses[t.address] && t.address.length > 5) {
            addActivity({
                id: `internal-${t.id}`,
                type: 'Internal',
                activityType: 'internal',
                asset: t.asset,
                amount: t.amount,
                from: 'Exchange',
                to: walletAddresses[t.address],
                timestamp: t.timestamp,
                status: t.status as any,
                txHash: t.txHash
            });
            processedTransferIds.add(t.id);
            continue;
        }

        // Check B: Match Withdrawal/Deposit Pair (Internal Transfer)
        if (t.type === 'Withdraw') {
            // Optimization: Look only in the specific asset's deposits
            const candidates = depositsByAsset.get(t.asset) || [];

            // Find a Deposit of same asset, similar amount, slightly later time
            // Since candidates are sorted desc, we can iterate or find efficiently
            // We want d.timestamp >= t.timestamp (Deposit happens AFTER withdrawal)
            // But strict >= might miss clock skew, so maybe allow small window before too? 
            // Lets stick to original logic: roughly simultaneous or slightly later.

            const match = candidates.find(d =>
                !processedTransferIds.has(d.id) &&
                d.timestamp >= t.timestamp &&
                d.timestamp <= t.timestamp + (60 * 60 * 1000) && // Within 1 hour
                Math.abs(d.amount - t.amount) / t.amount < 0.05
            );

            if (match) {
                addActivity({
                    id: `internal-${t.id}-${match.id}`,
                    type: 'Internal',
                    activityType: 'internal',
                    asset: t.asset,
                    amount: match.amount,
                    from: 'Exchange',
                    to: 'Exchange',
                    timestamp: match.timestamp,
                    status: 'completed',
                    txHash: t.txHash || match.txHash
                });
                processedTransferIds.add(t.id);
                processedTransferIds.add(match.id);
                continue;
            }
        }

        // Regular Transfer
        addActivity({ ...t, activityType: 'transfer' });
        processedTransferIds.add(t.id);
    }

    return activities.sort((a, b) => b.timestamp - a.timestamp);
}
