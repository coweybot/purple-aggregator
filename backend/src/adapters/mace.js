import axios from 'axios';
import { getAddress } from 'ethers';

/**
 * Mace Adapter (Native Monad Aggregator)
 * API Docs: https://api.mace.ag/swaps/rapidoc
 * 
 * Uses get-best-routes for detailed routing info
 * Supports includeTransactionInfo for executable calldata
 * NOTE: Mace requires EIP-55 checksummed addresses!
 */
export default class MaceAdapter {
  constructor() {
    this.name = 'Mace';
    this.baseUrl = 'https://api.mace.ag/swaps';
    this.exchangeCache = null;
    this.cacheTime = 0;
    this.routerAddress = null;
  }

  // Convert to checksummed address (Mace requires this)
  toChecksumAddress(address) {
    if (!address || address === 'native') return address;
    try {
      return getAddress(address);
    } catch {
      return address;
    }
  }

  async getRouterAddress() {
    if (this.routerAddress) return this.routerAddress;
    try {
      const resp = await axios.get(`${this.baseUrl}/router-address`, { timeout: 5000 });
      this.routerAddress = resp.data;
      return this.routerAddress;
    } catch {
      return null;
    }
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
      const inToken = tokenIn.toLowerCase() === WMON.toLowerCase() ? 'native' : this.toChecksumAddress(tokenIn);
      const outToken = this.toChecksumAddress(tokenOut);
      
      // Use get-best-routes with actual tokenIn for detailed routing
      const response = await axios.post(
        `${this.baseUrl}/get-best-routes`,
        {
          in: [{ token: inToken, amount: amount }],
          out: [{ token: outToken, slippageToleranceBps: Math.round(slippage * 100) }]
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

  /**
   * Get executable swap data (calldata, to, value)
   * This is used to execute swaps directly on our frontend
   */
  async getSwapData({ tokenIn, tokenOut, amount, slippage = 0.5, userAddress, recipient }) {
    try {
      const WMON = '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A';
      const inToken = tokenIn.toLowerCase() === WMON.toLowerCase() ? 'native' : this.toChecksumAddress(tokenIn);
      const outToken = this.toChecksumAddress(tokenOut);
      const isNativeIn = inToken === 'native';
      
      // Call get-best-routes with includeTransactionInfo: true
      const response = await axios.post(
        `${this.baseUrl}/get-best-routes`,
        {
          in: [{ token: inToken, amount: amount }],
          out: [{ token: outToken, slippageToleranceBps: Math.round(slippage * 100) }],
          from: userAddress,
          solver: {
            includeTransactionInfo: true,
            includeAccessList: true
          }
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      );

      const data = response.data;
      
      if (!data.routes || data.routes.length === 0) {
        throw new Error('No routes found');
      }

      const bestRoute = data.routes[0];
      const outputAmount = bestRoute.expectedOut?.[0]?.amount;
      const transaction = bestRoute.transaction;
      
      if (!transaction) {
        throw new Error('No transaction data returned - try with a valid userAddress');
      }

      return {
        success: true,
        aggregator: 'Mace',
        // Transaction data for wallet
        to: transaction.to,
        data: transaction.data,
        value: isNativeIn ? amount : '0', // Native token value if swapping MON
        // Quote info
        toAmount: BigInt(outputAmount).toString(),
        toAmountMin: this.calculateMinOutput(BigInt(outputAmount).toString(), slippage),
        estimatedGas: bestRoute.gasConsumed?.toString() || '200000',
        // Optional: access list for gas optimization
        accessList: bestRoute.accessList || []
      };
    } catch (error) {
      // Handle common errors with user-friendly messages
      let errorMsg = error.message;
      if (error.response?.status === 422) {
        errorMsg = 'No liquidity available for this token pair. Try a different token or amount.';
      } else if (error.message.includes('No routes')) {
        errorMsg = 'No swap route found. This token may not have liquidity on supported DEXes.';
      }
      
      return {
        success: false,
        aggregator: 'Mace',
        error: errorMsg
      };
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
