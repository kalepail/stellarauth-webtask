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

  axios.defaults.baseURL = secrets.WT_DOMAIN;

  management.getUser({id: req.user.sub})
  .then((user) => user.app_metadata ? user.app_metadata.authy : null)
  .then((authy) => {
    if (authy)
      return {authy};

    return axios.post(
      'utils/lookup',
      {number: req.body.phone.number},
      {headers: {
        authorization: req.headers.authorization,
        'x-sa-token': req.headers['x-sa-token']
      }}
    ).then(({data}) => {
      if (data.country_code !== req.body.phone.code) throw {
        status: 400,
        message: `Requested country ${req.body.phone.code} but found ${data.country_code}`
      }

      return axios.post('https://api.authy.com/protected/json/users/new', {
        user: {
          email: req.body.email,
          cellphone: data.phone_number,
          country_code: req.body.phone.dial
        }
      }, {headers: {
        'X-Authy-API-Key': secrets.AUTHY_API_KEY
      }});
    })
    .then(({data: {user: {id}}}) => {
      authy = {id};

      return management.getUsers({
        include_totals: true,
        search_engine: 'v3',
        q: `app_metadata.authy.id:${id}`,
        fields: 'user_id'
      });
    })
    .then((response) => {
      if (response.total)
        throw {
          status: 400,
          message: `Authy user with this id already exists`
        }

      return management.updateAppMetadata({id: req.user.sub}, {authy})
      .then(() => authy);
    })
  })
  .then((result) => res.json(result))
  .catch((err) => next(err));
}
