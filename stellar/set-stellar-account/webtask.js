import Express from 'express';
import wt from 'webtask-tools';
import Stellar from 'stellar-base';
import { ManagementClient } from 'auth0';
import { encrypt } from '../../crypt';

const app = new Express();

app.post('/', (req, res) => {
  let stellar = req.user['https://colorglyph.io'] ? req.user['https://colorglyph.io'].stellar : null;

  if (stellar) {
    res.json({childKey: stellar.childKey});
    return;
  }

  const secrets = req.webtaskContext.secrets;
  const management = new ManagementClient({
    domain: secrets.AUTH0_DOMAIN,
    clientId: secrets.AUTH0_CLIENT_ID,
    clientSecret: secrets.AUTH0_CLIENT_SECRET
  });

  management.getUser({id: req.user.sub})
  .then((user) => user.app_metadata ? user.app_metadata.stellar : null)
  .then(async (stellar) => {
    if (stellar)
      return {childKey: stellar.childKey};

    const childAccount = Stellar.Keypair.random();
    const feeAccount = Stellar.Keypair.random();
    const {secret: childSecret, nonce: childNonce} = await encrypt(childAccount.secret(), secrets.CRYPTO_DATAKEY);
    const {secret: feeSecret, nonce: feeNonce} = await encrypt(feeAccount.secret(), secrets.CRYPTO_DATAKEY);

    stellar = {
      childSecret,
      childNonce,
      childKey: childAccount.publicKey(),
      feeSecret,
      feeNonce,
      feeKey: feeAccount.publicKey(),
    }

    return management.updateAppMetadata({id: req.user.sub}, {stellar})
    .then(() => ({childKey: stellar.childKey}));
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
