import axios from 'axios';

export default function(req, res, next) {
  const secrets = req.webtaskContext.secrets;

  axios.get(`https://lookups.twilio.com/v1/PhoneNumbers/${req.body.number}`, {
    auth: {
      username: secrets.TWILIO_ACCOUNT_SID,
      password: secrets.TWILIO_AUTH_TOKEN
    }
  })
  .then(({data}) => res.json(data))
  .catch((err) => next(err));
}
