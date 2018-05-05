import Express from 'express';
import wt from 'webtask-tools';
import bodyParser from 'body-parser';
import axios from 'axios';
import { ManagementClient } from 'auth0';

const app = new Express();

app.use(bodyParser.json());

app.post('/', (req, res) => {
  let user = req.user;
  let authy = user['https://colorglyph.io'] ? user['https://colorglyph.io'].authy : null;

  if (authy)
    return res.json({authy});

  const secrets = req.webtaskContext.secrets;
  const management = new ManagementClient({
    domain: secrets.AUTH0_DOMAIN,
    clientId: secrets.AUTH0_CLIENT_ID,
    clientSecret: secrets.AUTH0_CLIENT_SECRET
  });

  management.getUser({id: user.sub})
  .then((user) => {
    user = user;
    return user.app_metadata ? user.app_metadata.authy : null;
  })
  .then((authy) => {
    if (authy)
      return {authy};

    return axios.get(`https://lookups.twilio.com/v1/PhoneNumbers/${req.body.phone.number}`, {
      auth: {
        username: secrets.TWILIO_ACCOUNT_SID,
        password: secrets.TWILIO_AUTH_TOKEN
      }
    })
    .then(({data}) => {
      if (data.country_code !== req.body.phone.code)
        throw {
          status: 400,
          message: `Requested country ${req.body.phone.code} but found ${data.country_code}`
        }

      return axios.post('https://api.authy.com/protected/json/users/new', {
        user: {
          email: req.body.email,
          cellphone: data.phone_number,
          country_code: req.body.phone.dial
        }
      }, {
        headers: {
          'X-Authy-API-Key': secrets.AUTHY_API_KEY
        }
      });
    })
    .then(({data: {user: {id}}}) => {
      authy = id;

      return management.updateAppMetadata({id: user.sub}, {authy})
      .then(() => ({authy}));
    });
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