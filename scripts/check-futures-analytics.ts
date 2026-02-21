import assert from "node:assert/strict";
import {
  buildCumulativePnlAndDrawdownSeries,
  buildUtcDayOfWeekBuckets,
  buildUtcTwoHourBuckets,
} from "../src/lib/journal/analytics-core.ts";

type EventRow = {
  timestamp: number;
  pnl: number;
};

function ts(date: string): number {
  return new Date(date).getTime();
}

const events: EventRow[] = [
  // Monday 00:00 UTC
  { timestamp: ts("2026-01-05T00:00:00.000Z"), pnl: 100 },
  // Monday 02:00 UTC
  { timestamp: ts("2026-01-05T02:00:00.000Z"), pnl: -150 },
  // Tuesday 08:00 UTC
  { timestamp: ts("2026-01-06T08:00:00.000Z"), pnl: 60 },
];

const series = buildCumulativePnlAndDrawdownSeries(events, {
  getTimestamp: (row) => row.timestamp,
  getPnlDelta: (row) => row.pnl,
});

assert.equal(series.totalPnl, 10);
assert.deepEqual(
  series.pnlSeries.map((point) => point.value),
  [100, -50, 10]
);
assert.deepEqual(
  series.drawdownSeries.map((point) => point.value),
  [0, -150, -90]
);
assert.equal(series.maxDrawdown, -150);

const dayBuckets = buildUtcDayOfWeekBuckets(events, {
  getTimestamp: (row) => row.timestamp,
  getPnl: (row) => row.pnl,
});
assert.equal(dayBuckets[1]?.count, 2); // Monday
assert.equal(dayBuckets[1]?.wins, 1);
assert.equal(dayBuckets[1]?.losses, 1);
assert.equal(dayBuckets[2]?.count, 1); // Tuesday

const timeBuckets = buildUtcTwoHourBuckets(events, {
  getTimestamp: (row) => row.timestamp,
  getPnl: (row) => row.pnl,
});
assert.equal(timeBuckets[0]?.count, 1); // 00-02
assert.equal(timeBuckets[1]?.count, 1); // 02-04
assert.equal(timeBuckets[4]?.count, 1); // 08-10

console.log("check-futures-analytics: passed");
