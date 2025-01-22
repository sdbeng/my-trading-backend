import { WebSocketServer, WebSocket } from 'ws'
import express from 'express'
import { createServer } from 'http'
import cors from 'cors'
import helmet from 'helmet'
import 'express-async-errors'
import { connectDB } from '../config/database.js'
import { Subscription } from '../models/subscription.js'
import { Signal } from '../models/signal.js'

interface WebSocketMessage {
  type: string
  payload: unknown
}

// Add these new interfaces
interface TradeSignal {
  symbol: string
  action: 'BUY' | 'SELL'
  price: number
  confidence: number
  timestamp: number
}

interface AlertConfig {
  symbol: string
  priceThreshold: number
  direction: 'ABOVE' | 'BELOW'
}

interface ClientSubscription {
  id: string;  // We'll use this to identify clients
  symbols: Set<string>;
  ws: WebSocket;
}

interface SubscriptionMessage {
  type: 'subscribe' | 'unsubscribe';
  payload: {
    symbols: string[];
  }
}

const app = express()
app.use(cors())
app.use(helmet())
app.use(express.json())

const server = createServer(app)
const wss = new WebSocketServer({ server })

const clients = new Map<string, ClientSubscription>();
const symbolSubscribers = new Map<string, Set<string>>(); // symbol -> clientIds

// Connect to database when server starts
connectDB().then(() => {
  console.log('Database connected');
}).catch(error => {
  console.error('Database connection failed:', error);
});

// Update subscription handling to use database
async function addSubscription(clientId: string, symbols: string[], ws: WebSocket) {
  try {
    await Subscription.findOneAndUpdate(
      { clientId },
      { 
        $addToSet: { symbols: { $each: symbols } },
        lastActive: new Date()
      },
      { upsert: true }
    );

    // Update in-memory state
    const existingClient = clients.get(clientId);
    if (existingClient) {
      symbols.forEach(symbol => existingClient.symbols.add(symbol));
    } else {
      clients.set(clientId, {
        id: clientId,
        symbols: new Set(symbols),
        ws
      });
    }

    // Update symbol subscribers
    symbols.forEach(symbol => {
      if (!symbolSubscribers.has(symbol)) {
        symbolSubscribers.set(symbol, new Set());
      }
      symbolSubscribers.get(symbol)?.add(clientId);
    });

    ws.send(JSON.stringify({
      type: 'subscribed',
      payload: {
        symbols,
        total: clients.get(clientId)?.symbols.size
      }
    }));

  } catch (error) {
    console.error('Database error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      payload: 'Subscription failed'
    }));
  }
}

function removeSubscription(clientId: string, symbols?: string[]) {
  const client = clients.get(clientId);
  if (!client) return;

  if (!symbols) {
    // Remove all subscriptions
    client.symbols.forEach(symbol => {
      symbolSubscribers.get(symbol)?.delete(clientId);
    });
    clients.delete(clientId);
  } else {
    // Remove specific symbols
    symbols.forEach(symbol => {
      client.symbols.delete(symbol);
      symbolSubscribers.get(symbol)?.delete(clientId);
    });
  }
}

wss.on('connection', (ws: WebSocket) => {
  const clientId = Math.random().toString(36).substring(7); // Simple ID generation
  console.log(`New client connected: ${clientId}`);
  
  ws.send(JSON.stringify({ 
    type: 'welcome', 
    payload: { 
      clientId,
      message: 'Connected to Trading Signals WebSocket'
    }
  }));

  ws.on('message', (message: string) => {
    console.log('Received:', message.toString());
    try {
      const parsedMessage: WebSocketMessage = JSON.parse(message.toString());
      switch (parsedMessage.type) {
        case 'subscribe':
          const subMessage = parsedMessage as SubscriptionMessage;
          handleSubscription(clientId, ws, subMessage.payload.symbols);
          break;
        case 'unsubscribe':
          const unsubMessage = parsedMessage as SubscriptionMessage;
          handleUnsubscription(clientId, unsubMessage.payload.symbols);
          break;
        case 'getSubscriptions':
          sendSubscriptionStatus(clientId, ws);
          break;
        case 'setAlert':
          // Handle setting up price alerts
          handleAlert(ws, parsedMessage.payload as AlertConfig);
          break;
        case 'getSignals':
          // Send latest signals for subscribed symbols
          sendLatestSignals(ws);
          break;
        case 'ping':
          console.log('Sending pong response');
          ws.send(JSON.stringify({ type: 'pong' }))
          break;
        case 'echo':
          console.log('Echoing message:', parsedMessage.payload);
          ws.send(JSON.stringify({ 
            type: 'echo', 
            payload: parsedMessage.payload 
          }));
          break;
        default:
          ws.send(JSON.stringify({ 
            type: 'error', 
            payload: 'Unknown message type' 
          }));
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  });

  ws.on('close', () => {
    console.log(`Client disconnected: ${clientId}`);
    removeSubscription(clientId);
  });
})

// Add after creating the server
server.on('error', (error) => {
  console.error('Server error:', error);
});

function handleSubscription(clientId: string, ws: WebSocket, symbols: string[]) {
  console.log(`Client ${clientId} subscribing to:`, symbols);
  addSubscription(clientId, symbols, ws);
}

function handleUnsubscription(clientId: string, symbols: string[]) {
  console.log(`Client ${clientId} unsubscribing from:`, symbols);
  removeSubscription(clientId, symbols);
  
  const ws = clients.get(clientId)?.ws;
  if (ws) {
    ws.send(JSON.stringify({
      type: 'unsubscribed',
      payload: {
        symbols,
        remaining: clients.get(clientId)?.symbols.size || 0
      }
    }));
  }
}

function sendSubscriptionStatus(clientId: string, ws: WebSocket) {
  const client = clients.get(clientId);
  ws.send(JSON.stringify({
    type: 'subscriptionStatus',
    payload: {
      symbols: Array.from(client?.symbols || []),
      total: client?.symbols.size || 0
    }
  }));
}

function handleAlert(ws: WebSocket, config: AlertConfig) {
  console.log('Setting alert for:', config);
  // TODO: Store alert configuration
}

function sendLatestSignals(ws: WebSocket) {
  // TODO: Fetch and send latest signals
  const mockSignal: TradeSignal = {
    symbol: 'BTC/USD',
    action: 'BUY',
    price: 42000,
    confidence: 0.85,
    timestamp: Date.now()
  };
  ws.send(JSON.stringify({ 
    type: 'signal', 
    payload: mockSignal 
  }));
}

// Add a broadcast function for sending signals to subscribers
function broadcastSignal(symbol: string, signal: TradeSignal) {
  const subscribers = symbolSubscribers.get(symbol);
  if (!subscribers) return;

  subscribers.forEach(clientId => {
    const client = clients.get(clientId);
    if (client?.ws) {
      client.ws.send(JSON.stringify({
        type: 'signal',
        payload: signal
      }));
    }
  });
}

const PORT = process.env.PORT || 8080
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
}).on('error', (error) => {
  console.error('Error starting server:', error);
});