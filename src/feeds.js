const ethers = require('ethers');
const fetch = require('node-fetch');

const BAND_L1_ABI = require('../res/bandL1Abi.json');
const ACURAST_L2_ABI = require('../res/acurastL2Abi.json');
// Found here: https://github.com/pyth-network/pyth-crosschain/tree/main/target_chains/ethereum/sdk/solidity
const PYTH_L2_ABI = require('../res/pythL2Abi.json');

// Fetches the price from the Astar Foundation maintained API.
async function fetchAstarApiPrice(config) {
  try {
    const response = await fetch(config.astarApiURL);
    const price = await response.json();
    console.log("Astar API price: " + price);

    return {
      price: price,
      // TODO: add timestamp when it's implemented
      timestamp: new Date(),
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
    console.log("DIA API price: " + price, "Timestamp: " + timestamp);

    return {
      price: price,
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
    const DECIMALS = 1_000_000_000_000_000_000;

    const price = result[0] / DECIMALS;
    const timestamp = new Date(result[1] * 1000);

    console.log("Band price: " + price, "Timestamp: " + timestamp);

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

  console.log("Acurast L2 price: " + result);
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

    const scalingFactor = 10 ** result[2];
    const price = result[0] * scalingFactor;
    const timestamp = new Date(result[3] * 1000);

    console.log("Pyth L2 price: " + price, "Timestamp: " + timestamp);

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