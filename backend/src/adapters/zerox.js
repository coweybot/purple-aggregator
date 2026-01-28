import axios from 'axios';

/**
 * 0x Protocol Adapter
 * Docs: https://0x.org/docs/api
 * Note: Requires API key for production use
 */
export default class ZeroXAdapter {
  constructor() {
    this.name = '0x';
    // 0x uses unified API with chainId parameter
    this.baseUrl = 'https://api.0x.org';
    this.chainId = 143; // Monad mainnet
    this.apiKey = process.env.ZEROX_API_KEY || '';
  }

  async getQuote({ tokenIn, tokenOut, amount, slippage = 0.5, userAddress }) {
    if (!this.apiKey) {
      throw new Error('0x API key required - set ZEROX_API_KEY');
    }

    try {
      const headers = {
        '0x-api-key': this.apiKey
      };

      // 0x v2 Permit2 endpoint
      const response = await axios.get(`${this.baseUrl}/swap/permit2/quote`, {
        params: {
          chainId: this.chainId,
          sellToken: tokenIn,
          buyToken: tokenOut,
          sellAmount: amount,
          slippagePercentage: slippage / 100,
          taker: userAddress
        },
        headers,
        timeout: 10000
      });

      const data = response.data;

      return {
        toAmount: data.buyAmount,
        toAmountMin: data.minBuyAmount,
        route: data.route?.fills || [],
        estimatedGas: data.estimatedGas,
        calldata: data.data,
        to: data.to,
        value: data.value || '0',
        allowanceTarget: data.allowanceTarget
      };
    } catch (error) {
      if (error.response?.status === 400) {
        throw new Error('Invalid token pair or amount');
      }
      if (error.response?.status === 429) {
        throw new Error('Rate limited - API key required');
      }
      throw error;
    }
  }
}
