const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');

// GET /api/test/eth-price
// Query params:
//   rpc - optional RPC URL to use (falls back to process.env.ETH_RPC or a public mainnet RPC)
//   pool - optional Uniswap V3 pool address (defaults to WETH/USDC 0.3% pool)
// Returns JSON { price: <number>, base: 'ETH', quote: 'USDC', raw: { sqrtPriceX96, tick } }

// Default Uniswap V3 WETH/USDC 0.3% pool (mainnet)
const DEFAULT_POOL = '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8';

// Minimal Uniswap V3 pool ABI for slot0
const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)'
];

function defaultRpc() {
  return 'https://eth.llamarpc.com';
}

function priceFromTick(tick, decimals0, decimals1) {
  const tickNum = Number(tick);
  const priceToken1PerToken0 = Math.pow(1.0001, tickNum); // ETH per USDC
  const priceToken0PerToken1 =
    (1 / priceToken1PerToken0) * Math.pow(10, decimals1 - decimals0); // USDC per ETH
  return priceToken0PerToken1;
}
exports.priceFromTick = priceFromTick;

router.get('/eth-price', async (req, res) => {
  console.log('eth-price request received', req.query);
  try {
    const rpc = req.query.rpc || defaultRpc();
    const pool = req.query.pool || DEFAULT_POOL;

    console.log('using rpc:', rpc, 'pool:', pool);

    const provider = new ethers.JsonRpcProvider(rpc);
    const poolContract = new ethers.Contract(pool, POOL_ABI, provider);

    console.log('calling pool.slot0()');
    const slot0 = await poolContract.slot0();
    console.log('slot0 returned');
    const { sqrtPriceX96, tick } = slot0;

    const adjustedPrice = priceFromTick(tick, 6, 18);

    return res.json({
      price: adjustedPrice,
      base: 'ETH',
      quote: 'USDC',
      raw: {
        sqrtPriceX96: sqrtPriceX96.toString(),
        tick: Number(tick)
      }
    });
  } catch (err) {
    console.error('eth-price error', err);
    res
      .status(500)
      .json({ error: 'Failed to fetch price', details: err.stack });
  }
});

module.exports = router;
