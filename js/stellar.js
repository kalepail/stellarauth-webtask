import sjcl from 'sjcl-aws';
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

export function generateKeyPair(path, string) {
  const { StellarSdk } = getStellarServer(path);

  const hmac = new sjcl.misc.hmac(
    sjcl.codec.utf8String.toBits('ed25519 seed'),
    sjcl.hash.sha512
  )

  return StellarSdk.Keypair.fromRawEd25519Seed(
    sjcl.codec.arrayBuffer.fromBits(
      hmac.encrypt(string)
    )
  )
}
