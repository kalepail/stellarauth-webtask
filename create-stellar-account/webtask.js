import Express from 'express';
import wt from 'webtask-tools';
import StellarSdk from 'stellar-sdk';
import { ManagementClient } from 'auth0';

const app = new Express();

app.post(/^\/(test|public)$/, async (req, res) => {
  let server;
  let stellar = req.user['https://colorglyph.io'] ? req.user['https://colorglyph.io'].stellar : null;

  const secrets = req.webtaskContext.secrets;
  const sourceKeys = StellarSdk.Keypair.fromSecret(secrets.STELLAR_SECRET);

  if (req.url === '/public') {
    StellarSdk.Network.usePublicNetwork();
    server = new StellarSdk.Server('https://horizon.stellar.org');
  } else {
    StellarSdk.Network.useTestNetwork();
    server = new StellarSdk.Server('https://horizon-testnet.stellar.org');
  }

  if (!stellar) {
    const management = new ManagementClient({
      domain: secrets.AUTH0_DOMAIN,
      clientId: secrets.AUTH0_CLIENT_ID,
      clientSecret: secrets.AUTH0_CLIENT_SECRET
    });

    stellar = await management.getUser({id: req.user.sub})
    .then((user) => user.app_metadata ? user.app_metadata.stellar : null)
    .catch((err) => {
      res.status(err.status || 500);
      res.json({error: {message: err.message}});
    });
  }

  if (!stellar) {
    res.status(404);
    res.json({error: {message: 'Auth0 user Stellar account could not be found'}});
    return;
  }

  server.loadAccount(stellar.publicKey)
  .catch(StellarSdk.NotFoundError, (err) => server.loadAccount(sourceKeys.publicKey()))
  .then((sourceAccount) => {
    const transaction = new StellarSdk.TransactionBuilder(sourceAccount)
    .addOperation(StellarSdk.Operation.createAccount({
      destination: stellar.publicKey,
      startingBalance: '10'
    }))
    .build();

    transaction.sign(sourceKeys);
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