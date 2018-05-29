import { getJwt } from '../../js/jwt';

export default function(req, res, next) {
  const secrets = req.webtaskContext.secrets;

  res.json(
    getJwt(
      req.headers['authorization'].replace('Bearer ', ''),
      secrets.CRYPTO_SECRET
    )
  )
}
