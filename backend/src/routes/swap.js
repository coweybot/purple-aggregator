import express from 'express';
import MaceAdapter from '../adapters/mace.js';
import MonorailAdapter from '../adapters/monorail.js';
import ZeroXAdapter from '../adapters/zerox.js';

const router = express.Router();

// Initialize adapters that support swap execution
const adapters = {
  'Mace': new MaceAdapter(),
  'Monorail': new MonorailAdapter(),
  '0x': new ZeroXAdapter()
};

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
 * - aggregator: Preferred aggregator (optional, defaults to Mace)
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
      aggregator = 'Mace'
    } = req.body;
    
    if (!tokenIn || !tokenOut || !amount || !userAddress) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required params: tokenIn, tokenOut, amount, userAddress' 
      });
    }

    console.log(`[Swap] Request for ${aggregator}: ${tokenIn} -> ${tokenOut}, amount: ${amount}`);
    
    let swapData;
    
    // Route to the correct adapter based on user's selection
    if (aggregator === 'Mace' && adapters['Mace']) {
      // Mace has dedicated getSwapData
      swapData = await adapters['Mace'].getSwapData({
        tokenIn,
        tokenOut,
        amount,
        slippage: parseFloat(slippage),
        userAddress,
        recipient: recipient || userAddress
      });
    } else if (aggregator === 'Monorail' && adapters['Monorail']) {
      // Monorail returns transaction data in getQuote
      const quote = await adapters['Monorail'].getQuote({
        tokenIn,
        tokenOut,
        amount,
        slippage: parseFloat(slippage),
        userAddress
      });
      
      if (quote.transaction) {
        swapData = {
          success: true,
          to: quote.transaction.to,
          data: quote.transaction.data,
          value: quote.transaction.value || '0',
          estimatedGas: quote.estimatedGas || '300000'
        };
      } else {
        // Monorail didn't return transaction data, fall back to Mace
        console.log(`[Swap] Monorail didn't return tx data, falling back to Mace`);
        swapData = await adapters['Mace'].getSwapData({
          tokenIn, tokenOut, amount,
          slippage: parseFloat(slippage),
          userAddress, recipient: recipient || userAddress
        });
      }
    } else if (aggregator === '0x' && adapters['0x']) {
      // 0x returns transaction data in getQuote
      const quote = await adapters['0x'].getQuote({
        tokenIn,
        tokenOut,
        amount,
        slippage: parseFloat(slippage),
        userAddress
      });
      
      if (quote.calldata && quote.to) {
        swapData = {
          success: true,
          to: quote.to,
          data: quote.calldata,
          value: quote.value || '0',
          estimatedGas: quote.estimatedGas || '300000',
          allowanceTarget: quote.allowanceTarget
        };
      } else {
        throw new Error('0x did not return transaction data');
      }
    } else {
      // Unknown aggregator or not available, fall back to Mace
      console.log(`[Swap] Unknown aggregator "${aggregator}", falling back to Mace`);
      swapData = await adapters['Mace'].getSwapData({
        tokenIn, tokenOut, amount,
        slippage: parseFloat(slippage),
        userAddress, recipient: recipient || userAddress
      });
    }

    if (!swapData || !swapData.success) {
      return res.status(500).json({
        success: false,
        error: swapData?.error || 'Failed to build swap transaction'
      });
    }

    res.json({
      success: true,
      ...swapData,
      aggregator: aggregator,
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
