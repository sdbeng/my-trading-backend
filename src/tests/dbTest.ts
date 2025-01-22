import { connectDB } from '../config/database.js';
import { Subscription } from '../models/subscription.js';
import { Signal } from '../models/signal.js';

async function testDatabase() {
  try {
    // Connect to database
    await connectDB();
    console.log('Database connection successful');

    // Test Subscription Model
    const testSubscription = await Subscription.create({
      clientId: 'test-client-1',
      symbols: ['BTC/USD', 'ETH/USD'],
      tier: 'free'
    });
    console.log('Created test subscription:', testSubscription);

    // Test Signal Model
    const testSignal = await Signal.create({
      symbol: 'BTC/USD',
      action: 'BUY',
      price: 42000,
      confidence: 0.85
    });
    console.log('Created test signal:', testSignal);

    // Test Query
    const foundSubscription = await Subscription.findOne({ clientId: 'test-client-1' });
    console.log('Found subscription:', foundSubscription);

    // Cleanup
    await Subscription.deleteOne({ clientId: 'test-client-1' });
    await Signal.deleteOne({ _id: testSignal._id });
    console.log('Cleanup completed');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    process.exit();
  }
}

testDatabase(); 