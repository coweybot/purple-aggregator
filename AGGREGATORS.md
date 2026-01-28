# Monad Aggregator API Research

## Overview
Building a meta-aggregator that queries all 10 Monad aggregators and returns the best quote.

## Aggregators on Monad

### 1. Monorail ✅
- **Website:** https://monorail.xyz
- **Docs:** https://docs.monorail.xyz
- **Type:** Native Monad aggregator (AMM + Orderbook unified)
- **API:** TBD - need to find API endpoint
- **Notes:** Combines AMMs and orderbooks into "Synthetic Orderbooks"

### 2. OpenOcean ✅
- **Website:** https://openocean.finance
- **Docs:** https://apis.openocean.finance
- **Type:** Multi-chain aggregator (40+ chains)
- **API Endpoint:** `https://open-api.openocean.finance/v3/{chain}/swap_quote`
- **Params:** tokenIn, tokenOut, amount, gasPrice, slippage
- **Rate Limit:** TBD
- **API Key:** Not required for basic queries

### 3. KyberSwap ✅
- **Website:** https://kyberswap.com
- **Docs:** https://docs.kyberswap.com
- **Type:** Multi-chain aggregator
- **API Endpoint:** 
  - GET: `https://aggregator-api.kyberswap.com/{chain}/api/v1/routes`
  - POST: `https://aggregator-api.kyberswap.com/{chain}/api/v1/route/build`
- **Params:** tokenIn, tokenOut, amountIn
- **Rate Limit:** TBD
- **API Key:** Not required

### 4. 0x Protocol ✅
- **Website:** https://0x.org
- **Docs:** https://0x.org/docs/api
- **Type:** Multi-chain aggregator
- **API Endpoint:** `https://api.0x.org/swap/v1/quote`
- **Params:** sellToken, buyToken, sellAmount, slippagePercentage
- **Rate Limit:** 10 req/min (free), higher with API key
- **API Key:** Required for production

### 5. Matcha (by 0x) ✅
- **Website:** https://matcha.xyz
- **Type:** 0x frontend - uses same API as 0x
- **API:** Same as 0x Protocol
- **Notes:** Consumer frontend for 0x

### 6. Kuru ✅
- **Website:** https://kuru.io
- **Docs:** https://docs.kuru.io
- **Type:** Native Monad CLOB DEX + Aggregator (Kuru Flow)
- **API:** TBD - need to find API endpoint
- **Notes:** Hybrid CLOB-AMM, raised $11.6M from Paradigm

### 7. Mace ✅
- **Website:** https://mace.ag
- **Docs:** https://api.mace.ag/swaps/rapidoc
- **OpenAPI:** https://api.mace.ag/swaps/openapi.json
- **Type:** Native Monad aggregator (Thallastra solver)
- **API Endpoint:** `POST https://api.mace.ag/swaps/get-best-routes`
- **Router:** `GET https://api.mace.ag/swaps/router-address`
- **Params:** sellToken, buyToken, sellAmount
- **Features:** Simulation-based routing, multi-DEX solving
- **Notes:** Built on "Thallastra" - uses Umbrasync's partial chain state snapshots

### 8. Azaar
- **Website:** TBD
- **Docs:** TBD
- **Type:** Monad aggregator
- **API:** TBD
- **Notes:** Need to research

### 9. LFJ (Trader Joe)
- **Website:** https://lfj.gg
- **Docs:** TBD
- **Type:** Multi-chain DEX/Aggregator
- **API:** TBD
- **Notes:** Originally Trader Joe from Avalanche

### 10. Eisen
- **Website:** TBD
- **Docs:** TBD
- **Type:** TBD
- **API:** TBD
- **Notes:** Need to research

---

## Confirmed API Patterns

### Standard Quote Request
```javascript
{
  tokenIn: "0x...",      // Sell token address
  tokenOut: "0x...",     // Buy token address
  amount: "1000000000",  // Amount in wei
  slippage: 0.5,         // Slippage %
  userAddress: "0x..."   // Optional: for calldata
}
```

