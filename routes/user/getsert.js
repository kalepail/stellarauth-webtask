import { setJwt, getJwt } from '../../js/jwt';
import { insert, get } from '../../js/datastore';
import crypto from 'crypto'
import generateKeyPair from '../../js/sep5'
import { encode } from 'base64-arraybuffer'
import { decrypt, encrypt } from '../../js/crypt';
import { getStellarServer } from '../../js/stellar';

const nonce = require('nonce')();

export default function(req, res, next) {
  const secrets = req.webtaskContext.secrets;
  const tokenData = req.body.token ? getJwt(req.body.token, secrets.CRYPTO_DATAKEY) : null;
  const id = tokenData ? tokenData.id : req.body.id;
  const { StellarSdk, server } = getStellarServer(req.url);

  if (!id) throw {
    status: 400,
    message: 'Id missing or invalid'
  }

  get('User', id)
  .then(async (user) => await decrypt(
    user.secret,
    user.nonce,
    secrets.CRYPTO_DATAKEY
  ))
  .catch(async () => {
    const seed = encode(crypto.randomBytes(256))
    const seedData = await encrypt(seed, secrets.CRYPTO_DATAKEY)

    return insert('User', req.body.id, seedData)
    .then(() => seed)
  })
  .then(async (seed) => {
    const index = tokenData ? tokenData.index : nonce();
    const keyPair = generateKeyPair(req, seed, index);
    const created = await server
    .loadAccount(keyPair.publicKey())
    .then(() => true)
    .catch(() => false);

    return req.body.token ? {
      childKey: keyPair.publicKey(),
      created
    } : {
      token: setJwt({ id, index }, secrets.CRYPTO_DATAKEY)
    }
  })
  .then((result) => res.json(result))
  .catch((err) => next(err));
}

// A eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Im1pa2UiLCJpbmRleCI6MTUyNzU0MDYyNDgzMzAwLCJpYXQiOjE1Mjc1NDA2MjV9.dn8OXcNR0JGeeHIEvGXVtWXNc_R2Hl-xqAh3_NaNwcU
// B eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Im1pa2UiLCJpbmRleCI6MTUyNzU0MDA2ODc5MjAwLCJpYXQiOjE1Mjc1NDAwNjh9.PL_LaGFzuDwlFLKyXxvRMrX-5GHweR5XpumI_VT9DRw
