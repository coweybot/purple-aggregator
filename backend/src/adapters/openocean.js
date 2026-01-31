import axios from 'axios';

/**
 * OpenOcean Adapter
 * Docs: https://apis.openocean.finance
 */
export default class OpenOceanAdapter {
  constructor() {
    this.name = 'OpenOcean';
    this.baseUrl = 'https://open-api.openocean.finance/v3';
    // Monad mainnet chain ID
    this.chain = '143';
    // OpenOcean uses this for native token
    this.NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    this.WMON = '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A';
  }

  async getQuote({ tokenIn, tokenOut, amount, slippage = 0.5, userAddress, decimals = 18 }) {
    try {
      // Convert WMON to native token address
      const inToken = tokenIn.toLowerCase() === this.WMON.toLowerCase() ? this.NATIVE_TOKEN : tokenIn;
      const outToken = tokenOut.toLowerCase() === this.WMON.toLowerCase() ? this.NATIVE_TOKEN : tokenOut;
      
      // OpenOcean uses human-readable amounts, not wei
      // Convert from wei to human-readable
      const humanAmount = (BigInt(amount) / BigInt(10 ** decimals)).toString();
      
      const response = await axios.get(`${this.baseUrl}/${this.chain}/quote`, {
        params: {
          inTokenAddress: inToken,
          outTokenAddress: outToken,
          amount: humanAmount,
          gasPrice: '5', // Gwei - adjust for Monad
          slippage: slippage,
          account: userAddress || '0x0000000000000000000000000000000000000000'
        },
        timeout: 10000
      });

      const data = response.data;
      
      if (data.code !== 200) {
        throw new Error(data.message || 'OpenOcean API error');
      }

      return {
        toAmount: data.data.outAmount,
        toAmountMin: data.data.minOutAmount,
        route: data.data.path,
        estimatedGas: data.data.estimatedGas,
        calldata: data.data.data,
        to: data.data.to,
        value: data.data.value || '0'
      };
    } catch (error) {
      if (error.response?.status === 400) {
        throw new Error('Invalid token pair or amount');
      }
      throw error;
    }
  }
}