### Standard Quote Response
```javascript
{
  toAmount: "999000000", // Expected output
  route: [...],         // Swap route
  gas: "150000",        // Estimated gas
  calldata: "0x...",    // Encoded tx data
  to: "0x...",          // Router contract
}
```

---

## Monad Chain Info (MAINNET LIVE!)
- **Chain ID:** 143
- **Currency:** MON
- **RPC URLs:**
  - `https://rpc.monad.xyz` (QuickNode, 25 rps)
  - `https://rpc1.monad.xyz` (Alchemy, 15 rps)
  - `https://rpc3.monad.xyz` (Ankr, 300/10s)
  - `https://rpc-mainnet.monadinfra.com` (MF, 20 rps)
- **Block Explorers:**
  - https://monadvision.com
  - https://monadscan.com
  - https://monad.socialscan.io

### Key Token Addresses
| Token | Address |
|-------|---------|
| WMON | 0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A |
| USDC | 0x754704Bc059F8C67012fEd69BC8A327a5aafb603 |
| USDT0 | 0xe7cd86e13AC4309349F30B3435a9d337750fC82D |
| WETH | 0xEE8c0E9f1BFFb4Eb878d8f15f368A02a35481242 |
| WBTC | 0x0555E30da8f98308EdB960aa94C0Db47230d2B9c |
| wstETH | 0x10Aeaf63194db8d453d4D85a06E5eFE1dd0b5417 |
| WSOL | 0xea17E5a9efEBf1477dB45082d67010E2245217f1 |

---

## Implementation Status

| Aggregator | Status | API Endpoint | Notes |
|------------|--------|--------------|-------|
| **OpenOcean** | ✅ Working | `https://open-api.openocean.finance/v3/143/quote` | Uses human-readable amounts (1 = 1 token) |
| **KyberSwap** | ✅ Working | `https://aggregator-api.kyberswap.com/monad/api/v1/routes` | Standard wei amounts |
| **Mace** | ✅ Working | `https://api.mace.ag/swaps/get-best-routes` | Uses array format for in/out tokens |
| **0x** | 🔑 Needs Key | `https://api.0x.org/swap/permit2/quote?chainId=143` | Requires `0x-api-key` header |
| **Monorail** | ⚠️ Private API | Developer Portal only | Need to apply at monorail.xyz/developers |
| **Kuru** | ⚠️ No Public API | N/A | Check for SDK/API release |
| **LFJ** | ⚠️ Cloudflare Protected | N/A | May need special access |
| **Azaar** | ❓ Unknown | N/A | Need more research |
| **Eisen** | ❓ Unknown | N/A | Need more research |

## API Request Formats

### OpenOcean
```bash
curl "https://open-api.openocean.finance/v3/143/quote?inTokenAddress=WMON&outTokenAddress=USDC&amount=1&gasPrice=5"
```
⚠️ Uses human-readable amounts (1 = 1 token, not wei)

### KyberSwap
```bash
curl "https://aggregator-api.kyberswap.com/monad/api/v1/routes?tokenIn=WMON&tokenOut=USDC&amountIn=1000000000000000000"
```

### Mace
```bash
curl -X POST "https://api.mace.ag/swaps/get-best-routes" \
  -H "Content-Type: application/json" \
  -d '{"in":[{"token":"WMON","amount":"1000000000000000000"}],"out":[{"token":"USDC"}]}'
```

### 0x Protocol
```bash
curl "https://api.0x.org/swap/permit2/quote?chainId=143&sellToken=WMON&buyToken=USDC&sellAmount=1000000000000000000" \
  -H "0x-api-key: YOUR_API_KEY"
```

---

## Next Steps
1. ✅ Get Monad chain ID and RPC
2. ✅ Research API docs
3. ✅ Build adapters for available APIs
4. [ ] Get 0x API key for production
5. [ ] Apply for Monorail developer access
6. [ ] Wire frontend to backend
7. [ ] Deploy for testing
