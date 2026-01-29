import axios from 'axios';

/**
 * Monorail Adapter (Native Monad Aggregator)
 * Docs: https://gist.github.com/donovansolms/d6d8a869f7a5095bdd0592c390f47d13
 * 
 * Mainnet: https://pathfinder.monorail.xyz
 * Testnet: https://testnet-pathfinder.monorail.xyz
 */
export default class MonorailAdapter {
  constructor() {
    this.name = 'Monorail';
    this.baseUrl = 'https://pathfinder.monorail.xyz';
    this.WMON = '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A';
    this.NATIVE_ADDRESS = '0x0000000000000000000000000000000000000000';
  }

  async getQuote({ tokenIn, tokenOut, amount, slippage = 0.5, userAddress, decimals = 18 }) {
    try {
      // Monorail uses 0x0...0 for native MON
      const fromToken = tokenIn.toLowerCase() === this.WMON.toLowerCase() 
        ? this.NATIVE_ADDRESS 
        : tokenIn;
      const toToken = tokenOut.toLowerCase() === this.WMON.toLowerCase()
        ? this.NATIVE_ADDRESS
        : tokenOut;
      
      // Monorail uses human-readable amounts (not wei!)
      const humanAmount = Number(amount) / (10 ** decimals);
      
      // Slippage in basis points (50 = 0.5%)
      const slippageBps = Math.round(slippage * 100);
      
      const url = `${this.baseUrl}/v3/quote`;
      const params = {
        amount: humanAmount,
        from: fromToken,
        to: toToken,
        slippage: slippageBps,
        deadline: 60,
        max_hops: 3,
        source: 'purple-aggregator'
      };
      
      if (userAddress) {
        params.sender = userAddress;
      }

      console.log(`[Monorail] Requesting quote:`, params);
      
      const response = await axios.get(url, {
        params,
        headers: { 'Accept': 'application/json' },
        timeout: 8000
      });

      const data = response.data;
      console.log(`[Monorail] Response:`, JSON.stringify(data).slice(0, 300));
      
      if (!data.output) {
        throw new Error('No output in Monorail response');
      }
      
      // Parse route steps
      const steps = data.route?.map(step => ({
        exchange: step.protocol || step.exchange || 'Monorail',
        brand: step.pool || step.protocol || 'Direct'
      })) || [{ exchange: 'Monorail', brand: 'Direct' }];

      return {
        toAmount: data.output,
        toAmountFormatted: data.output_formatted,
        toAmountMin: data.min_output,
        priceImpact: data.compound_impact || '0',
        route: { steps },
        estimatedGas: data.gas || '0',
        transaction: data.transaction || null,
        raw: data
      };
      
    } catch (error) {
      if (error.response) {
        console.error(`[Monorail] API error ${error.response.status}:`, error.response.data);
      } else {
        console.error(`[Monorail] Error:`, error.message);
      }
      throw error;
    }
  }
}
