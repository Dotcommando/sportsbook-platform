import type { ILatencySummary } from './experiment.model.js';

export class Latencies {
  readonly bounds = Array.from({ length: 1401 }, (_, index) => Math.expm1(index / 100));
  readonly counts = Array<number>(1402).fill(0);
  private count = 0;
  private maximum = 0;

  record(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) {
      throw new Error('Invalid latency');
    }

    const bucket = Math.min(1401, Math.ceil(Math.log1p(ms) * 100));

    this.count++;
    this.maximum = Math.max(this.maximum, ms);
    this.counts[bucket] = (this.counts[bucket] ?? 0) + 1;
  }

  summary(): ILatencySummary {
    const percentile = (ratio: number): number => {
      if (!this.count) {
        return 0;
      }

      let sum = 0;

      for (let i = 0; i < this.counts.length; i++) {
        sum += this.counts[i] ?? 0;

        if (sum >= Math.ceil(this.count * ratio)) {
          return Math.min(this.maximum, this.bounds[i] ?? this.maximum);
        }
      }

      return this.maximum;
    };

    return {
      unit: 'milliseconds',
      count: this.count,
      p50: percentile(.5),
      p95: percentile(.95),
      p99: percentile(.99),
      maximum: this.maximum,
    };
  }
}
