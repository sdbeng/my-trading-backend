import mongoose from 'mongoose';

const signalSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  action: { 
    type: String, 
    enum: ['BUY', 'SELL'], 
    required: true 
  },
  price: { type: Number, required: true },
  confidence: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
});

export const Signal = mongoose.model('Signal', signalSchema); 