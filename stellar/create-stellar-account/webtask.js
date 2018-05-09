import Express from 'express';
import wt from 'webtask-tools';
import StellarSdk from 'stellar-sdk';
import { ManagementClient } from 'auth0';
import _ from 'lodash';
import { decrypt } from '../../crypt';

const app = new Express();

app.post(/^\/(test|public)$/, (req, res) => {
  let server;
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
  const childSignerPublicKeys = secrets.CHILD_SIGNER_PUBLIC_KEYS.split(',');
  const management = new ManagementClient({
    domain: secrets.AUTH0_DOMAIN,
    clientId: secrets.AUTH0_CLIENT_ID,
    clientSecret: secrets.AUTH0_CLIENT_SECRET
  });

  management.getUser({id: req.user.sub})
  .then((user) => user.app_metadata ? user.app_metadata.stellar : null)
  .then(async (stellar) => {
    if (!stellar)
      throw {
        status: 404,
        message: 'Auth0 user Stellar account could not be found'
      }

    const childSecret = await decrypt(stellar.childSecret, stellar.childNonce, secrets.CRYPTO_DATAKEY);
          childAccount = StellarSdk.Keypair.fromSecret(childSecret);
    const feeSecret = await decrypt(stellar.feeSecret, stellar.feeNonce, secrets.CRYPTO_DATAKEY);
          feeAccount = StellarSdk.Keypair.fromSecret(feeSecret);

    return server.loadAccount(childAccount.publicKey()); // Check if child account has already been created
  })
  .then(() => {
    throw { // If so throw that error
      status: 409,
      message: 'Account has already been created'
    }
  })
  .catch(StellarSdk.NotFoundError, () => server.loadAccount(feeAccount.publicKey())) // Check if fee account has already been created
  .then(() => {
    throw { // If so throw that error
      status: 409,
      message: 'Account has already been created'
    }
  })
  .catch(StellarSdk.NotFoundError, () => server.loadAccount(masterFundAccount.publicKey())) // Otherwise load in the fund account
  .then((sourceAccount) => {
    transaction = new StellarSdk.TransactionBuilder(sourceAccount);


    // Setup the childAccount
    transaction = transaction.addOperation(StellarSdk.Operation.createAccount({
      destination: childAccount.publicKey(),
      startingBalance: '5'
    }));

    _.each(childSignerPublicKeys, (publicKey, i) => {
      const options = {
        signer: {
          ed25519PublicKey: publicKey,
          weight: 2
        },
        source: childAccount.publicKey()
      }

      if (i === childSignerPublicKeys.length - 1)
        _.extend(options, {
          inflationDest: masterFundAccount.publicKey(),
          setFlags: 3,
          masterWeight: 1,
          lowThreshold: 1,
          medThreshold: 3,
          highThreshold: 5,
          homeDomain: 'colorglyph.io'
        });

      transaction = transaction.addOperation(StellarSdk.Operation.setOptions(options));
    });
    ////


    // Setup the feeAccount
    transaction = transaction.addOperation(StellarSdk.Operation.createAccount({
      destination: feeAccount.publicKey(),
      startingBalance: '5'
    }));

    _.each(childSignerPublicKeys, (publicKey, i) => {
      transaction = transaction.addOperation(StellarSdk.Operation.setOptions({
        signer: {
          ed25519PublicKey: publicKey,
          weight: 2
        },
        source: feeAccount.publicKey()
      }));
    });

    transaction = transaction.addOperation(StellarSdk.Operation.setOptions({
      inflationDest: masterFundAccount.publicKey(),
      setFlags: 3,
      masterWeight: 0,
      lowThreshold: 1,
      medThreshold: 3,
      highThreshold: 5,
      homeDomain: 'colorglyph.io',
      signer: {
        ed25519PublicKey: childAccount.publicKey(),
        weight: 1
      },
      source: feeAccount.publicKey()
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