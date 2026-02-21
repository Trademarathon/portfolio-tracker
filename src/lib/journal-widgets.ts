/**
 * Journal Widget Definitions - Single source of truth for Journal Dashboard widgets.
 * Keep icons and labels uniform across Add Widget modal and WidgetGrid cards.
 */

import type { LucideIcon } from 'lucide-react';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Percent,
    Clock,
    BarChart3,
    Activity,
    Target,
} from 'lucide-react';

export type JournalWidgetCategory = 'performance' | 'metrics' | 'analysis';

export interface JournalWidgetDefinition {
    id: string;
    name: string;
    description: string;
    icon: LucideIcon;
    category: JournalWidgetCategory;
}

export const JOURNAL_WIDGET_DEFINITIONS: JournalWidgetDefinition[] = [
    { id: 'pnl_cumulative', name: 'PnL (Cumulative)', description: 'Total cumulative profit/loss over time', icon: TrendingUp, category: 'performance' },
    { id: 'win_rate', name: 'Win Rate', description: 'Percentage of winning trades', icon: Percent, category: 'metrics' },
    { id: 'pnl', name: 'PnL', description: 'Individual trade profit/loss', icon: DollarSign, category: 'performance' },
    { id: 'hold_time', name: 'Hold Time', description: 'Average time in trades', icon: Clock, category: 'metrics' },
    { id: 'volume_cumulative', name: 'Volume (Cumulative)', description: 'Total trading volume over time', icon: BarChart3, category: 'analysis' },
    { id: 'total_trades', name: 'Total Trades', description: 'Number of trades executed', icon: Activity, category: 'metrics' },
    { id: 'biggest_loss', name: 'Biggest Loss', description: 'Largest losing trade', icon: TrendingDown, category: 'performance' },
    { id: 'biggest_profit', name: 'Biggest Profit', description: 'Largest winning trade', icon: TrendingUp, category: 'performance' },
    { id: 'fees', name: 'Fees', description: 'Trading fees breakdown', icon: DollarSign, category: 'metrics' },
    { id: 'fees_cumulative', name: 'Fees (Cumulative)', description: 'Total fees over time', icon: DollarSign, category: 'analysis' },
    { id: 'loss_factor', name: 'Loss Factor', description: 'Average loss per trade', icon: Target, category: 'metrics' },
    { id: 'profit_factor', name: 'Profit Factor', description: 'Ratio of gross profit to loss', icon: Target, category: 'metrics' },
];
