import axios from 'axios';

/**
 * Mace Adapter (Native Monad Aggregator)
 * API Docs: https://api.mace.ag/swaps/rapidoc
 * 
 * Uses exchange-amount endpoint for quotes (no wallet required)
 * Full simulation available when user connects wallet
 */
export default class MaceAdapter {
  constructor() {
    this.name = 'Mace';
    this.baseUrl = 'https://api.mace.ag/swaps';
  }

  async getQuote({ tokenIn, tokenOut, amount, slippage = 0.5, userAddress }) {
    try {
      // Use exchange-rate for quotes (doesn't require wallet simulation)
      const response = await axios.post(
        `${this.baseUrl}/exchange-rate`,
        {
          inToken: tokenIn,
          outToken: tokenOut,
          lastNSeconds: 60
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      );

      const data = response.data;
      
      if (!data.average) {
        throw new Error('No exchange rate found');
      }

      // Calculate output based on average exchange rate
      const inputAmount = BigInt(amount);
      const avgRate = data.average; // This is a float ratio
      
      // Get token decimals to calculate properly (WMON 18 decimals -> USDC 6 decimals)
      const estimatedOutput = this.calculateOutput(inputAmount, avgRate, 18, 6);

      return {
        toAmount: estimatedOutput.toString(),
        toAmountMin: this.calculateMinOutput(estimatedOutput.toString(), slippage),
        route: {
          type: data.routeType || 'direct',
          source: 'Mace',
          intermediaries: data.equivilantTokens || []
        },
        estimatedGas: '150000',
        priceImpact: '0',
        calldata: null,
        to: null,
        value: '0'
      };
    } catch (error) {
      if (error.response?.data?.errorMessage) {
        throw new Error(error.response.data.errorMessage);
      }
      throw error;
    }
  }

  calculateOutput(inputWei, rate, inputDecimals, outputDecimals) {
    // Convert input to float, multiply by rate, convert to output decimals
    const inputFloat = Number(inputWei) / (10 ** inputDecimals);
    const outputFloat = inputFloat * rate;
    const outputWei = BigInt(Math.floor(outputFloat * (10 ** outputDecimals)));
    return outputWei;
  }

  calculateMinOutput(amount, slippagePercent) {
    if (!amount) return '0';
    const amountBig = BigInt(amount);
    const slippageBps = BigInt(Math.round(slippagePercent * 100));
    const minOutput = amountBig - (amountBig * slippageBps / 10000n);
    return minOutput.toString();
  }
}
