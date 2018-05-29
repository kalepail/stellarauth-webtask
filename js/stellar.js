import _ from 'lodash';
import StellarSdk from 'stellar-sdk';

export function getStellarServer(path) {
  let server;

  path = _.last(path.split('?')[0].split('/'));

  if (path === 'public') {
    StellarSdk.Network.usePublicNetwork();
    server = new StellarSdk.Server('https://horizon.stellar.org');
  } else {
    StellarSdk.Network.useTestNetwork();
    server = new StellarSdk.Server('https://horizon-testnet.stellar.org');
  }

  return {StellarSdk, server}
}
