const ethers = require('ethers');

const BAND_L1_ABI = require('../res/bandL1Abi.json');

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
    const provider = new ethers.JsonRpcProvider(config.L1RpcEndpoint);
    const contract = new ethers.Contract('0xDA7a001b254CD22e46d3eAB04d937489c93174C3', BAND_L1_ABI, provider);

    const result = await contract.getReferenceData(config.nativeCurrencySymbol, 'USD');

    const price = BigInt(result[0]);
    const timestamp = new Date(Number(result[1]) * 1000);

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

async function getAstrFeeds(config) {
    const astrFeeds = [
        fetchAstarApiPrice(config),
        fetchDiaApiPrice(config),
        fetchBandL1Price(config),
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