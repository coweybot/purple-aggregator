import express from 'express';
import { getAllQuotes, getBestQuote } from '../utils/quoteAggregator.js';

const router = express.Router();

/**
 * GET /api/quote
 * Get quotes from all aggregators
 * 
 * Query params:
 * - tokenIn: Address of token to sell
 * - tokenOut: Address of token to buy
 * - amount: Amount in wei
 * - slippage: Slippage tolerance (default 0.5%)
 * - userAddress: (optional) User's wallet address
 */
router.get('/quote', async (req, res) => {
  try {
    const { tokenIn, tokenOut, amount, slippage = '0.5', userAddress } = req.query;
    
    if (!tokenIn || !tokenOut || !amount) {
      return res.status(400).json({ 
        error: 'Missing required params: tokenIn, tokenOut, amount' 
      });
    }

    const quotes = await getAllQuotes({
      tokenIn,
      tokenOut,
      amount,
      slippage: parseFloat(slippage),
      userAddress
    });

    const bestQuote = getBestQuote(quotes);

    res.json({
      success: true,
      bestQuote,
      allQuotes: quotes,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Quote error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch quotes',
      message: error.message 
    });
  }
});

/**
 * GET /api/aggregators
 * List available aggregators and their status
 */
router.get('/aggregators', (req, res) => {
  res.json({
    aggregators: [
      { name: 'OpenOcean', status: 'active', priority: 1 },
      { name: 'KyberSwap', status: 'active', priority: 2 },
      { name: '0x', status: 'active', priority: 3 },
      { name: 'Monorail', status: 'pending', priority: 4 },
      { name: 'Kuru', status: 'pending', priority: 5 },
      { name: 'Mace', status: 'active', priority: 4 },
      { name: 'Azaar', status: 'pending', priority: 7 },
      { name: 'LFJ', status: 'pending', priority: 8 },
      { name: 'Matcha', status: 'active', priority: 9 },
      { name: 'Eisen', status: 'pending', priority: 10 },
    ]
  });
});

export default router;
