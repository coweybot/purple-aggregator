import axios from 'axios';

/**
 * Monorail Adapter (Native Monad Aggregator)
 * Docs: https://docs.monorail.xyz
 * Status: API endpoint TBD - awaiting mainnet
 */
export default class MonorailAdapter {
  constructor() {
    this.name = 'Monorail';
    // TODO: Update with actual API endpoint when available
    this.baseUrl = 'https://api.monorail.xyz';
  }

  async getQuote({ tokenIn, tokenOut, amount, slippage = 0.5, userAddress }) {
    // TODO: Implement when API is available
    // Monorail unifies AMMs and orderbooks into "Synthetic Orderbooks"
    
    try {
      const response = await axios.get(`${this.baseUrl}/v1/quote`, {
        params: {
          tokenIn,
          tokenOut,
          amount,
          slippage,
          userAddress
        },
        timeout: 10000
      });

      const data = response.data;

      return {
        toAmount: data.amountOut,
        toAmountMin: data.minAmountOut,
        route: data.route,
        estimatedGas: data.gasEstimate,
        calldata: data.calldata,
        to: data.routerAddress,
        value: '0'
      };
    } catch (error) {
      throw new Error('Monorail API not yet available');
    }
  }
}
