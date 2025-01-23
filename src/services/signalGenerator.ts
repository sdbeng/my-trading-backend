import { WebSocket } from 'ws';
import { Signal } from '../models/signal.js';

interface GeneratedSignal {
  symbol: string;
  action: 'BUY' | 'SELL';
  price: number;
  confidence: number;
  timestamp: number;
  volume?: number;
  trend?: string;
}

const SYMBOLS = ['BTC/USD', 'ETH/USD', 'SOL/USD'] as const;
type Symbol = typeof SYMBOLS[number];

const BASE_PRICES: Record<Symbol, number> = {
  'BTC/USD': 42000,
  'ETH/USD': 2200,
  'SOL/USD': 98
};

export class SignalGenerator {
  private intervals: NodeJS.Timeout[] = [];
  private subscribers = new Map<string, Set<WebSocket>>();
  private signalCache = new Map<string, GeneratedSignal>();
  private lastDbWrite = new Map<string, number>();
  
  private readonly DB_WRITE_INTERVAL = 60000; // Write to DB every 1 minute

  // Generate realistic price movements
  private generatePrice(basePrice: number): number {
    const volatility = 0.02; // 2% volatility
    const change = basePrice * volatility * (Math.random() - 0.5);
    return Math.round((basePrice + change) * 100) / 100;
  }

  // Generate confidence based on various factors
  private generateConfidence(price: number, basePrice: number): number {
    const priceChange = Math.abs((price - basePrice) / basePrice);
    const trendStrength = Math.random();
    return Math.min(0.95, Math.max(0.3, (trendStrength + (1 - priceChange)) / 2));
  }

  private getTrend(price: number, basePrice: number): string {
    const change = ((price - basePrice) / basePrice) * 100;
    if (change > 1) return 'STRONG_UP';
    if (change > 0.2) return 'UP';
    if (change < -1) return 'STRONG_DOWN';
    if (change < -0.2) return 'DOWN';
    return 'SIDEWAYS';
  }

  private async generateSignal(symbol: Symbol): Promise<GeneratedSignal> {
    const now = Date.now();
    const lastWrite = this.lastDbWrite.get(symbol) || 0;
    const basePrice = BASE_PRICES[symbol];
    const currentPrice = this.generatePrice(basePrice);
    const volume = Math.round(Math.random() * 1000000);
    const confidence = this.generateConfidence(currentPrice, basePrice);
    const trend = this.getTrend(currentPrice, basePrice);
    
    const action = currentPrice > basePrice ? 'BUY' : 'SELL';

    const signal: GeneratedSignal = {
      symbol,
      action,
      price: currentPrice,
      confidence,
      timestamp: Date.now(),
      volume,
      trend
    };

    // Only write to DB if enough time has passed
    if (now - lastWrite > this.DB_WRITE_INTERVAL) {
      await Signal.create({
        symbol,
        action,
        price: currentPrice,
        confidence,
        timestamp: Date.now()
      });
      this.lastDbWrite.set(symbol, now);
    }

    this.signalCache.set(symbol, signal);
    return signal;
  }

  public subscribe(symbol: string, ws: WebSocket): void {
    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, new Set());
      
      // Create interval for this symbol
      const interval = setInterval(async () => {
        try {
          const signal = await this.generateSignal(symbol as Symbol);
          const subscribers = this.subscribers.get(symbol);
          
          subscribers?.forEach(subscriber => {
            if (subscriber.readyState === WebSocket.OPEN) {
              subscriber.send(JSON.stringify({
                type: 'signal',
                payload: signal
              }));
            }
          });
        } catch (error) {
          console.error(`Error generating signal for ${symbol}:`, error);
        }
      }, 5000 + Math.random() * 5000); // Random interval between 5-10 seconds

      this.intervals.push(interval);
    }
    
    this.subscribers.get(symbol)?.add(ws);
  }

  public unsubscribe(symbol: string, ws: WebSocket): void {
    this.subscribers.get(symbol)?.delete(ws);
    
    // Clean up if no subscribers left
    if (this.subscribers.get(symbol)?.size === 0) {
      this.subscribers.delete(symbol);
    }
  }

  public cleanup(): void {
    this.intervals.forEach(clearInterval);
    this.intervals = [];
    this.subscribers.clear();
  }
}

export const signalGenerator = new SignalGenerator(); 