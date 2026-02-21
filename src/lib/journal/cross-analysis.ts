import type { JournalTrade } from "@/contexts/JournalContext";
import type { TradeAnnotation } from "@/lib/api/journal-types";
import { buildReportBucket, type ReportBucket } from "@/lib/journal/report-metrics";

export type DimensionAccessor = (trade: JournalTrade, annotation?: TradeAnnotation) => string;

export interface CrossAnalysisMatrix {
  rowLabels: string[];
  columnLabels: string[];
  cells: ReportBucket[][];
}

function sortByBucketCountDesc(entries: Array<[string, JournalTrade[]]>): Array<[string, JournalTrade[]]> {
  return [...entries].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}

export function buildCrossAnalysisMatrix(
  trades: JournalTrade[],
  annotations: Record<string, TradeAnnotation>,
  rowAccessor: DimensionAccessor,
  columnAccessor: DimensionAccessor,
  rowLimit = 8,
  columnLimit = 8
): CrossAnalysisMatrix {
  const rowGroups = new Map<string, JournalTrade[]>();
  const colGroups = new Map<string, JournalTrade[]>();

  trades.forEach((trade) => {
    const annotation = annotations[trade.id];
    const rowKey = rowAccessor(trade, annotation) || "Unknown";
    const colKey = columnAccessor(trade, annotation) || "Unknown";

    if (!rowGroups.has(rowKey)) rowGroups.set(rowKey, []);
    if (!colGroups.has(colKey)) colGroups.set(colKey, []);

    rowGroups.get(rowKey)?.push(trade);
    colGroups.get(colKey)?.push(trade);
  });

  const rowLabels = sortByBucketCountDesc(Array.from(rowGroups.entries()))
    .slice(0, rowLimit)
    .map(([label]) => label);

  const columnLabels = sortByBucketCountDesc(Array.from(colGroups.entries()))
    .slice(0, columnLimit)
    .map(([label]) => label);

  const cells = rowLabels.map((rowLabel) => {
    return columnLabels.map((columnLabel) => {
      const subset = trades.filter((trade) => {
        const annotation = annotations[trade.id];
        return (rowAccessor(trade, annotation) || "Unknown") === rowLabel && (columnAccessor(trade, annotation) || "Unknown") === columnLabel;
      });
      return buildReportBucket(`${rowLabel}__${columnLabel}`, `${rowLabel} / ${columnLabel}`, subset, annotations);
    });
  });

  return {
    rowLabels,
    columnLabels,
    cells,
  };
}
