const ethers = require('ethers');
const fetch = require('node-fetch');

const BAND_L1_ABI = require('../res/bandL1Abi.json');
const ACURAST_L2_ABI = require('../res/acurastL2Abi.json');
// Found here: https://github.com/pyth-network/pyth-crosschain/tree/main/target_chains/ethereum/sdk/solidity
const PYTH_L2_ABI = require('../res/pythL2Abi.json');

function decimalToFixedU128(decimalPrice) {
  // Prepare `FixedU128` format for the price.
  // FixedU128 is divided by a factor of 10^18. Received price is in decimal format, an can easily be less than 1.
  // The conversion to BigInt therefore has to be done in two steps to reduce precision loss:
  //
  // 1. Multiply with a factor of 10^15 (1_000_000_000_000_000) which keeps us inside normal integer range
  // 2. Multiply with a factor of 10^3 (1_000) to get to the FixedU128 format, converting to BigInt in the process
  const fixedU128Factor1 = 1_000_000_000_000_000;
  const fixedU128Factor2 = 1_000;

  return BigInt(Math.round(decimalPrice * fixedU128Factor1)) * BigInt(fixedU128Factor2);
}

// Fetches the price from the Astar Foundation maintained API.
async function fetchAstarApiPrice(config) {
  try {
    const response = await fetch(config.astarApiURL);
    const data = await response.json();

    const price = data.price;
    const timestamp = new Date(data.lastUpdated);

    return {
      price: decimalToFixedU128(price),
      timestamp: timestamp,
      name: "Astar API price"
    };
  } catch (error) {
    console.error("Error fetching Astar API price: ", error);
    return null;
  }
}

// Fetches the price from the DIA API.
//
// It's unknown how reliable this is and whether we should even use it.
async function fetchDiaApiPrice(config) {
  try {
    const response = await fetch(config.diaApiURL);
    const data = await response.json();

    const price = data.Price;
    const timestamp = new Date(data.Time);

    return {
      price: decimalToFixedU128(price),
      timestamp: timestamp,
      name: "DIA API price"
    };
  } catch (error) {
    console.error("Error fetching DIA API price: ", error);
    return null;
  }
}

// Fetches the price from the L1 on-chain Band oracle.
async function fetchBandL1Price(config) {
  try {
    const provider = new ethers.providers.JsonRpcProvider(config.L1RpcEndpoint);
    const contract = new ethers.Contract('0xDA7a001b254CD22e46d3eAB04d937489c93174C3', BAND_L1_ABI, provider);

    const result = await contract.getReferenceData(config.nativeCurrencySymbol, 'USD');

    // From the Band documentation
    // https://docs.bandchain.org/products/band-standard-dataset/using-band-standard-dataset/contract
    // Price is written in fixed point format, matching the `FixedU128` exactly, with 10^18 decimals.

    const price = BigInt(result[0]);
    const timestamp = new Date(result[1] * 1000);

    return {
      price: price,
      timestamp: timestamp,
      name: "Band L1 price" 
    };
  } catch (error) {
    console.error("Error fetching Band L1 price: ", error);
    return null;
  }
}

// Fetches the price from the on-chain Acurast oracle
//
// NOTE: doesn't work, maybe ABI or address are wrong
async function fetchAcurastL2Price(config) {
  const provider = new ethers.providers.JsonRpcProvider(config.L2RpcEndpoint);
  const contract = new ethers.Contract('0xde4F97786EAB4e47b96A0A65EdD7755895077073', ACURAST_L2_ABI, provider);

  const result = await contract.description();
}

// Fetches the price from the L2 on-chain Pyth oracle.
//
// NOTE: Works but not for latest price since it's often marked as stale.
async function fetchPythL2Price(config) {
  try {
    const provider = new ethers.providers.JsonRpcProvider(config.L2RpcEndpoint);
    const contract = new ethers.Contract('0xA2aa501b19aff244D90cc15a4Cf739D2725B5729', PYTH_L2_ABI, provider);

    // ASTR/USD price feed Id
    const priceFeedId = '0x89b814de1eb2afd3d3b498d296fca3a873e644bafb587e84d181a01edd682853';

    const result = await contract.getPriceUnsafe(priceFeedId);

    // Result format can be found here:
    // - https://github.com/pyth-network/pyth-crosschain/blob/main/target_chains/ethereum/sdk/solidity/PythStructs.sol
    // Price is specified in fixed point format: result[0] * 10^result[2], where result[0] and result[2] are int64

    // `FixedU128` has 10^18 decimals so when converting, we need to account for that
    const scalingFactor = parseInt(result[2]) + 18;

    let tempPrice;
    if (scalingFactor >= 0) {
      tempPrice = BigInt(result[0]) * BigInt(10 ** scalingFactor);
    } else {
      tempPrice = BigInt(result[0]) / BigInt(10 ** -scalingFactor);
    }
    const price = tempPrice;
    const timestamp = new Date(result[3] * 1000);

    return {
      price: price,
      timestamp: timestamp,
      name: "Pyth L2 price"
    };
  } catch (error) {
    console.error("Error fetching Pyth L2 price: ", error);
    return null;
  }
}

async function getAstrFeeds(config) {
    const astrFeeds = [
        fetchAstarApiPrice(config),
        fetchDiaApiPrice(config),
        fetchBandL1Price(config),
        fetchPythL2Price(config)
    ];
    
    return Promise.all(astrFeeds);
}

async function getSdnFeeds(config) {
  const sdnFeeds = [
      fetchAstarApiPrice(config),
      fetchDiaApiPrice(config),
  ];
  
  return Promise.all(sdnFeeds);
}

module.exports = {getAstrFeeds, getSdnFeeds};