import axios from 'axios';

/**
 * Kuru Adapter (Native Monad CLOB + Aggregator)
 * Docs: https://docs.kuru.io
 * Status: API endpoint TBD - "Kuru Flow" is their aggregator
 * Note: Hybrid CLOB-AMM model, raised $11.6M from Paradigm
 */
export default class KuruAdapter {
  constructor() {
    this.name = 'Kuru';
    // TODO: Update with actual API endpoint when available
    this.baseUrl = 'https://api.kuru.io';
  }

  async getQuote({ tokenIn, tokenOut, amount, slippage = 0.5, userAddress }) {
    // TODO: Implement when API is available
    // Kuru Flow is their smart aggregator product
    
    try {
      const response = await axios.get(`${this.baseUrl}/v1/flow/quote`, {
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
      throw new Error('Kuru API not yet available');
    }
  }
}
