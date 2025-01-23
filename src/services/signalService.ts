import { Signal } from '../models/signal.js';

export async function getLatestSignals(symbols: string[], limit = 10) {
  return Signal.find({ symbol: { $in: symbols } })
    .sort({ timestamp: -1 })
    .limit(limit);
}

export async function getSignalStats(symbol: string) {
  return Signal.aggregate([
    { $match: { symbol } },
    { $group: {
      _id: '$action',
      count: { $sum: 1 },
      avgConfidence: { $avg: '$confidence' }
    }}
  ]);
} 