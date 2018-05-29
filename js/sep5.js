import sjcl from 'sjcl-aws';
import { getStellarServer } from './stellar';

export default function(req, seed) {
  const { StellarSdk } = getStellarServer(req.url);

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
