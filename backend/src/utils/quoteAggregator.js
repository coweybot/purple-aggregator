import OpenOceanAdapter from '../adapters/openocean.js';
import KyberSwapAdapter from '../adapters/kyberswap.js';
import ZeroXAdapter from '../adapters/zerox.js';
import MaceAdapter from '../adapters/mace.js';
// import MonorailAdapter from '../adapters/monorail.js';
// import KuruAdapter from '../adapters/kuru.js';

// Active adapters
const adapters = [
  new OpenOceanAdapter(),
  new KyberSwapAdapter(),
  new ZeroXAdapter(),
  new MaceAdapter(),        // Native Monad aggregator
  // new MonorailAdapter(),  // Enable when API available
  // new KuruAdapter(),      // Enable when API available
];

/**
 * Get quotes from all active aggregators in parallel
 */
export async function getAllQuotes(params) {
  const { tokenIn, tokenOut, amount, slippage, userAddress } = params;
  
  const quotePromises = adapters.map(async (adapter) => {
    try {
      const startTime = Date.now();
      const quote = await adapter.getQuote({
        tokenIn,
        tokenOut,
        amount,
        slippage,
        userAddress
      });
      const responseTime = Date.now() - startTime;
      
      return {
        aggregator: adapter.name,
        success: true,
        quote,
        responseTime
      };
    } catch (error) {
      return {
        aggregator: adapter.name,
        success: false,
        error: error.message,
        responseTime: 0
      };
    }
  });

  const results = await Promise.allSettled(quotePromises);
  return results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: 'Promise rejected' });
}

/**
 * Find the best quote (highest output amount)
 */
export function getBestQuote(quotes) {
  const successfulQuotes = quotes.filter(q => q.success && q.quote?.toAmount);
  
  if (successfulQuotes.length === 0) {
    return null;
  }

  // Sort by output amount (descending)
  successfulQuotes.sort((a, b) => {
    const amountA = BigInt(a.quote.toAmount);
    const amountB = BigInt(b.quote.toAmount);
    return amountB > amountA ? 1 : amountB < amountA ? -1 : 0;
  });

  const best = successfulQuotes[0];
  
  // Calculate savings vs worst quote
  const worst = successfulQuotes[successfulQuotes.length - 1];
  const savingsPercent = successfulQuotes.length > 1 
    ? ((BigInt(best.quote.toAmount) - BigInt(worst.quote.toAmount)) * 10000n / BigInt(worst.quote.toAmount)) / 100n
    : 0n;

  return {
    ...best,
    isBest: true,
    savingsPercent: Number(savingsPercent),
    comparedAgainst: successfulQuotes.length
  };
}
