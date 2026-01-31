import axios from 'axios';
import crypto from 'crypto';

/**
 * OKX DEX Aggregator Adapter
 * Docs: https://www.okx.com/docs-v5/en/#order-book-trading-dex-api
 * 
 * OKX DEX supports multiple chains including Monad
 */
export default class OKXAdapter {
  constructor() {
    this.name = 'OKX';
    this.baseUrl = 'https://www.okx.com/api/v5/dex/aggregator';
    this.chainId = '143'; // Monad mainnet
    
    // OKX API credentials (optional for quotes, required for execution)
    this.apiKey = process.env.OKX_API_KEY || '';
    this.secretKey = process.env.OKX_SECRET_KEY || '';
    this.passphrase = process.env.OKX_PASSPHRASE || '';
  }

  // Generate OKX signature for authenticated requests
  generateSignature(timestamp, method, requestPath, body = '') {
    const message = timestamp + method + requestPath + body;
    return crypto.createHmac('sha256', this.secretKey)
      .update(message)
      .digest('base64');
  }

  getHeaders(method = 'GET', requestPath = '', body = '') {
    const timestamp = new Date().toISOString();
    const headers = {
      'Content-Type': 'application/json'
    };

    // Add auth headers if credentials are available
    if (this.apiKey && this.secretKey && this.passphrase) {
      headers['OK-ACCESS-KEY'] = this.apiKey;
      headers['OK-ACCESS-SIGN'] = this.generateSignature(timestamp, method, requestPath, body);
      headers['OK-ACCESS-TIMESTAMP'] = timestamp;
      headers['OK-ACCESS-PASSPHRASE'] = this.passphrase;
    }

    return headers;
  }

  async getQuote({ tokenIn, tokenOut, amount, slippage = 0.5, userAddress }) {
    try {
      // OKX uses 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE for native token
      const NATIVE_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
      const fromToken = tokenIn.toLowerCase() === '0x0000000000000000000000000000000000000000' 
        ? NATIVE_ADDRESS 
        : tokenIn;
      const toToken = tokenOut.toLowerCase() === '0x0000000000000000000000000000000000000000'
        ? NATIVE_ADDRESS
        : tokenOut;

      const requestPath = '/quote';
      const params = new URLSearchParams({
        chainId: this.chainId,
        fromTokenAddress: fromToken,
        toTokenAddress: toToken,
        amount: amount,
        slippage: (slippage / 100).toString() // OKX uses decimal (0.005 for 0.5%)
      });

      if (userAddress) {
        params.append('userWalletAddress', userAddress);
      }

      const url = `${this.baseUrl}${requestPath}?${params.toString()}`;
      console.log(`[OKX] Requesting quote:`, url);

      const response = await axios.get(url, {
        headers: this.getHeaders('GET', `${requestPath}?${params.toString()}`),
        timeout: 10000
      });

      const data = response.data;
      console.log(`[OKX] Response:`, JSON.stringify(data).slice(0, 500));

      if (data.code !== '0' || !data.data || data.data.length === 0) {
        throw new Error(data.msg || 'No quote available from OKX');
      }

      const quote = data.data[0];

      // Parse route info
      const routes = quote.routerResult?.routes || [];
      const steps = routes.map(route => ({
        exchange: route.dexName || 'OKX',
        portion: route.percentage || '100%'
      }));

      return {
        toAmount: quote.toTokenAmount,
        toAmountMin: quote.minReceiveAmount || this.calculateMinOutput(quote.toTokenAmount, slippage),
        priceImpact: quote.priceImpact || '0',
        route: {
          type: steps.length > 1 ? 'split' : 'direct',
          source: 'OKX DEX',
          steps: steps.length > 0 ? steps : [{ exchange: 'OKX DEX', portion: '100%' }]
        },
        estimatedGas: quote.estimateGasFee || '300000',
        // For swap execution
        tx: quote.tx || null
      };
    } catch (error) {
      if (error.response) {
        console.error(`[OKX] API error ${error.response.status}:`, error.response.data);
        // Check if Monad is not supported
        if (error.response.data?.msg?.includes('not support')) {
          throw new Error('OKX does not support Monad chain yet');
        }
      } else {
        console.error(`[OKX] Error:`, error.message);
      }
      throw error;
    }
  }

  async getSwapData({ tokenIn, tokenOut, amount, slippage = 0.5, userAddress }) {
    try {
      const NATIVE_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
      const fromToken = tokenIn.toLowerCase() === '0x0000000000000000000000000000000000000000' 
        ? NATIVE_ADDRESS 
        : tokenIn;
      const toToken = tokenOut.toLowerCase() === '0x0000000000000000000000000000000000000000'
        ? NATIVE_ADDRESS
        : tokenOut;

      const requestPath = '/swap';
      const params = new URLSearchParams({
        chainId: this.chainId,
        fromTokenAddress: fromToken,
        toTokenAddress: toToken,
        amount: amount,
        slippage: (slippage / 100).toString(),
        userWalletAddress: userAddress
      });

      const url = `${this.baseUrl}${requestPath}?${params.toString()}`;
      
      const response = await axios.get(url, {
        headers: this.getHeaders('GET', `${requestPath}?${params.toString()}`),
        timeout: 10000
      });

      const data = response.data;

      if (data.code !== '0' || !data.data || data.data.length === 0) {
        throw new Error(data.msg || 'Failed to build swap from OKX');
      }

      const swapData = data.data[0];

      return {
        success: true,
        to: swapData.tx?.to,
        data: swapData.tx?.data,
        value: swapData.tx?.value || '0',
        estimatedGas: swapData.tx?.gas || '300000'
      };
    } catch (error) {
      console.error(`[OKX] Swap error:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  calculateMinOutput(amount, slippagePercent) {
    if (!amount) return '0';
    const amountBig = BigInt(amount);
    const slippageBps = BigInt(Math.round(slippagePercent * 100));
    const minOutput = amountBig - (amountBig * slippageBps / 10000n);
    return minOutput.toString();
  }
}
