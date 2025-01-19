import { WebSocketServer, WebSocket } from 'ws'
import express from 'express'
import { createServer } from 'http'
import cors from 'cors'
import helmet from 'helmet'
import 'express-async-errors'

interface WebSocketMessage {
  type: string
  payload: unknown
}

const app = express()
app.use(cors())
app.use(helmet())
app.use(express.json())

const server = createServer(app)
const wss = new WebSocketServer({ server })

wss.on('connection', (ws: WebSocket) => {
  console.log('New client connected');
  
  // Send welcome message
  ws.send(JSON.stringify({ type: 'welcome', payload: 'Connected to WebSocket server' }));

  ws.on('message', (message: string) => {
    console.log('Received:', message.toString());
    try {
      const parsedMessage: WebSocketMessage = JSON.parse(message.toString())
      // Handle messages based on type
      switch (parsedMessage.type) {
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
          console.log('Unknown message type:', parsedMessage.type);
          ws.send(JSON.stringify({ 
            type: 'error', 
            payload: 'Unknown message type' 
          }));
      }
    } catch (error) {
      console.error('Failed to parse message:', error)
    }
  })

  ws.on('close', () => {
    console.log('Client disconnected');
  })
})

// Add after creating the server
server.on('error', (error) => {
  console.error('Server error:', error);
});

const PORT = process.env.PORT || 8080
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
}).on('error', (error) => {
  console.error('Error starting server:', error);
});