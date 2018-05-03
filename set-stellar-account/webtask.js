import Express from 'express';
import wt from 'webtask-tools';
import Stellar from 'stellar-base';
import { ManagementClient } from 'auth0';
import { encrypt } from '../crypt';

const app = new Express();

app.post('/', async function (req, res) {
  const secrets = req.webtaskContext.secrets;

  let user = req.user;
  let stellar = user['https://colorglyph.io'] ? user['https://colorglyph.io'].stellar : null;

  if (stellar) {
    res.json({publicKey: stellar.publicKey});
    return;
  }

  const management = new ManagementClient({
    domain: secrets.AUTH0_DOMAIN,
    clientId: secrets.AUTH0_CLIENT_ID,
    clientSecret: secrets.AUTH0_CLIENT_SECRET
  });

  stellar = await management.getUser({id: user.sub})
  .then((user) => {
    user = user;
    return user.app_metadata ? user.app_metadata.stellar : null;
  })
  .catch((err) => {
    console.error(err);
    res.status(err.status || 500);
    res.json({error: {message: err.message}});
  });

  if (stellar) {
    res.json({publicKey: stellar.publicKey});
    return;
  }

  const keypair = Stellar.Keypair.random();

  stellar = {
    ...await encrypt(keypair.secret(), secrets.CRYPTO_DATAKEY),
    publicKey: keypair.publicKey(),
  }

  management.updateAppMetadata({id: user.sub}, {
    ...user.app_metadata,
    stellar
  })
  .then((result) => {
    res.json({publicKey: stellar.publicKey});
  })
  .catch((err) => {
    console.error(err);
    res.status(err.status || 500);
    res.json({error: {message: err.message}});
  });
});

module.exports = wt.fromExpress(app).auth0();