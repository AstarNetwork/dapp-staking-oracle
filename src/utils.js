const { Keyring } = require("@polkadot/api");

function getAccount(api, config) {
    const keyring = new Keyring({
      type: "sr25519",
      ss58Format: api.registry.chainSS58,
    });
  
    const maybeSeed = process.env["SEED"];
    if (config.seedPhrase) {
      console.info("Creating an account from the provided see phrase.");
      return keyring.addFromUri(config.seedPhrase);
    } else {
      console.info("No seed provided, using Alice.");
      return keyring.addFromUri("//Alice");
    }
  }

  async function sendAndFinalize(tx, signer, options) {
    return new Promise((resolve) => {
      let success = false;
      let included = [];
      let finalized = [];
  
      const unsubPromise = tx.signAndSend(
        signer,
        options,
        ({ events = [], status, dispatchError }) => {
          if (status.isInBlock) {
            success = dispatchError ? false : true;
            console.log(
              `📀 Transaction ${tx.meta.name}(..) included at blockHash ${status.asInBlock} [success = ${success}]`
            );
            included = [...events];
            const hash = status.hash;
          } else if (status.isBroadcast) {
            console.log(`🚀 Transaction broadcasted.`);
          } else if (status.isFinalized) {
            console.log(
              `💯 Transaction ${tx.meta.name}(..) Finalized at blockHash ${status.asFinalized}`
            );
            finalized = [...events];
            const hash = status.hash;
            resolve({ success, hash, included, finalized, unsubPromise });
          } else if (status.isReady) {
            // ...
          } else if (status.isInvalid) {
            console.log(`🚫 Transaction ${tx.meta.name}(..) invalid`);
            success = false;
            resolve({ success, included, finalized, unsubPromise });
          } else if (status.isUsurped) {
            console.log(`👮 Transaction ${tx.meta.name}(..) usurped`);
            success = false;
            resolve({ success, included, finalized, unsubPromise });
          } else {
            console.log(`🤷 Other status ${status.toString()}`);
          }
        }
      );
    });
  }
  
  module.exports = { getAccount, sendAndFinalize };