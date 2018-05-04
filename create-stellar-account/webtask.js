import Express from 'express';
import wt from 'webtask-tools';
import StellarSdk from 'stellar-sdk';
import { ManagementClient } from 'auth0';
import _ from 'lodash';
import { decrypt } from '../crypt';

const app = new Express();

app.post(/^\/(test|public)$/, async (req, res) => {
  let server;
  let transaction;
  let stellarAccount;

  if (req.url === '/public') {
    StellarSdk.Network.usePublicNetwork();
    server = new StellarSdk.Server('https://horizon.stellar.org');
  } else {
    StellarSdk.Network.useTestNetwork();
    server = new StellarSdk.Server('https://horizon-testnet.stellar.org');
  }

  const secrets = req.webtaskContext.secrets;
  const masterFundPublic = secrets.MASTER_FUND_PUBLIC;
  const masterFeeAccount = StellarSdk.Keypair.fromSecret(secrets.MASTER_FEE_SECRET);
  const masterSignerAccounts = _.map(secrets.MASTER_SIGNER_SECRETS.split(','), (secret) => StellarSdk.Keypair.fromSecret(secret));
  const childSignerPublicKeys = secrets.CHILD_SIGNER_PUBLIC_KEYS.split(',');
  const management = new ManagementClient({
    domain: secrets.AUTH0_DOMAIN,
    clientId: secrets.AUTH0_CLIENT_ID,
    clientSecret: secrets.AUTH0_CLIENT_SECRET
  });

  const stellar = await management.getUser({id: req.user.sub})
  .then((user) => user.app_metadata ? user.app_metadata.stellar : null)
  .then(async (stellar) => {
    if (!stellar)
      throw {
        status: 404,
        message: 'Auth0 user Stellar account could not be found'
      }

    const secret = await decrypt(stellar, secrets.CRYPTO_DATAKEY);
    stellarAccount = StellarSdk.Keypair.fromSecret(secret);

    return server.loadAccount(stellarAccount.publicKey()); // Check if account has already been created
  })
  .then(() => {
    throw { // If so throw that error
      status: 409,
      message: 'Account has already been created'
    }
  })
  .catch(StellarSdk.NotFoundError, () => server.loadAccount(masterFeeAccount.publicKey())) // Otherwise load in the fund account
  .then((sourceAccount) => {
    transaction = new StellarSdk.TransactionBuilder(sourceAccount);

    transaction = transaction.addOperation(StellarSdk.Operation.createAccount({
      destination: stellarAccount.publicKey(),
      startingBalance: '10'
    }));

    _.each(childSignerPublicKeys, (publicKey, i) => {
      const options = {
        signer: {
          ed25519PublicKey: publicKey,
          weight: 2
        },
        source: stellarAccount.publicKey()
      }

      if (i === childSignerPublicKeys.length - 1)
        _.extend(options, {
          inflationDest: masterFundPublic,
          setFlags: 3,
          masterWeight: 1,
          lowThreshold: 1,
          medThreshold: 3,
          highThreshold: 5,
          homeDomain: 'colorglyph.io',
          source: stellarAccount.publicKey()
        });

      transaction = transaction.addOperation(StellarSdk.Operation.setOptions(options));
    });

    transaction = transaction.build();

    transaction.sign(stellarAccount, masterFeeAccount, ..._.sampleSize(masterSignerAccounts, 2));
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