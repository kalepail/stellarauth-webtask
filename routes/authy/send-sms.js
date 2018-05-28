import axios from 'axios';
import { ManagementClient } from 'auth0';
import { getJwt } from '../../js/jwt';

export default function(req, res, next) {
  const secrets = req.webtaskContext.secrets;
  const tokenData = getJwt(req.headers['x-sa-token'], secrets.CRYPTO_SECRET)
  const management = new ManagementClient({
    domain: secrets.AUTH0_DOMAIN,
    clientId: tokenData.client_id,
    clientSecret: tokenData.client_secret
  });

  management.getUser({id: req.user.sub})
  .then((user) => user.app_metadata ? user.app_metadata.authy : null)
  .then((authy) => {
    if (!authy) throw {
      status: 404,
      message: 'Auth0 user Authy account could not be found'
    }

    return axios.get(`https://api.authy.com/protected/json/sms/${authy.id}`, {
      params: {
        force: true
      },
      headers: {'X-Authy-API-Key': secrets.AUTHY_API_KEY}
    });
  })
  .then(({data}) => res.json(data))
  .catch((err) => next(err));
}
