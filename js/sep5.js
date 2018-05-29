import sjcl from 'sjcl-aws';
import { getStellarServer } from './stellar';

export default function(path, seed) {
  const { StellarSdk } = getStellarServer(path);

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
