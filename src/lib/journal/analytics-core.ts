export type SeriesPoint = {
  date: number;
  value: number;
};

export type CumulativeSeriesStats = {
  pnlSeries: SeriesPoint[];
  drawdownSeries: SeriesPoint[];
  totalPnl: number;
  maxDrawdown: number;
};

export type SessionBucket = {
  pnl: number;
  count: number;
  wins: number;
  losses: number;
};

export type DayOfWeekBucket = SessionBucket & {
  day: string;
  dayIndex: number;
};

export type TimeOfDayBucket = SessionBucket & {
  hour: number;
};

function toFiniteNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildCumulativePnlAndDrawdownSeries<T>(
  events: T[],
  options: {
    getTimestamp: (event: T) => number;
    getPnlDelta: (event: T) => number;
  }
): CumulativeSeriesStats {
  const sorted = [...events].sort(
    (a, b) => options.getTimestamp(a) - options.getTimestamp(b)
  );

  let cumulativePnl = 0;
  let peakPnl = 0;
  let maxDrawdown = 0;
  const pnlSeries: SeriesPoint[] = [];
  const drawdownSeries: SeriesPoint[] = [];

  sorted.forEach((event) => {
    const timestamp = toFiniteNumber(options.getTimestamp(event));
    const pnlDelta = toFiniteNumber(options.getPnlDelta(event));
    cumulativePnl += pnlDelta;
    peakPnl = Math.max(peakPnl, cumulativePnl);
    const drawdown = cumulativePnl - peakPnl;
    maxDrawdown = Math.min(maxDrawdown, drawdown);

    pnlSeries.push({ date: timestamp, value: cumulativePnl });
    drawdownSeries.push({ date: timestamp, value: drawdown });
  });

  return {
    pnlSeries,
    drawdownSeries,
    totalPnl: cumulativePnl,
    maxDrawdown,
  };
}

export function buildUtcDayOfWeekBuckets<T>(
  events: T[],
  options: {
    getTimestamp: (event: T) => number;
    getPnl: (event: T) => number;
    dayLabels?: string[];
  }
): DayOfWeekBucket[] {
  const labels = options.dayLabels || [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const buckets = labels.map((day, dayIndex) => ({
    day,
    dayIndex,
    pnl: 0,
    count: 0,
    wins: 0,
    losses: 0,
  }));

  events.forEach((event) => {
    const timestamp = toFiniteNumber(options.getTimestamp(event));
    if (!Number.isFinite(timestamp) || timestamp <= 0) return;

    const dayIndex = new Date(timestamp).getUTCDay();
    const bucket = buckets[dayIndex];
    if (!bucket) return;

    const pnl = toFiniteNumber(options.getPnl(event));
    bucket.pnl += pnl;
    bucket.count += 1;
    if (pnl > 0) bucket.wins += 1;
    if (pnl < 0) bucket.losses += 1;
  });

  return buckets;
}

export function buildUtcTwoHourBuckets<T>(
  events: T[],
  options: {
    getTimestamp: (event: T) => number;
    getPnl: (event: T) => number;
  }
): TimeOfDayBucket[] {
  const buckets: TimeOfDayBucket[] = Array.from({ length: 12 }, (_, index) => ({
    hour: index * 2,
    pnl: 0,
    count: 0,
    wins: 0,
    losses: 0,
  }));

  events.forEach((event) => {
    const timestamp = toFiniteNumber(options.getTimestamp(event));
    if (!Number.isFinite(timestamp) || timestamp <= 0) return;

    const hour = new Date(timestamp).getUTCHours();
    const bucketIndex = Math.floor(hour / 2);
    const bucket = buckets[bucketIndex];
    if (!bucket) return;

    const pnl = toFiniteNumber(options.getPnl(event));
    bucket.pnl += pnl;
    bucket.count += 1;
    if (pnl > 0) bucket.wins += 1;
    if (pnl < 0) bucket.losses += 1;
  });

  return buckets;
}
