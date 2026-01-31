import axios from 'axios';

/**
 * 0x Protocol Adapter
 * Docs: https://0x.org/docs
 */
export default class ZeroXAdapter {
  constructor() {
    this.name = '0x';
    this.baseUrl = 'https://api.0x.org';
    this.chainId = 143; // Monad mainnet
    this.apiKey = process.env.ZEROX_API_KEY || '';
    // 0x uses this address for native tokens
    this.NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    this.WMON = '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A';
  }

  async getQuote({ tokenIn, tokenOut, amount, slippage = 0.5, userAddress }) {
    try {
      // Use a default taker address for price quotes (0x needs one)
      const taker = userAddress || '0x70a9f34f9b34c64957b9c401a97bfed35b95049e';
      
      // Convert WMON to native token address for 0x (if user is swapping native MON)
      const sellToken = tokenIn.toLowerCase() === this.WMON.toLowerCase() ? this.NATIVE_TOKEN : tokenIn;
      const buyToken = tokenOut.toLowerCase() === this.WMON.toLowerCase() ? this.NATIVE_TOKEN : tokenOut;
      
      const response = await axios.get(`${this.baseUrl}/swap/permit2/quote`, {
        params: {
          chainId: this.chainId,
          sellToken: sellToken,
          buyToken: buyToken,
          sellAmount: amount,
          taker: taker,
          slippageBps: Math.round(slippage * 100) // Convert 0.5% to 50 bps
        },
        headers: {
          '0x-api-key': this.apiKey,
          '0x-version': 'v2'
        },
        timeout: 10000
      });

      const data = response.data;
      
      if (!data.buyAmount) {
        throw new Error('No quote available from 0x');
      }

      // Parse route from fills
      const route = data.route?.fills?.map(fill => ({
        dex: fill.source,
        from: fill.from,
        to: fill.to,
        proportion: fill.proportionBps / 100 + '%'
      })) || [];

      return {
        toAmount: data.buyAmount,
        toAmountMin: data.minBuyAmount,
        route: route,
        estimatedGas: data.transaction?.gas,
        calldata: data.transaction?.data,
        to: data.transaction?.to,
        value: data.transaction?.value || '0',
        // Extra 0x-specific data
        allowanceTarget: data.allowanceTarget,
        permit2: data.permit2,
        zid: data.zid
      };
    } catch (error) {
      if (error.response?.data?.name === 'INPUT_INVALID') {
        throw new Error('Invalid token pair or amount');
      }
      if (error.response?.status === 400) {
        throw new Error(error.response.data?.message || 'Invalid request');
      }
      throw error;
    }
  }
}
