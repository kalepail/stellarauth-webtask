import Express from 'express';
import wt from 'webtask-tools';
import StellarSdk from 'stellar-sdk';
import bodyParser from 'body-parser';
import { ManagementClient } from 'auth0';
import { decrypt } from '../crypt';
import _ from 'lodash';

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

  const user = req.user;
  const secrets = req.webtaskContext.secrets;
  const transaction = new StellarSdk.Transaction(req.body.xdr);
  const management = new ManagementClient({
    domain: secrets.AUTH0_DOMAIN,
    clientId: secrets.AUTH0_CLIENT_ID,
    clientSecret: secrets.AUTH0_CLIENT_SECRET
  });

  management.getUser({id: user.sub})
  .then((user) => user.app_metadata ? user.app_metadata.stellar : null)
  .then(async (stellar) => {
    if (!stellar)
      throw {
        status: 404,
        message: 'Auth0 user Stellar account could not be found'
      }

    const secret = await decrypt(stellar, secrets.CRYPTO_DATAKEY);
    const sourceKeys = StellarSdk.Keypair.fromSecret(secret);
    const masterFeeAccount = StellarSdk.Keypair.fromSecret(secrets.MASTER_FEE_SECRET);
    const childSignerAccounts = _.map(secrets.CHILD_SIGNER_SECRETS.split(','), (secret) => StellarSdk.Keypair.fromSecret(secret));

    transaction.sign(sourceKeys, masterFeeAccount, ..._.sampleSize(childSignerAccounts, 1));
    return server.submitTransaction(transaction);
  })
  .then((result) => res.json(result))
  .catch((err) => {
    console.error(err);
    res.status(err.status || 500);
    res.json({error: {message: err.message}});
  });
});

module.exports = wt.fromExpress(app).auth0();