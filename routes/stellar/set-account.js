import crypto from 'crypto'
import generateKeyPair from '../../js/sep5'
import { encode } from 'base64-arraybuffer'
import { decrypt, encrypt } from '../../js/crypt';
import { ManagementClient } from 'auth0';
import { getJwt } from '../../js/jwt';

export default async function(req, res, next) {
  const secrets = req.webtaskContext.secrets;
  const tokenData = getJwt(req.headers['x-sa-token'], secrets.CRYPTO_SECRET)
  const management = new ManagementClient({
    domain: secrets.AUTH0_DOMAIN,
    clientId: tokenData.client_id,
    clientSecret: tokenData.client_secret
  });

  management.getUser({id: req.user.sub})
  .then((user) => user.app_metadata ? user.app_metadata.stellar : null)
  .then(async (stellar) => {
    if (stellar) return await decrypt(
      stellar.secret,
      stellar.nonce,
      secrets.CRYPTO_DATAKEY
    );

    const seed = encode(crypto.randomBytes(256))

    stellar = await encrypt(seed, secrets.CRYPTO_DATAKEY)

    return management.updateAppMetadata({id: req.user.sub}, {stellar})
    .then(() => seed);
  })
  .then(async (seed) => {
    const keyPair = generateKeyPair(req, seed, tokenData.iat);
    return {childKey: keyPair.publicKey()};
  })
  .then((result) => res.json(result))
  .catch((err) => next(err));
}
