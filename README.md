# dApp Staking Oracle Service

Simple script to ensure periodic native currency (ASTR or SDN) price feed to the network.

## Overview

The script is fairly simple, and can be summed up into a few main steps.

### Price Feed Aggregation

Price is taken from multiple sources, together with the timestamp.
It is possible that some sources might return errors or will be faulty in some way - they will be ignored.
Only valid return values will be considered for further processing.

### Outdated Price Filtering

Price isn't pushed on-chain very often. At best, it can be updated once per hour.
This can easily be changed in the future, but due to some current source limitations, resolution is limited to 1 hour.

It's possible that some price feeds won't be updated since the last time query, essentially remaining the same.
Such data is considered to be stale, and we should ignore it.

Only the price feeds which have been updated since the last time script queried can be considered valid input.

### Post-processing & Submission

To avoid problematic price feed outliers (bugs, malicious manipulations, etc.) script will consider the median of fetched values.

Once median is calculated, it will be submitted on-chain via a signed transaction.

## Running

First make sure to prepare the configuration file that will be used.

Install all of the required dependencies with `yarn install`.

Run the program with `SEED='...' yarn start -c <path-to-config-file>`.

(`SEED` can be omitted if user wants to run as `Alice`)

## Config

`config.json` contains various parameters used to configure the service.
The URL parameters are self explanatory - depending on whether communication with L1 node via https or wss is needed, different endpoints can be provided. For L2, only single endpoint is needed.

The `network` parameter specifies which network is being fed the price values. Only supported options are `Astar` and `Shiden` (case-insensitive). For `Shibuya`, user should still use `Astar` as the parameter.

The `updateCadenceHours` parameter specifies how often should new price feed be checked, and potentially updated.

The `nativeCurrencySymbol` is used to specify on-chain enum value of the native currency ticker, e.g. `ASTR` or `SDN`.

## Env

Unless in test environment, user should specify the seed phrase or the private key to derive the account which will submit price updates to the chain.

The variable is `SEED`.
