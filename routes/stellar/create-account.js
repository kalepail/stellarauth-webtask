import { ManagementClient } from 'auth0';
import _ from 'lodash';
import { getStellarServer } from '../../js/stellar';
import { decrypt } from '../../js/crypt';
import generateKeyPair from '../../js/sep5'
import { getJwt } from '../../js/jwt';

export default function(req, res, next) {
  let transaction;
  let childAccount;
  let feeAccount;

  const { StellarSdk, server } = getStellarServer(req.url);
  const secrets = req.webtaskContext.secrets;
  const masterFundAccount = StellarSdk.Keypair.fromSecret(secrets.MASTER_FUND_SECRET);
  const masterSignerAccounts = _.map(secrets.MASTER_SIGNER_SECRETS.split(','), (secret) => StellarSdk.Keypair.fromSecret(secret));
  const tokenData = getJwt(req.headers['x-sa-token'], secrets.CRYPTO_SECRET)
  const management = new ManagementClient({
    domain: secrets.AUTH0_DOMAIN,
    clientId: tokenData.client_id,
    clientSecret: tokenData.client_secret
  });

  management.getUser({id: req.user.sub})
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

    return server.loadAccount(childAccount.publicKey()); // Check if child account has already been created
  })
  .then(() => { // If so throw that error
    throw {
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
      homeDomain: 'stellarauth.com',
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
      homeDomain: 'stellarauth.com',
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
  .catch((err) => next(err));
}
