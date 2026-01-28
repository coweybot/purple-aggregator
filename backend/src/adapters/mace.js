import axios from 'axios';

/**
 * Mace Adapter (Native Monad Aggregator)
 * API Docs: https://api.mace.ag/swaps/rapidoc
 * OpenAPI: https://api.mace.ag/swaps/openapi.json
 * 
 * Mace uses "Thallastra" - Multi-DEX EVM trade solver with simulated transactions
 */
export default class MaceAdapter {
  constructor() {
    this.name = 'Mace';
    this.baseUrl = 'https://api.mace.ag/swaps';
  }

  async getQuote({ tokenIn, tokenOut, amount, slippage = 0.5, userAddress }) {
    try {
      // Get router address first
      const routerRes = await axios.get(`${this.baseUrl}/router-address`, {
        timeout: 5000
      });
      const routerAddress = routerRes.data;

      // Get best routes - Mace uses array format for in/out
      const response = await axios.post(
        `${this.baseUrl}/get-best-routes`,
        {
          in: [{ token: tokenIn, amount: amount }],
          out: [{ token: tokenOut }]
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      const data = response.data;
      
      if (!data.routes || data.routes.length === 0) {
        throw new Error('No routes found');
      }

      // Get the best route (first one)
      const bestRoute = data.routes[0];

      return {
        toAmount: bestRoute.expectedOutput || bestRoute.amountOut,
        toAmountMin: this.calculateMinOutput(bestRoute.expectedOutput, slippage),
        route: bestRoute.path || bestRoute.adapterHops,
        estimatedGas: bestRoute.estimatedGas,
        calldata: bestRoute.calldata,
        to: routerAddress,
        value: tokenIn === '0x0000000000000000000000000000000000000000' ? amount : '0',
        warnings: data.warnings || []
      };
    } catch (error) {
      if (error.response?.status === 500) {
        const errData = error.response.data;
        throw new Error(errData?.errorMessage || 'Mace routing failed');
      }
      throw error;
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
