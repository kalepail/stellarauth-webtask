import Express from 'express';
import wt from 'webtask-tools';
import bodyParser from 'body-parser';
import axios from 'axios';
import { ManagementClient } from 'auth0';

const app = new Express();

app.use(bodyParser.json());

app.post('/', async (req, res) => {
  const secrets = req.webtaskContext.secrets;
  let authy = req.user['https://colorglyph.io'] ? req.user['https://colorglyph.io'].authy : null;

  if (!authy) {
    const management = new ManagementClient({
      domain: secrets.AUTH0_DOMAIN,
      clientId: secrets.AUTH0_CLIENT_ID,
      clientSecret: secrets.AUTH0_CLIENT_SECRET
    });

    authy = await management.getUser({id: req.user.sub})
    .then((user) => user.app_metadata ? user.app_metadata.authy : null)
    .catch(() => false);
  }

  if (!authy) {
    res.status(404);
    res.json({error: {message: 'Auth0 user Authy account could not be found'}});
    return;
  }

  axios.get(`https://api.authy.com/protected/json/users/${authy.id}/status`, {
    headers: {'X-Authy-API-Key': secrets.AUTHY_API_KEY}
  })
  .then(({data: {status}}) => res.json(status))
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