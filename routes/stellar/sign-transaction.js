import { ManagementClient } from 'auth0';
import { decrypt } from '../../js/crypt';
import axios from 'axios';
import { getStellarServer, refillFeeAccount } from '../../js/stellar';

let StellarSdk;

export default function(req, res, next) {
  let stellar;

  const {StellarSdk, server} = getStellarServer(req.url);
  const secrets = req.webtaskContext.secrets;

  axios.defaults.baseURL = secrets.WT_DOMAIN;

  axios.post('authy/verify-code', {
    code: req.body.code
  }, {headers: {authorization: req.headers.authorization}})
  .then(() => {
    const management = new ManagementClient({
      domain: secrets.AUTH0_DOMAIN,
      clientId: secrets.AUTH0_CLIENT_ID,
      clientSecret: secrets.AUTH0_CLIENT_SECRET
    });

    return management.getUser({id: req.user.sub})
    .then((user) => stellar = user.app_metadata ? user.app_metadata.stellar : null)
    .then(async () => {
      if (!stellar)
        throw {
          status: 404,
          message: 'Auth0 user Stellar account could not be found'
        }

      const childSecret = await decrypt(stellar.childSecret, stellar.childNonce, secrets.CRYPTO_DATAKEY);
      const childAccount = StellarSdk.Keypair.fromSecret(childSecret);

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
    stellar
  }))
  .catch((err) => next(err));
}
