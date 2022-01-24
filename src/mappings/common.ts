import { log, BigInt, BigDecimal, Address, ethereum } from "@graphprotocol/graph-ts"
import { StableXFactory } from '../../generated/templates/ImpossiblePair/StableXFactory'
import { ERC20 } from "../../generated/StableXFactory/ERC20"
import { User, Bundle, Token, LiquidityPosition, LiquidityPositionSnapshot, Pair, PancakeswapToken } from "../../generated/schema"

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'
export const IMPOSSIBLE_FACTORY_ADDRESS = '0x918d7e714243f7d9d463c37e106235dcde294ffc'
export const PANCAKE_FACTORY_ADDRESS = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73'

export let ZERO_BI = BigInt.fromI32(0)
export let ONE_BI = BigInt.fromI32(1)
export let ZERO_BD = BigDecimal.fromString('0')
export let ONE_BD = BigDecimal.fromString('1')
export let BI_18 = BigInt.fromI32(18)

export let factoryContract = StableXFactory.bind(Address.fromString(IMPOSSIBLE_FACTORY_ADDRESS))

export function exponentToBigDecimal(decimals: BigInt): BigDecimal {
  let bd = BigDecimal.fromString('1')
  for (let i = ZERO_BI; i.lt(decimals as BigInt); i = i.plus(ONE_BI)) {
    bd = bd.times(BigDecimal.fromString('10'))
  }
  return bd
}

export function bigDecimalExp18(): BigDecimal {
  return BigDecimal.fromString('1000000000000000000')
}

export function convertBNBToDecimal(bnb: BigInt): BigDecimal {
  return bnb.toBigDecimal().div(exponentToBigDecimal(BigInt.fromI32(18)))
}

export function convertTokenToDecimal(tokenAmount: BigInt, exchangeDecimals: BigInt): BigDecimal {
  if (exchangeDecimals == ZERO_BI) {
    return tokenAmount.toBigDecimal()
  }
  return tokenAmount.toBigDecimal().div(exponentToBigDecimal(exchangeDecimals))
}

export function equalToZero(value: BigDecimal): boolean {
  const formattedVal = parseFloat(value.toString())
  const zero = parseFloat(ZERO_BD.toString())
  if (zero == formattedVal) {
    return true
  }
  return false
}

export function isNullEthValue(value: string): boolean {
  return value == '0x0000000000000000000000000000000000000000000000000000000000000001'
}

export function getOrCreatePancakeToken(event: ethereum.Event, address: Address): PancakeswapToken {
    let addressHex = address.toHexString()
    let token = PancakeswapToken.load(addressHex)
    if (token != null) {
        return token as PancakeswapToken
    }

    token = new PancakeswapToken(addressHex)
    let tokenInstance = ERC20.bind(address)
    let tryName = tokenInstance.try_name()
    if (!tryName.reverted) {
        token.name = tryName.value
    }
    let trySymbol = tokenInstance.try_symbol()
    if (!trySymbol.reverted) {
        token.symbol = trySymbol.value
    }
    let tryDecimals = tokenInstance.try_decimals()
    if (!tryDecimals.reverted) {
        token.decimals = BigInt.fromI32(tryDecimals.value)
    }
    let tryTotalSupply = tokenInstance.try_totalSupply()
    if (!tryTotalSupply.reverted) {
        token.totalSupply = tryTotalSupply.value
    }
    token.tradeVolume = ZERO_BD
    token.tradeVolumeUSD = ZERO_BD
    token.untrackedVolumeUSD = ZERO_BD
    token.txCount = ZERO_BI
    
    token.save()
    return token as PancakeswapToken
}
export function getOrCreateToken(event: ethereum.Event, address: Address): Token {
    let addressHex = address.toHexString()
    let token = Token.load(addressHex)
    if (token != null) {
        return token as Token
    }

    token = new Token(addressHex)
    let tokenInstance = ERC20.bind(address)
    let tryName = tokenInstance.try_name()
    if (!tryName.reverted) {
        token.name = tryName.value
    }
    let trySymbol = tokenInstance.try_symbol()
    if (!trySymbol.reverted) {
        token.symbol = trySymbol.value
    }
    let tryDecimals = tokenInstance.try_decimals()
    if (!tryDecimals.reverted) {
        token.decimals = BigInt.fromI32(tryDecimals.value)
    }
    let tryTotalSupply = tokenInstance.try_totalSupply()
    if (!tryTotalSupply.reverted) {
        token.totalSupply = tryTotalSupply.value
    }
    token.tradeVolume = ZERO_BD
    token.tradeVolumeUSD = ZERO_BD
    token.untrackedVolumeUSD = ZERO_BD
    token.txCount = ZERO_BI
    token.totalLiquidity = ZERO_BD
    token.derivedBNB = ZERO_BD
    
    token.save()
    return token as Token
}

export function createLiquidityPosition(exchange: Address, user: Address): LiquidityPosition {
  let id = exchange
    .toHexString()
    .concat('-')
    .concat(user.toHexString())
  let liquidityTokenBalance = LiquidityPosition.load(id)
  if (liquidityTokenBalance === null) {
    let pair = Pair.load(exchange.toHexString())
    pair.liquidityProviderCount = pair.liquidityProviderCount.plus(ONE_BI)
    liquidityTokenBalance = new LiquidityPosition(id)
    liquidityTokenBalance.liquidityTokenBalance = ZERO_BD
    liquidityTokenBalance.pair = exchange.toHexString()
    liquidityTokenBalance.user = user.toHexString()
    liquidityTokenBalance.save()
    pair.save()
  }
  if (liquidityTokenBalance === null) log.error('LiquidityTokenBalance is null', [id])
  return liquidityTokenBalance as LiquidityPosition
}

export function createUser(address: Address): void {
  let user = User.load(address.toHexString())
  if (user === null) {
    user = new User(address.toHexString())
    user.usdSwapped = ZERO_BD
    user.save()
  }
}

export function createLiquiditySnapshot(position: LiquidityPosition, event: ethereum.Event): void {
  let timestamp = event.block.timestamp.toI32()
  let bundle = Bundle.load('1')
  let pair = Pair.load(position.pair)
  let token0 = Token.load(pair.token0)
  let token1 = Token.load(pair.token1)

  // create new snapshot
  let snapshot = new LiquidityPositionSnapshot(position.id.concat(timestamp.toString()))
  snapshot.liquidityPosition = position.id
  snapshot.timestamp = timestamp
  snapshot.block = event.block.number.toI32()
  snapshot.user = position.user
  snapshot.pair = position.pair
  snapshot.token0PriceUSD = token0.derivedBNB.times(bundle.bnbPrice)
  snapshot.token1PriceUSD = token1.derivedBNB.times(bundle.bnbPrice)
  snapshot.reserve0 = pair.reserve0
  snapshot.reserve1 = pair.reserve1
  snapshot.reserveUSD = pair.reserveUSD
  snapshot.liquidityTokenTotalSupply = pair.totalSupply
  snapshot.liquidityTokenBalance = position.liquidityTokenBalance
  snapshot.liquidityPosition = position.id
  snapshot.save()
  position.save()
}