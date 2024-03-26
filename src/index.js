const {getAstrFeeds, getSdnFeeds} = require('./feeds')
const { getAccount, sendAndFinalize} = require('./utils')

const { ApiPromise, WsProvider } = require("@polkadot/api");
const yargs = require("yargs");
const path = require('path');

async function getPrice(config) {
    // 1. Get the price feeds
    let results;
    if (config.network.toLowerCase() === "astar") {
      results = await getAstrFeeds(config);
    } else if (config.network.toLowerCase() === "shiden") {
      results = await getSdnFeeds(config);
    } else {
      console.error("Invalid network provided. Please provide either 'astar' or 'shiden'.");
      return;
    }
    console.log("Results: ", results);
  
    // 2. Filter out results which are older than the time limit, or are zero or null
    const updateCadenceHours = parseInt(config.updateCadenceHours, 10);
    let limitTime = new Date();
    limitTime.setHours(limitTime.getHours() - updateCadenceHours);
  
    // Filter the results
    results = results.filter(result => {
      return !(result === null || result.timestamp < limitTime || result.price == 0);
    });
    console.log("Filtered results: ", results);
  
    // 3. Calculate the median price & return it.
    if (results.length === 0) {
      console.error("No valid results to calculate the median price.");
      return;
    }

    // Sort the results by price
    results.sort((a, b) => a.price > b.price ? 1 : -1);

    // Calculate the median
    let median;
    if (results.length % 2 === 0) {
      median = (results[results.length / 2 - 1].price + results[results.length / 2].price) / 2;
    } else {
      median = results[(results.length - 1) / 2].price;
    }
    console.log("Median price: ", median);
  
    return median;
}

async function submitPrice(price, config) {
  // 1. Prepare the transaction for price feed update
  const wsProvider = new WsProvider(config.L1WssEndpoint);
  const api = await ApiPromise.create({ provider: wsProvider });

  const signer = getAccount(api, config);
  const transaction = api.tx.oracle.feedValues([[config.nativeCurrencySymbol, price]]);

  // 2. Send it and await finalization
  const result = await sendAndFinalize(transaction, signer);
  if (result.unsubPromise) {
    // Not very elegant, but we need to unsubscribe from the provider to avoid memory leaks
    const unsub = await result.unsubPromise;
    unsub();
  }
}

async function runUpdates(config) {
  const updateCadenceHours = parseInt(config.updateCadenceHours, 10);
  console.log(`⏰ \u23F0  Starting the price feed service with a cadence of ${updateCadenceHours} hours...`);

  // First run to check if we need to submit the price immediately
  const currentHour = new Date().getHours();
  if (currentHour % updateCadenceHours === 0) {
    const price = await getPrice(config);
    await submitPrice(price, config);
    console.log("💸 Price successfully submitted. Waiting for the next update...")
  }

  // Run the update periodically
  setInterval(async () => {
    const currentHour = new Date().getHours();
    if (currentHour % updateCadenceHours === 0) {
      try {
        const price = await getPrice(config);
        await submitPrice(price, config);
        console.log("💸 Price successfully submitted. Waiting for the next update...")
      } catch (error) {
        console.error("An error occurred while submitting the price: ", error);
      }
    }
  }, 1000 * 60 * 60); // Run every hour
}


async function main() {
  const argv = yargs
    .options({
      config: {
        alias: 'c',
        description: 'Path to the config file.',
        string: true,
        demandOption: true,
        global: true,
        coerce: (arg) => {
          return path.resolve(arg);
        }
      },
    })
    .parse();

    const config = require(argv.config);

  runUpdates(config);
}

main();