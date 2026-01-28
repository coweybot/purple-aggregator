import axios from 'axios';

/**
 * KyberSwap Adapter
 * Docs: https://docs.kyberswap.com/kyberswap-solutions/kyberswap-aggregator
 */
export default class KyberSwapAdapter {
  constructor() {
    this.name = 'KyberSwap';
    this.baseUrl = 'https://aggregator-api.kyberswap.com';
    // Monad mainnet (uses 'monad' string, not chain ID)
    this.chain = 'monad';
  }

  async getQuote({ tokenIn, tokenOut, amount, slippage = 0.5, userAddress }) {
    try {
      // Step 1: Get route
      const routeResponse = await axios.get(
        `${this.baseUrl}/${this.chain}/api/v1/routes`,
        {
          params: {
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amount,
          },
          timeout: 10000
        }
      );

      const routeData = routeResponse.data;
      
      if (!routeData.data?.routeSummary) {
        throw new Error('No route found');
      }

      const routeSummary = routeData.data.routeSummary;
      const routerAddress = routeData.data.routerAddress;

      // Step 2: Build transaction (only if userAddress provided)
      let calldata = null;
      if (userAddress) {
        const buildResponse = await axios.post(
          `${this.baseUrl}/${this.chain}/api/v1/route/build`,
          {
            routeSummary: routeSummary,
            sender: userAddress,
            recipient: userAddress,
            slippageTolerance: Math.round(slippage * 100) // bips
          },
          { timeout: 10000 }
        );
        calldata = buildResponse.data.data?.data;
      }

      return {
        toAmount: routeSummary.amountOut,
        toAmountMin: routeSummary.amountOutUsd, // Note: This is USD value, need to calc min
        route: routeSummary.route,
        estimatedGas: routeSummary.gasUsd,
        calldata: calldata,
        to: routerAddress,
        value: '0'
      };
    } catch (error) {
      if (error.response?.status === 400) {
        throw new Error('Invalid token pair or amount');
      }
      throw error;
    }
  }
}
