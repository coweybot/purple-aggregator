import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATS_FILE = path.join(__dirname, '../../data/stats.json');

// Ensure data directory exists
const dataDir = path.dirname(STATS_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize or load stats
function loadStats() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading stats:', e);
  }
  
  // Default stats structure
  return {
    totalTransactions: 0,
    totalVolumeUSD: 0,
    uniqueWallets: [],
    transactions: [], // Last 100 transactions
    daily: {}, // Daily stats by date
    byAggregator: {}, // Stats per aggregator
    byToken: {}, // Stats per token
    lastUpdated: Date.now()
  };
}

function saveStats(stats) {
  try {
    stats.lastUpdated = Date.now();
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
  } catch (e) {
    console.error('Error saving stats:', e);
  }
}

let stats = loadStats();

/**
 * POST /api/stats/transaction
 * Record a new transaction
 */
router.post('/transaction', (req, res) => {
  try {
    const {
      txHash,
      walletAddress,
      fromToken,
      toToken,
      fromAmount,
      toAmount,
      aggregator,
      usdValue = 0,
      status = 'success'
    } = req.body;

    if (!txHash || !walletAddress) {
      return res.status(400).json({ success: false, error: 'Missing txHash or walletAddress' });
    }

    const transaction = {
      txHash,
      walletAddress: walletAddress.toLowerCase(),
      fromToken,
      toToken,
      fromAmount,
      toAmount,
      aggregator,
      usdValue: parseFloat(usdValue) || 0,
      status,
      timestamp: Date.now()
    };

    // Update totals
    stats.totalTransactions++;
    stats.totalVolumeUSD += transaction.usdValue;

    // Track unique wallets
    if (!stats.uniqueWallets.includes(transaction.walletAddress)) {
      stats.uniqueWallets.push(transaction.walletAddress);
    }

    // Add to recent transactions (keep last 100)
    stats.transactions.unshift(transaction);
    if (stats.transactions.length > 100) {
      stats.transactions = stats.transactions.slice(0, 100);
    }

    // Daily stats
    const today = new Date().toISOString().split('T')[0];
    if (!stats.daily[today]) {
      stats.daily[today] = { transactions: 0, volumeUSD: 0, wallets: [] };
    }
    stats.daily[today].transactions++;
    stats.daily[today].volumeUSD += transaction.usdValue;
    if (!stats.daily[today].wallets.includes(transaction.walletAddress)) {
      stats.daily[today].wallets.push(transaction.walletAddress);
    }

    // By aggregator
    if (aggregator) {
      if (!stats.byAggregator[aggregator]) {
        stats.byAggregator[aggregator] = { transactions: 0, volumeUSD: 0 };
      }
      stats.byAggregator[aggregator].transactions++;
      stats.byAggregator[aggregator].volumeUSD += transaction.usdValue;
    }

    // By token
    if (fromToken) {
      if (!stats.byToken[fromToken]) {
        stats.byToken[fromToken] = { swapsFrom: 0, swapsTo: 0, volumeUSD: 0 };
      }
      stats.byToken[fromToken].swapsFrom++;
      stats.byToken[fromToken].volumeUSD += transaction.usdValue;
    }
    if (toToken) {
      if (!stats.byToken[toToken]) {
        stats.byToken[toToken] = { swapsFrom: 0, swapsTo: 0, volumeUSD: 0 };
      }
      stats.byToken[toToken].swapsTo++;
    }

    // Save to disk
    saveStats(stats);

    res.json({ success: true, totalTransactions: stats.totalTransactions });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/stats
 * Get current stats
 */
router.get('/', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const todayStats = stats.daily[today] || { transactions: 0, volumeUSD: 0, wallets: [] };

  res.json({
    success: true,
    totalTransactions: stats.totalTransactions,
    totalVolumeUSD: stats.totalVolumeUSD,
    uniqueWallets: stats.uniqueWallets.length,
    today: {
      transactions: todayStats.transactions,
      volumeUSD: todayStats.volumeUSD,
      uniqueWallets: todayStats.wallets?.length || 0
    },
    byAggregator: stats.byAggregator,
    recentTransactions: stats.transactions.slice(0, 10),
    lastUpdated: stats.lastUpdated
  });
});

/**
 * GET /api/stats/live
 * Get live summary (lightweight for frequent polling)
 */
router.get('/live', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const todayStats = stats.daily[today] || { transactions: 0, volumeUSD: 0, wallets: [] };

  res.json({
    total: stats.totalTransactions,
    volume: stats.totalVolumeUSD,
    wallets: stats.uniqueWallets.length,
    todayTx: todayStats.transactions,
    todayVol: todayStats.volumeUSD
  });
});

export default router;
