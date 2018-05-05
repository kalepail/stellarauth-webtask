import Express from 'express';
import wt from 'webtask-tools';
import bodyParser from 'body-parser';
import axios from 'axios';

const app = new Express();

app.use(bodyParser.json());

app.post('/', (req, res) => {
  const secrets = req.webtaskContext.secrets;

  axios.get(`https://lookups.twilio.com/v1/PhoneNumbers/${req.body.number}`, {
    auth: {
      username: secrets.TWILIO_ACCOUNT_SID,
      password: secrets.TWILIO_AUTH_TOKEN
    }
  })
  .then(({data}) => res.json(data))
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