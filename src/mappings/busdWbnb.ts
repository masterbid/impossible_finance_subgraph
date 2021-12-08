import { BigInt, BigDecimal, store, Address } from "@graphprotocol/graph-ts";
import {
  PANCAKE_FACTORY_ADDRESS,
  convertTokenToDecimal,
  ZERO_BD,
  getOrCreateToken,
  ZERO_BI,
  BI_18
} from "./common";
import {
  BUSD_WBNB_PAIR,
  Sync,
} from "../../generated/BUSD_WBNB_PAIR/BUSD_WBNB_PAIR";
import { Pair, Token, Factory, Bundle } from "../../generated/schema";
import {
  getBnbPriceInUSD,
  findBnbPerToken,
  getTrackedVolumeUSD,
  getTrackedLiquidityUSD,
} from "./pricing";

export function handleSync(event: Sync): void {
  let factory_id = Address.fromString(PANCAKE_FACTORY_ADDRESS).toHexString();
  let factory = Factory.load(factory_id);
  if (factory == null) {
    factory = new Factory(factory_id);
    factory.pairCount = 0;
    factory.totalVolumeUSD = ZERO_BD;
    factory.totalVolumeBNB = ZERO_BD;
    factory.totalLiquidityUSD = ZERO_BD;
    factory.totalLiquidityBNB = ZERO_BD;
    factory.txCount = ZERO_BI;
    factory.untrackedVolumeUSD = ZERO_BD;

    // create new bundle, if it doesn't already exist
    let bundle = Bundle.load("1");
    if (bundle == null) {
      bundle = new Bundle("1");
      bundle.bnbPrice = ZERO_BD;
      bundle.save();
    }
  }

  // create the tokens
  let contract = BUSD_WBNB_PAIR.bind(event.address);
  let pair = Pair.load(event.address.toHexString());

  if (pair == null) {
    // create pair
    pair = new Pair(event.address.toHexString()) as Pair;
    let tryToken0 = contract.try_token0();
    if (!tryToken0.reverted) {
      let token0 = getOrCreateToken(event, tryToken0.value)
      pair.token0 = token0.id;
    }
    let tryToken1 = contract.try_token1();
    if (!tryToken1.reverted) {
      let token1 = getOrCreateToken(event, tryToken1.value)
      pair.token1 = token1.id;
    }
    pair.reserve0 = ZERO_BD;
    pair.reserve1 = ZERO_BD;
    pair.totalSupply = ZERO_BD;
    pair.reserveBNB = ZERO_BD;
    pair.reserveUSD = ZERO_BD;
    pair.token0Price = ZERO_BD;
    pair.token1Price = ZERO_BD;
    pair.volumeToken0 = ZERO_BD;
    pair.volumeToken1 = ZERO_BD;
    pair.trackedReserveBNB = ZERO_BD;
    pair.untrackedVolumeUSD = ZERO_BD;
    pair.volumeUSD = ZERO_BD;
    pair.txCount = ZERO_BI;
    pair.createdAtTimestamp = event.block.timestamp;
    pair.createdAtBlockNumber = event.block.number;
    pair.liquidityProviderCount = ZERO_BI;

    factory.pairCount = factory.pairCount + 1;
    factory.save();

    pair.save();
  }
  // reset factory liquidity by subtracting onluy tarcked liquidity
  factory.totalLiquidityBNB = factory.totalLiquidityBNB.minus(
    pair.trackedReserveBNB as BigDecimal
  );
  

  let token0 = Token.load(pair.token0);
  let token1 = Token.load(pair.token1);
  // reset token total liquidity amounts
  token0.totalLiquidity = token0.totalLiquidity.minus(pair.reserve0);
  token1.totalLiquidity = token1.totalLiquidity.minus(pair.reserve1);

  pair.reserve0 = convertTokenToDecimal(event.params.reserve0, BI_18);
  pair.reserve1 = convertTokenToDecimal(event.params.reserve1, BI_18);

  if (pair.reserve1.notEqual(ZERO_BD))
    pair.token0Price = pair.reserve0.div(pair.reserve1);
  else pair.token0Price = ZERO_BD;
  if (pair.reserve0.notEqual(ZERO_BD))
    pair.token1Price = pair.reserve1.div(pair.reserve0);
  else pair.token1Price = ZERO_BD;

  pair.save();

  // update BNB price now that reserves could have changed
  let bundle = Bundle.load("1");
  bundle.bnbPrice = getBnbPriceInUSD();
  bundle.save();

  // token0.derivedBNB = findBnbPerToken(token0 as Token);
  // token1.derivedBNB = findBnbPerToken(token1 as Token);
  // token0.save();
  // token1.save();

  // get tracked liquidity - will be 0 if neither is in whitelist
  let trackedLiquidityBNB: BigDecimal;
  if (bundle.bnbPrice.notEqual(ZERO_BD)) {
    trackedLiquidityBNB = getTrackedLiquidityUSD(
      pair.reserve0,
      token0 as Token,
      pair.reserve1,
      token1 as Token
    ).div(bundle.bnbPrice);
  } else {
    trackedLiquidityBNB = ZERO_BD;
  }

  // use derived amounts within pair
  pair.trackedReserveBNB = trackedLiquidityBNB;
  pair.reserveBNB = pair.reserve0
    .times(token0.derivedBNB as BigDecimal)
    .plus(pair.reserve1.times(token1.derivedBNB as BigDecimal));
  pair.reserveUSD = pair.reserveBNB.times(bundle.bnbPrice);

  // use tracked amounts globally
  factory.totalLiquidityBNB = factory.totalLiquidityBNB.plus(
    trackedLiquidityBNB as BigDecimal
  );
  factory.totalLiquidityUSD = factory.totalLiquidityBNB.times(bundle.bnbPrice);

  // now correctly set liquidity amounts for each token
  token0.totalLiquidity = token0.totalLiquidity.plus(pair.reserve0);
  token1.totalLiquidity = token1.totalLiquidity.plus(pair.reserve1);

  // save entities
  pair.save();
  factory.save();
  token0.save();
  token1.save();
}
