/**
 * Handur Uniswap V3 & ERC-20 Log Parser Module
 * Designed for Ethers.js v6 integration in the Handur web app.
 */

import { ethers } from "ethers";

// -----------------------------------------------------------------------------
// ABI Topics & Event Definitions
// -----------------------------------------------------------------------------
export const EVENT_TOPICS = {
  // ERC-20 Transfer(address indexed from, address indexed to, uint256 value)
  TRANSFER: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
  
  // Uniswap V3 Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)
  UNISWAP_V3_SWAP: "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67"
};

const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

const UNISWAP_V3_POOL_ABI = [
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)"
];

const erc20Interface = new ethers.Interface(ERC20_ABI);
const uniswapV3Interface = new ethers.Interface(UNISWAP_V3_POOL_ABI);

// Q96 constant for sqrtPriceX96 calculation (2^96)
const Q96 = BigInt(2) ** BigInt(96);

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Calculates human-readable price from sqrtPriceX96 taking token decimals into account.
 * Price = (sqrtPriceX96 / 2^96)^2 * (10^decimalsToken0 / 10^decimalsToken1)
 */
export function calculateUniswapV3Price(sqrtPriceX96, decimals0 = 18, decimals1 = 18) {
  const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
  const rawPrice = sqrtPrice * sqrtPrice;
  const decimalAdjustment = 10 ** (decimals0 - decimals1);
  return rawPrice * decimalAdjustment;
}

// -----------------------------------------------------------------------------
// Core Event Parsers
// -----------------------------------------------------------------------------

/**
 * Parses raw EVM log into a structured ERC-20 Transfer Event object.
 */
export function parseTransferLog(log, tokenDecimals = 18, tokenSymbol = "TOKEN") {
  if (!log || log.topics[0] !== EVENT_TOPICS.TRANSFER) {
    throw new Error("Invalid or non-Transfer log topic");
  }

  const parsed = erc20Interface.parseLog({ topics: log.topics, data: log.data });
  const rawAmount = parsed.args.value;
  const formattedAmount = ethers.formatUnits(rawAmount, tokenDecimals);

  return {
    type: "TRANSFER",
    contractAddress: log.address,
    transactionHash: log.transactionHash,
    blockNumber: log.blockNumber,
    logIndex: log.logIndex,
    from: parsed.args.from,
    to: parsed.args.to,
    rawAmount: rawAmount.toString(),
    amount: formattedAmount,
    symbol: tokenSymbol
  };
}

/**
 * Parses raw EVM log into a structured Uniswap V3 Swap Event object.
 */
export function parseUniswapV3SwapLog(log, poolMeta = { decimals0: 18, decimals1: 18, symbol0: "TOKEN0", symbol1: "TOKEN1" }) {
  if (!log || log.topics[0] !== EVENT_TOPICS.UNISWAP_V3_SWAP) {
    throw new Error("Invalid or non-Uniswap V3 Swap log topic");
  }

  const parsed = uniswapV3Interface.parseLog({ topics: log.topics, data: log.data });
  const { sender, recipient, amount0, amount1, sqrtPriceX96, liquidity, tick } = parsed.args;

  const { decimals0, decimals1, symbol0, symbol1 } = poolMeta;

  const formattedAmount0 = ethers.formatUnits(amount0, decimals0);
  const formattedAmount1 = ethers.formatUnits(amount1, decimals1);
  const priceToken0InToken1 = calculateUniswapV3Price(sqrtPriceX96, decimals0, decimals1);

  // Determine direction: if amount0 is negative, pool sent token0 to user (BUY token0 with token1)
  const isBuyToken0 = amount0 < 0n;

  return {
    type: "SWAP",
    poolAddress: log.address,
    transactionHash: log.transactionHash,
    blockNumber: log.blockNumber,
    logIndex: log.logIndex,
    sender,
    recipient,
    amount0: {
      raw: amount0.toString(),
      formatted: formattedAmount0,
      symbol: symbol0
    },
    amount1: {
      raw: amount1.toString(),
      formatted: formattedAmount1,
      symbol: symbol1
    },
    sqrtPriceX96: sqrtPriceX96.toString(),
    priceToken0InToken1,
    liquidity: liquidity.toString(),
    tick: Number(tick),
    direction: isBuyToken0 ? `BUY ${symbol0}` : `BUY ${symbol1}`
  };
}

// -----------------------------------------------------------------------------
// Batch & Live Subscription Module
// -----------------------------------------------------------------------------

export class HandurLogParser {
  constructor(provider, poolConfig = {}) {
    this.provider = provider;
    this.poolConfig = poolConfig; // { [poolAddress]: { decimals0, decimals1, symbol0, symbol1 } }
  }

  /**
   * Batch parse mixed raw logs (Transfers & Swaps)
   */
  parseLogs(logs) {
    const results = { transfers: [], swaps: [], unknown: [] };

    for (const log of logs) {
      const topic0 = log.topics[0];
      try {
        if (topic0 === EVENT_TOPICS.TRANSFER) {
          results.transfers.push(parseTransferLog(log));
        } else if (topic0 === EVENT_TOPICS.UNISWAP_V3_SWAP) {
          const meta = this.poolConfig[log.address.toLowerCase()] || {};
          results.swaps.push(parseUniswapV3SwapLog(log, meta));
        } else {
          results.unknown.push(log);
        }
      } catch (err) {
        console.warn(`Failed to parse log at tx ${log.transactionHash}:`, err);
      }
    }

    return results;
  }

  /**
   * Subscribe to live Uniswap V3 Swap logs for a target pool address
   */
  subscribeToPoolSwaps(poolAddress, callback, poolMeta = {}) {
    const filter = {
      address: poolAddress,
      topics: [EVENT_TOPICS.UNISWAP_V3_SWAP]
    };

    const listener = (log) => {
      try {
        const parsedSwap = parseUniswapV3SwapLog(log, poolMeta);
        callback(null, parsedSwap);
      } catch (err) {
        callback(err, null);
      }
    };

    this.provider.on(filter, listener);

    // Unsubscribe helper
    return () => this.provider.off(filter, listener);
  }
}
