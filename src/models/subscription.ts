import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  clientId: { type: String, required: true },
  symbols: [{ type: String }],
  tier: { 
    type: String, 
    enum: ['free', 'basic', 'premium'], 
    default: 'free' 
  },
  createdAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now }
});

export const Subscription = mongoose.model('Subscription', subscriptionSchema); 