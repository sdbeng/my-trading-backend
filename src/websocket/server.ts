import { WebSocketServer, WebSocket } from 'ws'
import express, { Express } from 'express'
import * as http from 'http'
import cors from 'cors'
import helmet from 'helmet'
import 'express-async-errors'

interface WebSocketMessage {
  type: string
  payload: unknown
}

const app: Express = express()
app.use(cors())
app.use(helmet())
app.use(express.json())

const server = http.createServer(app)
const wss = new WebSocketServer({ server })

wss.on('connection', (ws: WebSocket) => {
  ws.on('message', (message: string) => {
    try {
      const parsedMessage: WebSocketMessage = JSON.parse(message)
      // Handle messages based on type
      switch (parsedMessage.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }))
          break
        // Add more message handlers
      }
    } catch (error) {
      console.error('Failed to parse message:', error)
    }
  })

  ws.on('close', () => {
    // Cleanup on disconnect
  })
})

const PORT = process.env.PORT || 8080
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`)
})