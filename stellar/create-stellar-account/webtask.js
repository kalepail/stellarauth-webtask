import Express from 'express';
import wt from 'webtask-tools';
import StellarSdk from 'stellar-sdk';
import { ManagementClient } from 'auth0';
import _ from 'lodash';
import { decrypt } from '../../crypt';

const app = new Express();

app.post(/^\/(test|public)$/, (req, res) => {
  let server;
  let stellar;
  let transaction;
  let childAccount;
  let feeAccount;

  if (req.url === '/public') {
    StellarSdk.Network.usePublicNetwork();
    server = new StellarSdk.Server('https://horizon.stellar.org');
  } else {
    StellarSdk.Network.useTestNetwork();
    server = new StellarSdk.Server('https://horizon-testnet.stellar.org');
  }

  const secrets = req.webtaskContext.secrets;
  const masterFundAccount = StellarSdk.Keypair.fromSecret(secrets.MASTER_FUND_SECRET);
  const masterSignerAccounts = _.map(secrets.MASTER_SIGNER_SECRETS.split(','), (secret) => StellarSdk.Keypair.fromSecret(secret));
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
          childAccount = StellarSdk.Keypair.fromSecret(childSecret);

    return server.loadAccount(childAccount.publicKey()); // Check if child account has already been created
  })
  .then(() => {
    throw { // If so throw that error
      status: 409,
      message: 'Account has already been created'
    }
  })
  .catch(StellarSdk.NotFoundError, () => server.loadAccount(masterFundAccount.publicKey())) // Otherwise load in the fund account
  .then((sourceAccount) => {
    transaction = new StellarSdk.TransactionBuilder(sourceAccount);


    // Setup the feeAccount
    const feeAccount = StellarSdk.Keypair.random();

    transaction = transaction.addOperation(StellarSdk.Operation.createAccount({
      destination: feeAccount.publicKey(),
      startingBalance: '2.1'
    }));

    transaction = transaction.addOperation(StellarSdk.Operation.setOptions({
      signer: {
        ed25519PublicKey: _.sample(masterSignerAccounts).publicKey(),
        weight: 1
      },
      source: feeAccount.publicKey()
    }));

    transaction = transaction.addOperation(StellarSdk.Operation.setOptions({
      inflationDest: masterFundAccount.publicKey(),
      setFlags: 3,
      masterWeight: 0,
      lowThreshold: 1,
      medThreshold: 2,
      highThreshold: 2,
      homeDomain: 'colorglyph.io',
      signer: {
        ed25519PublicKey: childAccount.publicKey(),
        weight: 1
      },
      source: feeAccount.publicKey()
    }));
    ////


    // Setup the childAccount
    transaction = transaction.addOperation(StellarSdk.Operation.createAccount({
      destination: childAccount.publicKey(),
      startingBalance: '2.1'
    }));

    transaction = transaction.addOperation(StellarSdk.Operation.manageData({
      name: 'feeKey',
      value: feeAccount.publicKey(),
      source: childAccount.publicKey()
    }));

    transaction = transaction.addOperation(StellarSdk.Operation.setOptions({
      inflationDest: masterFundAccount.publicKey(),
      setFlags: 3,
      masterWeight: 1,
      lowThreshold: 1,
      medThreshold: 1,
      highThreshold: 2,
      homeDomain: 'colorglyph.io',
      signer: {
        ed25519PublicKey: _.sample(masterSignerAccounts).publicKey(),
        weight: 1
      },
      source: childAccount.publicKey()
    }));
    ////


    transaction = transaction.build();

    transaction.sign(childAccount, feeAccount, masterFundAccount, ..._.sampleSize(masterSignerAccounts, 2));
    return server.submitTransaction(transaction);
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
