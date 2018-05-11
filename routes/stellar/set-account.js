import StellarSdk from 'stellar-sdk';
import { ManagementClient } from 'auth0';
import { encrypt } from '../../js/crypt';

export default function(req, res, next) {
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

    const childAccount = StellarSdk.Keypair.random();
    const {secret: childSecret, nonce: childNonce} = await encrypt(childAccount.secret(), secrets.CRYPTO_DATAKEY);

    stellar = {
      childSecret,
      childNonce,
      childKey: childAccount.publicKey()
    }

    return management.updateAppMetadata({id: req.user.sub}, {stellar})
    .then(() => ({childKey: stellar.childKey}));
  })
  .then((result) => res.json(result))
  .catch((err) => next(err));
}
