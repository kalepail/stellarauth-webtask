import { ManagementClient } from 'auth0';
import { setJwt } from '../../js/jwt';

const nonce = require('nonce')();

export default function(req, res, next) {
  const iat = nonce();
  const secrets = req.webtaskContext.secrets;
  const management = new ManagementClient({
    domain: secrets.AUTH0_DOMAIN,
    clientId: secrets.AUTH0_CLIENT_ID,
    clientSecret: secrets.AUTH0_CLIENT_SECRET
  });

  let token;

  management.clients.create({
    name: req.body.name,
    logo_uri: req.body.logo,
    callbacks: req.body.origins,
    allowed_origins: req.body.origins,
    web_origins: req.body.origins,
    allowed_logout_urls: req.body.origins,
    token_endpoint_auth_method: 'client_secret_post',
    app_type: 'non_interactive',
    oidc_conformant: false,
    jwt_configuration: {
      lifetime_in_seconds: 3600,
      alg: 'HS256'
    },
    client_metadata: {
      iat: iat.toString()
    },
    custom_login_page_on: false,
    sso: true
  })
  .then((client) => {
    token = setJwt({
      iat,
      client_id: client.client_id,
      client_secret: client.client_secret
    }, secrets.CRYPTO_SECRET)

    return management.clientGrants.create({
      client_id: client.client_id,
      audience: `https://${secrets.AUTH0_DOMAIN}/api/v2/`,
      scope: [
        'read:users',
        'update:users',
        'read:users_app_metadata',
        'update:users_app_metadata',
        'delete:users_app_metadata',
        'create:users_app_metadata'
      ]
    })
  })
  .then(({ client_id }) => res.json({ client_id, token }))
  .catch((err) => next(err));
}
