import axios from 'axios';

/**
 * Mace Adapter (Native Monad Aggregator)
 * API Docs: https://api.mace.ag/swaps/rapidoc
 * 
 * Uses get-best-routes for detailed routing info
 */
export default class MaceAdapter {
  constructor() {
    this.name = 'Mace';
    this.baseUrl = 'https://api.mace.ag/swaps';
    this.exchangeCache = null;
    this.cacheTime = 0;
  }

  async getExchangeMap() {
    // Cache exchanges for 5 minutes
    if (this.exchangeCache && Date.now() - this.cacheTime < 300000) {
      return this.exchangeCache;
    }
    try {
      const resp = await axios.get(`${this.baseUrl}/supported-exchanges`, { timeout: 5000 });
      this.exchangeCache = new Map(resp.data.map(e => [e.exchange.toLowerCase(), e]));
      this.cacheTime = Date.now();
      return this.exchangeCache;
    } catch {
      return new Map();
    }
  }

  async getQuote({ tokenIn, tokenOut, amount, slippage = 0.5, userAddress }) {
    try {
      // WMON address - use 'native' for native MON swaps
      const WMON = '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A';
      const inToken = tokenIn.toLowerCase() === WMON.toLowerCase() ? 'native' : tokenIn;
      
      // Use get-best-routes with actual tokenIn for detailed routing
      const response = await axios.post(
        `${this.baseUrl}/get-best-routes`,
        {
          in: [{ token: inToken, amount: amount }],
          out: [{ token: tokenOut, slippageToleranceBps: Math.round(slippage * 100) }]
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 8000
        }
      );

      const data = response.data;
      
      if (!data.routes || data.routes.length === 0) {
        throw new Error('No routes found');
      }

      const bestRoute = data.routes[0];
      const outputAmount = bestRoute.expectedOut?.[0]?.amount;
      
      if (!outputAmount) {
        throw new Error('No output amount');
      }

      // Parse route details
      const exchangeMap = await this.getExchangeMap();
      const routeSteps = [];
      
      for (const route of bestRoute.routes || []) {
        for (const hop of route.adapterHops || []) {
          const exchangeAddr = hop.exchange?.toLowerCase();
          const exchangeInfo = exchangeMap.get(exchangeAddr);
          routeSteps.push({
            exchange: exchangeInfo?.name || `Pool ${hop.exchange?.slice(0,10)}...`,
            brand: exchangeInfo?.brand || 'unknown',
            adapter: route.adapter
          });
        }
      }

      return {
        toAmount: BigInt(outputAmount).toString(),
        toAmountMin: this.calculateMinOutput(BigInt(outputAmount).toString(), slippage),
        route: {
          type: 'multi-hop',
          source: 'Mace',
          steps: routeSteps,
          gasConsumed: bestRoute.gasConsumed
        },
        estimatedGas: bestRoute.gasConsumed?.toString() || '150000',
        priceImpact: '0',
        calldata: null,
        to: null,
        value: '0'
      };
    } catch (error) {
      // Fallback to exchange-rate endpoint
      return this.getFallbackQuote({ tokenIn, tokenOut, amount, slippage });
    }
  }

  async getFallbackQuote({ tokenIn, tokenOut, amount, slippage }) {
    const response = await axios.post(
      `${this.baseUrl}/exchange-rate`,
      { inToken: tokenIn, outToken: tokenOut, lastNSeconds: 60 },
      { headers: { 'Content-Type': 'application/json' }, timeout: 5000 }
    );

    const data = response.data;
    if (!data.average) throw new Error('No exchange rate found');

    const inputAmount = BigInt(amount);
    const avgRate = data.average;
    const estimatedOutput = this.calculateOutput(inputAmount, avgRate, 18, 6);

    return {
      toAmount: estimatedOutput.toString(),
      toAmountMin: this.calculateMinOutput(estimatedOutput.toString(), slippage),
      route: { type: 'direct', source: 'Mace' },
      estimatedGas: '150000',
      priceImpact: '0',
      calldata: null,
      to: null,
      value: '0'
    };
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
