import { setJwt } from '../../js/jwt';
import { insert } from '../../js/datastore';
import crypto from 'crypto';
import moment from 'moment';

const nonce = require('nonce')();

export default function(req, res, next) {
  if (!req.body.origins || !req.body.origins.length) throw {
    status: 400,
    message: 'Origin array missing or invalid'
  }

  const secrets = req.webtaskContext.secrets
  const id = crypto.randomBytes(16).toString('hex')
  const iat = nonce()
  const token = setJwt({
    id,
    iat,
    exp: parseInt(moment().endOf('hour').format('X'))
  }, secrets.CRYPTO_SECRET);

  insert('Developer', id, {
    iat,
    origins: req.body.origins
  })
  .then(() => res.json({ id }))
  .catch((err) => next(err));
}
