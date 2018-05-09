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
  let stellar;

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
    .then((user) => stellar = user.app_metadata ? user.app_metadata.stellar : null)
    .then(async () => {
      if (!stellar)
        throw {
          status: 404,
          message: 'Auth0 user Stellar account could not be found'
        }

      const childSecret = await decrypt(stellar.childSecret, stellar.childNonce, secrets.CRYPTO_DATAKEY);
      const childAccount = StellarSdk.Keypair.fromSecret(childSecret);
      const feeSecret = await decrypt(stellar.feeSecret, stellar.feeNonce, secrets.CRYPTO_DATAKEY);
      const feeAccount = StellarSdk.Keypair.fromSecret(feeSecret);

      const transaction = new StellarSdk.Transaction(req.body.xdr);

      transaction.sign(childAccount, feeAccount);
      return server.submitTransaction(transaction);
    });
  })
  .then((result) => {
    res.json(result); // Send response

    // Check this child's fee account balance
    server.loadAccount(stellar.feeKey)
    .then((result) => {
      const native = _.find(result.balances, {asset_type: 'native'});

      if (native.balance < 5) { // If it's below 5 refill with 1 XLM
        const masterFundAccount = StellarSdk.Keypair.fromSecret(secrets.MASTER_FUND_SECRET);
        const masterSignerAccounts = _.map(secrets.MASTER_SIGNER_SECRETS.split(','), (secret) => StellarSdk.Keypair.fromSecret(secret));

        return server.loadAccount(masterFundAccount.publicKey())
        .then((sourceAccount) => {
          const transaction = new StellarSdk.TransactionBuilder(sourceAccount)
          .addOperation(StellarSdk.Operation.payment({
            destination: stellar.feeKey,
            asset: StellarSdk.Asset.native(),
            amount: '1'
          }))
          .build();

          transaction.sign(masterFundAccount, ..._.sampleSize(masterSignerAccounts, 2));
          return server.submitTransaction(transaction);
        })
        .then((result) => console.log(result))
        .catch((err) => console.error(err));
      }
    });
  })
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