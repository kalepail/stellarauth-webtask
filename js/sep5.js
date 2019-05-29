import sjcl from 'sjcl-aws';
import { getStellarServer } from './stellar';

export default function(req, seed, pathIndex) {
  const { StellarSdk } = getStellarServer(req.url);

  const seedToMasterNode = function (seed) {
    const hmac = new sjcl.misc.hmac(
      sjcl.codec.utf8String.toBits('ed25519 seed'),
      sjcl.hash.sha512
    )
    const I = hmac.encrypt(seed)
    const IL = I.slice(0,8)
    const IR = I.slice(8)

    return { IL, IR }
  }

  const derivePath = function(initIL, initIR, path) {
    let index
    let I
    let IL = initIL
    let IR = initIR
    let pathIndex

    for(pathIndex = 0; pathIndex < path.length; pathIndex++) {
      const hmac = new sjcl.misc.hmac(IR, sjcl.hash.sha512)

      index = path[pathIndex] + 0x80000000
      I = hmac.encrypt(
        sjcl.bitArray.concat(
          sjcl.bitArray.concat(
            sjcl.codec.hex.toBits('0x00'),
            IL
          ),
          sjcl.codec.hex.toBits(
            index.toString(16)
          )
        )
      )
      IL = I.slice(0,8);
      IR = I.slice(8);
    }

    return { IL, IR }
  }

  const hdAccountFromSeed = function(seed, pathIndex) {
    let masterNode = seedToMasterNode(
      sjcl.codec.hex.toBits(seed)
    );
    let derivedPath = derivePath(
      masterNode.IL,
      masterNode.IR,
      [44, 148, pathIndex]
    )

    return StellarSdk.Keypair.fromRawEd25519Seed(
      sjcl.codec.arrayBuffer.fromBits(derivedPath.IL)
    )
  }

  return hdAccountFromSeed(seed, pathIndex)
}
