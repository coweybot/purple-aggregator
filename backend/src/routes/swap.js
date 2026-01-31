import express from 'express';
import MaceAdapter from '../adapters/mace.js';
import MonorailAdapter from '../adapters/monorail.js';
import ZeroXAdapter from '../adapters/zerox.js';
import OKXAdapter from '../adapters/okx.js';
import OpenOceanAdapter from '../adapters/openocean.js';
import KyberSwapAdapter from '../adapters/kyberswap.js';

const router = express.Router();

// WMON address for native token conversion
const WMON = '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A';

// Initialize ALL adapters that support swap execution
const adapters = {
  'Mace': new MaceAdapter(),
  'Monorail': new MonorailAdapter(),
  '0x': new ZeroXAdapter(),
  'OKX': new OKXAdapter(),
  'OpenOcean': new OpenOceanAdapter(),
  'KyberSwap': new KyberSwapAdapter()
};

/**
 * POST /api/swap
 * Get executable swap data (calldata, to, value) for direct execution
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
    
    try {
      // Route to the correct adapter based on user's selection
      switch (aggregator) {
        case 'Mace':
          swapData = await adapters['Mace'].getSwapData({
            tokenIn, tokenOut, amount,
            slippage: parseFloat(slippage),
            userAddress,
            recipient: recipient || userAddress
          });
          break;

        case 'Monorail':
          const monorailQuote = await adapters['Monorail'].getQuote({
            tokenIn, tokenOut, amount,
            slippage: parseFloat(slippage),
            userAddress
          });
          if (monorailQuote.transaction) {
            swapData = {
              success: true,
              to: monorailQuote.transaction.to,
              data: monorailQuote.transaction.data,
              value: monorailQuote.transaction.value || '0',
              estimatedGas: monorailQuote.estimatedGas || '300000'
            };
          } else {
            throw new Error('Monorail did not return transaction data');
          }
          break;

        case '0x':
          const zeroXQuote = await adapters['0x'].getQuote({
            tokenIn, tokenOut, amount,
            slippage: parseFloat(slippage),
            userAddress
          });
          if (zeroXQuote.calldata && zeroXQuote.to) {
            swapData = {
              success: true,
              to: zeroXQuote.to,
              data: zeroXQuote.calldata,
              value: zeroXQuote.value || '0',
              estimatedGas: zeroXQuote.estimatedGas || '300000',
              allowanceTarget: zeroXQuote.allowanceTarget
            };
          } else {
            throw new Error('0x did not return transaction data');
          }
          break;

        case 'OKX':
          swapData = await adapters['OKX'].getSwapData({
            tokenIn, tokenOut, amount,
            slippage: parseFloat(slippage),
            userAddress
          });
          break;

        case 'OpenOcean':
          const openOceanQuote = await adapters['OpenOcean'].getQuote({
            tokenIn, tokenOut, amount,
            slippage: parseFloat(slippage),
            userAddress
          });
          if (openOceanQuote.calldata && openOceanQuote.to) {
            swapData = {
              success: true,
              to: openOceanQuote.to,
              data: openOceanQuote.calldata,
              value: openOceanQuote.value || '0',
              estimatedGas: openOceanQuote.estimatedGas || '300000'
            };
          } else {
            throw new Error('OpenOcean did not return transaction data');
          }
          break;

        case 'KyberSwap':
          const kyberQuote = await adapters['KyberSwap'].getQuote({
            tokenIn, tokenOut, amount,
            slippage: parseFloat(slippage),
            userAddress
          });
          if (kyberQuote.calldata && kyberQuote.to) {
            swapData = {
              success: true,
              to: kyberQuote.to,
              data: kyberQuote.calldata,
              value: kyberQuote.value || '0',
              estimatedGas: kyberQuote.estimatedGas || '300000'
            };
          } else {
            throw new Error('KyberSwap did not return transaction data');
          }
          break;

        default:
          console.log(`[Swap] Unknown aggregator "${aggregator}", falling back to Mace`);
          swapData = await adapters['Mace'].getSwapData({
            tokenIn, tokenOut, amount,
            slippage: parseFloat(slippage),
            userAddress, recipient: recipient || userAddress
          });
      }
    } catch (adapterError) {
      console.error(`[Swap] ${aggregator} failed:`, adapterError.message);
      // Fall back to Mace if the selected aggregator fails
      console.log(`[Swap] Falling back to Mace`);
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
      { name: 'Mace', status: 'active' },
      { name: 'Monorail', status: 'active' },
      { name: '0x', status: 'active' },
      { name: 'OKX', status: 'active' },
      { name: 'OpenOcean', status: 'active' },
      { name: 'KyberSwap', status: 'active' }
    ]
  });
});

export default router;
