import { BigDecimal, Address } from "@graphprotocol/graph-ts";
import {
  PANCAKE_FACTORY_ADDRESS,
  convertTokenToDecimal,
  ZERO_BD,
  getOrCreatePancakeToken,
  ZERO_BI,
  BI_18
} from "./common";
import {
  USDT_WBNB_PAIR,
  Sync,
} from "../../generated/USDT_WBNB_PAIR/USDT_WBNB_PAIR";
import { PancakeswapPair, PancakeswapToken, PancakeswapFactory, Bundle } from "../../generated/schema";
import {
  getBnbPriceInUSD,
  findBnbPerToken,
  getTrackedVolumeUSD,
  getTrackedLiquidityUSD,
} from "./pricing";

export function handleSync(event: Sync): void {
  let factory_id = Address.fromString(PANCAKE_FACTORY_ADDRESS).toHexString();
  let factory = PancakeswapFactory.load(factory_id);
  if (factory == null) {
    factory = new PancakeswapFactory(factory_id);
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
  let contract = USDT_WBNB_PAIR.bind(event.address);
  let pair = PancakeswapPair.load(event.address.toHexString());

  if (pair == null) {
    // create pair
    pair = new PancakeswapPair(event.address.toHexString()) as PancakeswapPair;
    let tryToken0 = contract.try_token0();
    if (!tryToken0.reverted) {
      let token0 = getOrCreatePancakeToken(event, tryToken0.value)
      pair.token0 = token0.id;
    }
    let tryToken1 = contract.try_token1();
    if (!tryToken1.reverted) {
      let token1 = getOrCreatePancakeToken(event, tryToken1.value)
      pair.token1 = token1.id;
    }
    pair.reserve0 = ZERO_BD;
    pair.reserve1 = ZERO_BD;
    pair.totalSupply = ZERO_BD;
    pair.token0Price = ZERO_BD;
    pair.token1Price = ZERO_BD;
    pair.volumeToken0 = ZERO_BD;
    pair.volumeToken1 = ZERO_BD;
    pair.untrackedVolumeUSD = ZERO_BD;
    pair.volumeUSD = ZERO_BD;
    pair.txCount = ZERO_BI;
    pair.createdAtTimestamp = event.block.timestamp;
    pair.createdAtBlockNumber = event.block.number;

    factory.pairCount = factory.pairCount + 1;
    factory.save();

    pair.save();
  }

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


  // save entities
  pair.save();
}
