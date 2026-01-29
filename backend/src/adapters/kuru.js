import axios from 'axios';

/**
 * Kuru Adapter (Native Monad CLOB + Aggregator)
 * Docs: https://docs.kuru.io/kuru-flow/flow-overview
 * API: JWT-based authentication, then quote endpoint
 */
export default class KuruAdapter {
  constructor() {
    this.name = 'Kuru';
    this.baseUrl = 'https://api.kuru.io';
    this.jwtToken = null;
    this.tokenExpiry = 0;
    // Default user address for anonymous quotes (can be overridden)
    this.defaultUserAddress = '0x0000000000000000000000000000000000000001';
  }

  async getJwtToken(userAddress) {
    // Reuse token if not expired (with 60s buffer)
    if (this.jwtToken && Date.now() < (this.tokenExpiry - 60000)) {
      return this.jwtToken;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/generate-token`,
        { user_address: userAddress || this.defaultUserAddress },
        { 
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000 
        }
      );

      this.jwtToken = response.data.token;
      this.tokenExpiry = response.data.expires_at * 1000; // Convert to ms
      return this.jwtToken;
    } catch (error) {
      console.error('[Kuru] JWT token generation failed:', error.message);
      throw new Error('Failed to get Kuru JWT token');
    }
  }

  async getQuote({ tokenIn, tokenOut, amount, slippage = 0.5, userAddress }) {
    try {
      // Get JWT token first
      const token = await this.getJwtToken(userAddress);
      
      // Calculate quote
      const response = await axios.post(
        `${this.baseUrl}/api/calculate`,
        {
          autoSlippage: slippage ? false : true,
          userAddress: userAddress || this.defaultUserAddress,
          tokenIn,
          tokenOut,
          amount: amount.toString(),
          slippageTolerance: Math.round(slippage * 100) // basis points
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          timeout: 8000
        }
      );

      const data = response.data;
      
      if (data.status !== 'success') {
        throw new Error(data.message || 'Quote calculation failed');
      }

      // Parse route steps if available
      const steps = [];
      if (data.path && data.path.routes) {
        for (const route of data.path.routes) {
          steps.push({
            exchange: route.protocol || 'Kuru',
            pool: route.pool || 'Direct'
          });
        }
      }

      return {
        toAmount: data.output,
        toAmountMin: this.calculateMinOutput(data.output, slippage),
        route: {
          type: steps.length > 1 ? 'multi-hop' : 'direct',
          source: 'Kuru Flow',
          steps: steps.length > 0 ? steps : [{ exchange: 'Kuru Flow', pool: 'Aggregated' }]
        },
        estimatedGas: data.gasPrices?.estimatedGas || '200000',
        priceImpact: data.path?.priceImpact || '0',
        buildResponse: data.buildResponse,
        calldata: data.buildResponse?.calldata,
        to: data.buildResponse?.to,
        value: data.buildResponse?.value || '0'
      };
    } catch (error) {
      if (error.response) {
        console.error(`[Kuru] API error ${error.response.status}:`, error.response.data);
      } else {
        console.error(`[Kuru] Error:`, error.message);
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
