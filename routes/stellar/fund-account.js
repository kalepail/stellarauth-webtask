import { ManagementClient } from 'auth0';
import getStellarServer from '../../js/stellar';
import _ from 'lodash';

export default async function(req, res, next) {
  let stellar = req.user['https://colorglyph.io'] ? req.user['https://colorglyph.io'].stellar : null;

  const {StellarSdk, server} = getStellarServer(req.url);
  const secrets = req.webtaskContext.secrets;
  const masterFundAccount = StellarSdk.Keypair.fromSecret(secrets.MASTER_FUND_SECRET);
  const masterSignerAccounts = _.map(secrets.MASTER_SIGNER_SECRETS.split(','), (secret) => StellarSdk.Keypair.fromSecret(secret));

  if (!stellar) {
    const management = new ManagementClient({
      domain: secrets.AUTH0_DOMAIN,
      clientId: secrets.AUTH0_CLIENT_ID,
      clientSecret: secrets.AUTH0_CLIENT_SECRET
    });

    stellar = await management.getUser({id: req.user.sub})
    .then((user) => user.app_metadata ? user.app_metadata.stellar : null)
    .catch(() => false);
  }

  if (!stellar) {
    res.status(404);
    res.json({error: {message: 'Auth0 user Stellar account could not be found'}});
    return;
  }

  server.loadAccount(stellar.childKey)
  .then(() => server.loadAccount(masterFundAccount.publicKey()))
  .then((sourceAccount) => {
    const transaction = new StellarSdk.TransactionBuilder(sourceAccount)
    .addOperation(StellarSdk.Operation.payment({
      destination: stellar.childKey,
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
