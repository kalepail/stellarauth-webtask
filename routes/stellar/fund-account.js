import { ManagementClient } from 'auth0';
import { getStellarServer } from '../../js/stellar';
import _ from 'lodash';
import { decrypt } from '../../js/crypt';
import generateKeyPair from '../../js/sep5'
import { getJwt } from '../../js/jwt';

export default async function(req, res, next) {
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

  let childAccount;

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

    return server.loadAccount(childAccount.publicKey());
  })
  .then(() => server.loadAccount(masterFundAccount.publicKey()))
  .then((sourceAccount) => {
    const transaction = new StellarSdk.TransactionBuilder(sourceAccount)
    .addOperation(StellarSdk.Operation.payment({
      destination: childAccount.publicKey(),
      asset: StellarSdk.Asset.native(),
      amount: '10'
    }))
    .build();

    transaction.sign(masterFundAccount, ..._.sampleSize(masterSignerAccounts, 2));
    return server.submitTransaction(transaction);
  })
  .then((result) => res.json(result))
  .catch((err) => next(err));
}
