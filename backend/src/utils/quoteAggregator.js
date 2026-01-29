import OpenOceanAdapter from '../adapters/openocean.js';
import KyberSwapAdapter from '../adapters/kyberswap.js';
import ZeroXAdapter from '../adapters/zerox.js';
import MaceAdapter from '../adapters/mace.js';
import MonorailAdapter from '../adapters/monorail.js';
import KuruAdapter from '../adapters/kuru.js';

// Active adapters
const adapters = [
  new OpenOceanAdapter(),
  new KyberSwapAdapter(),
  new ZeroXAdapter(),
  new MaceAdapter(),        // Native Monad aggregator (temp down, will restart)
  new MonorailAdapter(),      // Native Monad aggregator (v4 API)
  new KuruAdapter(),        // Native Monad CLOB + aggregator
];

/**
 * Timeout wrapper for faster failures
 */
function withTimeout(promise, ms, name) {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`${name} timeout after ${ms}ms`)), ms)
    )
  ]);
}

// Simple in-memory cache (5 second TTL)
const quoteCache = new Map();
const CACHE_TTL = 5000;

function getCacheKey(params) {
  return `${params.tokenIn}-${params.tokenOut}-${params.amount}`;
}

/**
 * Get quotes from all active aggregators in parallel
 */
export async function getAllQuotes(params) {
  const { tokenIn, tokenOut, amount, slippage, userAddress } = params;
  
  // Check cache first
  const cacheKey = getCacheKey(params);
  const cached = quoteCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.quotes;
  }
  
  // Timeout per adapter (8 seconds to allow slower APIs like Mace)
  const ADAPTER_TIMEOUT = 8000;
  
  const quotePromises = adapters.map(async (adapter) => {
    const startTime = Date.now();
    try {
      const quote = await withTimeout(
        adapter.getQuote({
          tokenIn,
          tokenOut,
          amount,
          slippage,
          userAddress
        }),
        ADAPTER_TIMEOUT,
        adapter.name
      );
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
        responseTime: Date.now() - startTime
      };
    }
  });

  const results = await Promise.allSettled(quotePromises);
  const quotes = results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: 'Promise rejected' });
  
  // Cache results
  quoteCache.set(cacheKey, { quotes, timestamp: Date.now() });
  
  // Clean old cache entries (max 100)
  if (quoteCache.size > 100) {
    const oldest = [...quoteCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    quoteCache.delete(oldest[0]);
  }
  
  return quotes;
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
  
  // Calculate savings vs worst quote (with division by zero protection)
  const worst = successfulQuotes[successfulQuotes.length - 1];
  const worstAmount = BigInt(worst?.quote?.toAmount || '1');
  const bestAmount = BigInt(best?.quote?.toAmount || '0');
  const savingsPercent = successfulQuotes.length > 1 && worstAmount > 0n
    ? ((bestAmount - worstAmount) * 10000n / worstAmount) / 100n
    : 0n;

  return {
    ...best,
    isBest: true,
    savingsPercent: Number(savingsPercent),
    comparedAgainst: successfulQuotes.length
  };
}
