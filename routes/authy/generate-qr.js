import axios from 'axios';
import { ManagementClient } from 'auth0';

export default function(req, res, next) {
  const secrets = req.webtaskContext.secrets;
  const management = new ManagementClient({
    domain: secrets.AUTH0_DOMAIN,
    clientId: secrets.AUTH0_CLIENT_ID,
    clientSecret: secrets.AUTH0_CLIENT_SECRET
  });

  management.getUser({id: req.user.sub})
  .then((user) => user.app_metadata ? user.app_metadata.authy : null)
  .then((authy) => {
    if (!authy) throw {
      status: 404,
      error: {message: 'Auth0 user Authy account could not be found'}
    }

    if (!authy.verified) throw {
      status: 400,
      error: {message: 'Authy account has not been verified'}
    }

    return axios.post(`https://api.authy.com/protected/json/users/${authy.id}/secret`, {
      label: 'Colorglyph',
      qr_size: 320
    }, {
      headers: {'X-Authy-API-Key': secrets.AUTHY_API_KEY}
    });
  })
  .then(({data}) => res.json(data))
  .catch((err) => next(err));
}
