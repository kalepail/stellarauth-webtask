import StellarSdk from 'stellar-sdk';
import bodyParser from 'body-parser';
import { ManagementClient } from 'auth0';
import { decrypt } from '../../js/crypt';
import { decode } from 'base64-arraybuffer';
import ab2str from 'arraybuffer-to-string';
import _ from 'lodash';
import axios from 'axios';

export default function(req, res, next) {
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
  .then((result) => {
    res.json(result); // Send response

    let feeKey;

    // Check this child's fee account balance
    // TODO: Move this out into its own refill Webtask
    server.loadAccount(stellar.childKey)
    .then((sourceAccount) => {
      feeKey = ab2str(decode(sourceAccount.data_attr.feeKey));
      return server.loadAccount(feeKey);
    })
    .then((sourceAccount) => {
      const native = _.find(sourceAccount.balances, {asset_type: 'native'});

      if (native.balance < 2.1) { // If it's below threshold refill with 0.1 XLM
        const masterFundAccount = StellarSdk.Keypair.fromSecret(secrets.MASTER_FUND_SECRET);
        const masterSignerAccounts = _.map(secrets.MASTER_SIGNER_SECRETS.split(','), (secret) => StellarSdk.Keypair.fromSecret(secret));

        server.loadAccount(masterFundAccount.publicKey())
        .then((sourceAccount) => {
          const transaction = new StellarSdk.TransactionBuilder(sourceAccount)
          .addOperation(StellarSdk.Operation.payment({
            destination: feeKey,
            asset: StellarSdk.Asset.native(),
            amount: '0.1'
          }))
          .build();

          transaction.sign(
            masterFundAccount,
            ..._.sampleSize(masterSignerAccounts, 2)
          );
          return server.submitTransaction(transaction);
        })
        .then((result) => console.log(result))
        .catch((err) => console.error(err));
      }
    });
  })
  .catch((err) => next(err));
}
