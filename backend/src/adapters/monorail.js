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

  // Token decimals map (Monad mainnet)
  static TOKEN_DECIMALS = {
    '0x3bd359c1119da7da1d913d1c4d2b7c461115433a': 18, // WMON
    '0x754704bc059f8c67012fed69bc8a327a5aafb603': 6,  // USDC
    '0x00000000efe302beaa2b3e6e1b18d08d69a9012a': 18, // AUSD
    '0xe7cd86e13ac4309349f30b3435a9d337750fc82d': 6,  // USDT
    '0xee8c0e9f1bffb4eb878d8f15f368a02a35481242': 18, // WETH
    '0x0555e30da8f98308edb960aa94c0db47230d2b9c': 8,  // WBTC
    '0xea17e5a9efebf1477db45082d67010e2245217f1': 9,  // SOL
  };

  getDecimals(tokenAddress) {
    return MonorailAdapter.TOKEN_DECIMALS[tokenAddress.toLowerCase()] || 18;
  }

  async getQuote({ tokenIn, tokenOut, amount, slippage = 0.5, userAddress }) {
    try {
      // Monorail uses 0x0...0 for native MON
      const fromToken = tokenIn.toLowerCase() === this.WMON.toLowerCase() 
        ? this.NATIVE_ADDRESS 
        : tokenIn;
      const toToken = tokenOut.toLowerCase() === this.WMON.toLowerCase()
        ? this.NATIVE_ADDRESS
        : tokenOut;
      
      // Get correct decimals for the input token
      const decimals = this.getDecimals(tokenIn);
      
      // Monorail uses human-readable amounts (not wei!)
      const humanAmount = Number(amount) / (10 ** decimals);
      
      // Slippage in basis points (50 = 0.5%)
      const slippageBps = Math.round(slippage * 100);
      
      const url = `${this.baseUrl}/v4/quote`;
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
