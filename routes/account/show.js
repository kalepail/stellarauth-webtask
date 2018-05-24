import { ManagementClient } from 'auth0';
import { setJwt } from '../../js/jwt';

export default function(req, res, next) {
  const secrets = req.webtaskContext.secrets;
  const management = new ManagementClient({
    domain: secrets.AUTH0_DOMAIN,
    clientId: secrets.AUTH0_CLIENT_ID,
    clientSecret: secrets.AUTH0_CLIENT_SECRET
  });

  management.clients.get({client_id: req.params.id})
  .then((client) => {
    const token = setJwt({
      iat: parseInt(client.client_metadata.iat),
      client_id: client.client_id,
      client_secret: client.client_secret
    }, secrets.CRYPTO_SECRET)

    res.json({
      client_id: client.client_id,
      token
    })
  })
  .catch((err) => next(err));
}
