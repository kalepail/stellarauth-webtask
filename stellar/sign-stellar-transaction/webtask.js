import Express from 'express';
import wt from 'webtask-tools';
import StellarSdk from 'stellar-sdk';
import bodyParser from 'body-parser';
import { ManagementClient } from 'auth0';
import { decrypt } from '../../crypt';
import _ from 'lodash';
import axios from 'axios';

const app = new Express();

app.use(bodyParser.json());

app.post(/^\/(test|public)$/, (req, res) => {
  let server;

  if (req.url === '/public') {
    StellarSdk.Network.usePublicNetwork();
    server = new StellarSdk.Server('https://horizon.stellar.org');
  } else {
    StellarSdk.Network.useTestNetwork();
    server = new StellarSdk.Server('https://horizon-testnet.stellar.org');
  }

  const secrets = req.webtaskContext.secrets;

  axios.defaults.baseURL = secrets.WT_DOMAIN;

  axios.post('verify-authy-code', {
    code: req.body.code
  }, {headers: {authorization: req.headers.authorization}})
  .then(() => {
    const management = new ManagementClient({
      domain: secrets.AUTH0_DOMAIN,
      clientId: secrets.AUTH0_CLIENT_ID,
      clientSecret: secrets.AUTH0_CLIENT_SECRET
    });

    return management.getUser({id: req.user.sub})
    .then((user) => user.app_metadata)
    .then(async ({stellar}) => {
      if (!stellar)
        throw {
          status: 404,
          message: 'Auth0 user Stellar account could not be found'
        }

      const secret = await decrypt(stellar, secrets.CRYPTO_DATAKEY);
      const sourceKeys = StellarSdk.Keypair.fromSecret(secret);
      const masterFeeAccount = StellarSdk.Keypair.fromSecret(secrets.MASTER_FEE_SECRET);
      const childSignerAccounts = _.map(secrets.CHILD_SIGNER_SECRETS.split(','), (secret) => StellarSdk.Keypair.fromSecret(secret));
      const transaction = new StellarSdk.Transaction(req.body.xdr);

      transaction.sign(sourceKeys, masterFeeAccount, ..._.sampleSize(childSignerAccounts, 1));
      return server.submitTransaction(transaction);
    });
  })
  .then((result) => res.json(result))
  .catch((err) => {
    if (err.response)
      err = err.response;

    if (err.data)
      err = err.data;

    console.error(err);
    res.status(err.status || 500);
    res.json(err);
  });
});

module.exports = wt.fromExpress(app).auth0();