import { test } from "node:test";
import assert from "node:assert/strict";
import { ethers } from "ethers";
import {
  EVENT_TOPICS,
  HandurLogParser,
  calculateUniswapV3Price,
  parseTransferLog,
  parseUniswapV3SwapLog
} from "../handur_log_parser.js";

const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const POOL = "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640";
const ALICE = "0x1111111111111111111111111111111111111111";
const BOB = "0x2222222222222222222222222222222222222222";

const erc20 = new ethers.Interface(["event Transfer(address indexed from, address indexed to, uint256 value)"]);
const erc721 = new ethers.Interface(["event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"]);
const pool = new ethers.Interface([
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)"
]);

function makeLog(iface, name, args, address) {
  const { topics, data } = iface.encodeEventLog(name, args);
  return { address, topics, data, transactionHash: "0xabc", blockNumber: 1, logIndex: 0 };
}

// sqrtPriceX96 for "1 WETH = 3000 USDC" in the USDC(6)/WETH(18) pool:
// raw price (token1 wei per token0 unit) = (1/3000) * 10^(18-6)
const SQRT_PRICE_3000 = BigInt(Math.round(Math.sqrt((1 / 3000) * 1e12) * 2 ** 96));

function swapLog(amount0, amount1) {
  return makeLog(pool, "Swap", [ALICE, BOB, amount0, amount1, SQRT_PRICE_3000, 10n ** 18n, 200000], POOL);
}

test("calculateUniswapV3Price adjusts for token decimals", () => {
  const price = calculateUniswapV3Price(SQRT_PRICE_3000, 6, 18);
  assert.ok(Math.abs(price - 1 / 3000) / (1 / 3000) < 1e-9, `got ${price}`);
});

test("parseTransferLog formats amount with given decimals", () => {
  const log = makeLog(erc20, "Transfer", [ALICE, BOB, 1_500_000n], USDC);
  const t = parseTransferLog(log, 6, "USDC");
  assert.equal(t.amount, "1.5");
  assert.equal(t.symbol, "USDC");
});

test("parseTransferLog rejects ERC-721 transfers", () => {
  const log = makeLog(erc721, "Transfer", [ALICE, BOB, 42n], USDC);
  assert.equal(log.topics[0], EVENT_TOPICS.TRANSFER);
  assert.throws(() => parseTransferLog(log), /ERC-20/);
});

test("swap direction: negative amount0 means token0 was bought", () => {
  const buyUsdc = parseUniswapV3SwapLog(swapLog(-3000_000000n, 10n ** 18n), {
    decimals0: 6, decimals1: 18, symbol0: "USDC", symbol1: "WETH"
  });
  assert.equal(buyUsdc.direction, "BUY USDC");
  assert.equal(buyUsdc.amount0.formatted, "-3000.0");

  const buyWeth = parseUniswapV3SwapLog(swapLog(3000_000000n, -(10n ** 18n)), {
    decimals0: 6, decimals1: 18, symbol0: "USDC", symbol1: "WETH"
  });
  assert.equal(buyWeth.direction, "BUY WETH");
});

test("swap without metadata falls back to generic symbols, not undefined", () => {
  const s = parseUniswapV3SwapLog(swapLog(-1n, 1n), { decimals0: 6 });
  assert.equal(s.direction, "BUY TOKEN0");
  assert.equal(s.amount1.symbol, "TOKEN1");
});

test("parseLogs uses token/pool config with checksummed keys", () => {
  const parser = new HandurLogParser(
    null,
    { [POOL]: { decimals0: 6, decimals1: 18, symbol0: "USDC", symbol1: "WETH" } },
    { [USDC]: { decimals: 6, symbol: "USDC" } }
  );
  const logs = [
    makeLog(erc20, "Transfer", [ALICE, BOB, 2_000_000n], USDC.toLowerCase()),
    makeLog(erc721, "Transfer", [ALICE, BOB, 7n], USDC),
    swapLog(-3000_000000n, 10n ** 18n)
  ];
  const { transfers, swaps, unknown } = parser.parseLogs(logs);

  assert.equal(transfers.length, 1);
  assert.equal(transfers[0].amount, "2.0");
  assert.equal(transfers[0].symbol, "USDC");
  assert.equal(unknown.length, 1, "ERC-721 transfer goes to unknown");
  assert.equal(swaps[0].direction, "BUY USDC");
});

test("subscribeToPoolSwaps uses pool config by default and unsubscribes", () => {
  const listeners = new Map();
  const provider = {
    on: (filter, fn) => listeners.set(filter, fn),
    off: (filter) => listeners.delete(filter)
  };
  const parser = new HandurLogParser(provider, {
    [POOL]: { decimals0: 6, decimals1: 18, symbol0: "USDC", symbol1: "WETH" }
  });

  let received;
  const stop = parser.subscribeToPoolSwaps(POOL, (err, swap) => { received = swap; });
  [...listeners.values()][0](swapLog(3000_000000n, -(10n ** 18n)));
  assert.equal(received.direction, "BUY WETH");

  stop();
  assert.equal(listeners.size, 0);
});
