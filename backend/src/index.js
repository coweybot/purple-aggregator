import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import quoteRoutes from './routes/quote.js';
import swapRoutes from './routes/swap.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'purple-aggregator' });
});

// Quote routes
app.use('/api', quoteRoutes);

// Swap routes (for direct execution)
app.use('/api', swapRoutes);

app.listen(PORT, () => {
  console.log(`🟣 Purple Aggregator running on port ${PORT}`);
});
