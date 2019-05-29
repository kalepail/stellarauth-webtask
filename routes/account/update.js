import { ManagementClient } from 'auth0';
import { getJwt } from '../../js/jwt';

export default function(req, res, next) {
  const secrets = req.webtaskContext.secrets;
  const tokenData = getJwt(req.headers['x-sa-token'], secrets.CRYPTO_SECRET)
  const management = new ManagementClient({
    domain: secrets.AUTH0_DOMAIN,
    clientId: secrets.AUTH0_CLIENT_ID,
    clientSecret: secrets.AUTH0_CLIENT_SECRET
  });

  const data = {}

  if (req.body.name)
    data.name = req.body.name

  if (req.body.logo)
    data.logo_uri = req.body.logo

  if (req.body.origins) {
    data.callbacks = req.body.origins
    data.allowed_origins = req.body.origins
    data.web_origins = req.body.origins
    data.allowed_logout_urls = req.body.origins
  }

  management.updateClient({client_id: tokenData.client_id}, data)
  .then(({ client_id }) => res.send(200))
  .catch((err) => next(err));
}
