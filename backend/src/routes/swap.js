import express from 'express';
import MaceAdapter from '../adapters/mace.js';

const router = express.Router();

// Initialize adapters that support swap execution
const maceAdapter = new MaceAdapter();

/**
 * POST /api/swap
 * Get executable swap data (calldata, to, value) for direct execution
 * 
 * Body params:
 * - tokenIn: Address of token to sell
 * - tokenOut: Address of token to buy
 * - amount: Amount in wei (string)
 * - slippage: Slippage tolerance in % (default 0.5)
 * - userAddress: User's wallet address (required)
 * - recipient: Recipient address (optional, defaults to userAddress)
 * - aggregator: Preferred aggregator (optional, defaults to best available)
 */
router.post('/swap', async (req, res) => {
  try {
    const { 
      tokenIn, 
      tokenOut, 
      amount, 
      slippage = 0.5, 
      userAddress,
      recipient,
      aggregator 
    } = req.body;
    
    if (!tokenIn || !tokenOut || !amount || !userAddress) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required params: tokenIn, tokenOut, amount, userAddress' 
      });
    }

    // For now, only Mace supports direct swap execution
    // We can add more adapters here later (0x, KyberSwap, etc.)
    const swapData = await maceAdapter.getSwapData({
      tokenIn,
      tokenOut,
      amount,
      slippage: parseFloat(slippage),
      userAddress,
      recipient: recipient || userAddress
    });

    if (!swapData.success) {
      return res.status(500).json({
        success: false,
        error: swapData.error || 'Failed to build swap transaction'
      });
    }

    res.json({
      success: true,
      ...swapData,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Swap error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to build swap transaction',
      message: error.message 
    });
  }
});

/**
 * GET /api/swap/supported
 * List aggregators that support direct swap execution
 */
router.get('/swap/supported', (req, res) => {
  res.json({
    aggregators: [
      { 
        name: 'Mace', 
        status: 'active', 
        supportsNative: true,
        supportsERC20: true,
        chainId: 143 // Monad
      }
      // More aggregators can be added here as we implement them
    ]
  });
});

export default router;
