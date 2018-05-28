import { getJwt } from '../../js/jwt';
import { get,update } from '../../js/datastore';

const nonce = require('nonce')();

export default function(req, res, next) {
  if (!req.body.origins || !req.body.origins.length) throw {
    status: 400,
    message: 'Origin array missing or invalid'
  }

  const secrets = req.webtaskContext.secrets
  const tokenData = getJwt(req.headers['x-sa-token'], secrets.CRYPTO_SECRET);

  update('Developer', tokenData.id, {
    iat: tokenData.iat,
    origins: req.body.origins
  })
  .then(() => res.json({
    message: 'Developer origins updated'
  }))
  .catch((err) => next(err));
}
