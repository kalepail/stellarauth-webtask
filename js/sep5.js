import sjcl from 'sjcl-aws';
import { getStellarServer } from './stellar';

export function generateKeyPair(path, seed) {
  const { StellarSdk } = getStellarServer(path);
s
  const hmac = new sjcl.misc.hmac(
    sjcl.codec.utf8String.toBits('ed25519 seed'),
    sjcl.hash.sha512
  )

  return StellarSdk.Keypair.fromRawEd25519Seed(
    sjcl.codec.arrayBuffer.fromBits(
      hmac.encrypt(seed)
    )
  )
}

export function generateKey(seed) {
  const hmac = new sjcl.misc.hmac(
    sjcl.codec.utf8String.toBits(),
    sjcl.hash.sha512
  )

  return sjcl.codec.base32.fromBits(
    hmac.encrypt(seed)
  ).toUpperCase()
}
