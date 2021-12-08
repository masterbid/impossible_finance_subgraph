import { Bundle, Pair, Factory } from "../../generated/schema"
import { PairCreated } from "../../generated/StableXFactory/StableXFactory"
import { ImpossiblePair} from "../../generated/templates"
import {
  getOrCreateToken,
  ZERO_BD,
  ZERO_BI,
} from './common'

export function handlePairCreated(event: PairCreated): void {
  // load factory (create if first exchange)
  let id = event.address.toHexString()
  let factory = Factory.load(id)
  if (factory == null) {
    factory = new Factory(id)
    factory.pairCount = 0
    factory.totalVolumeUSD = ZERO_BD
    factory.totalVolumeBNB = ZERO_BD
    factory.totalLiquidityUSD = ZERO_BD
    factory.totalLiquidityBNB = ZERO_BD
    factory.txCount = ZERO_BI
    factory.untrackedVolumeUSD = ZERO_BD

    // create new bundle, if it doesn't already exist
    let bundle = Bundle.load('1')
    if(bundle == null) {
      let bundle = new Bundle('1')
      bundle.bnbPrice = ZERO_BD
      bundle.save()
    }
  }
  factory.pairCount = factory.pairCount + 1
  factory.save()

  // create the tokens
  let token0 = getOrCreateToken(event, event.params.token0)
  let token1 = getOrCreateToken(event, event.params.token1)

  // create pair
  let pair = new Pair(event.params.pair.toHexString()) as Pair
  pair.token0 = token0.id
  pair.token1 = token1.id
  pair.reserve0 = ZERO_BD
  pair.reserve1 = ZERO_BD
  pair.totalSupply = ZERO_BD
  pair.reserveBNB = ZERO_BD
  pair.reserveUSD = ZERO_BD
  pair.token0Price = ZERO_BD
  pair.token1Price = ZERO_BD
  pair.volumeToken0 = ZERO_BD
  pair.volumeToken1 = ZERO_BD
  pair.trackedReserveBNB = ZERO_BD
  pair.untrackedVolumeUSD = ZERO_BD
  pair.volumeUSD = ZERO_BD
  pair.txCount = ZERO_BI
  pair.createdAtTimestamp = event.block.timestamp
  pair.createdAtBlockNumber = event.block.number
  pair.liquidityProviderCount = ZERO_BI

  // create the tracked contract based on the template
  ImpossiblePair.create(event.params.pair)

  // save updated values
  token0.save()
  token1.save()
  pair.save()
  factory.save()

}
