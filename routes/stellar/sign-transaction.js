import { ManagementClient } from 'auth0';
import { decrypt } from '../../js/crypt';
import axios from 'axios';
import { getStellarServer, refillFeeAccount } from '../../js/stellar';
import { getJwt } from '../../js/jwt';
import generateKeyPair from '../../js/sep5'

let StellarSdk;

export default function(req, res, next) {
  let childAccount;

  const {StellarSdk, server} = getStellarServer(req.url);
  const secrets = req.webtaskContext.secrets;

  axios.defaults.baseURL = secrets.WT_DOMAIN;

  axios.post('authy/verify-code', {
    code: req.body.code
  }, {headers: {
    authorization: req.headers.authorization,
    'x-sa-token': req.headers['x-sa-token']
  }})
  .then(() => {
    const tokenData = getJwt(req.headers['x-sa-token'], secrets.CRYPTO_SECRET)
    const management = new ManagementClient({
      domain: secrets.AUTH0_DOMAIN,
      clientId: tokenData.client_id,
      clientSecret: tokenData.client_secret
    });

    return management.getUser({id: req.user.sub})
    .then((user) => user.app_metadata ? user.app_metadata.stellar : null)
    .then(async (stellar) => {
      if (!stellar) throw {
        status: 404,
        message: 'Auth0 user Stellar account could not be found'
      }

      const seed = await decrypt(
        stellar.secret,
        stellar.nonce,
        secrets.CRYPTO_DATAKEY
      );
      childAccount = generateKeyPair(req, seed, tokenData.iat);

      const transaction = new StellarSdk.Transaction(req.body.xdr);

      transaction.sign(childAccount);
      return server.submitTransaction(transaction);
    });
  })
  .then((result) => res.json(result)) // Send response
  .then(() => refillFeeAccount({
    StellarSdk,
    server,
    secrets,
    childAccount
  }))
  .catch((err) => next(err));
}
