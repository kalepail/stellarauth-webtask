import { setJwt } from '../../js/jwt'
import { get } from '../../js/datastore'
import moment from 'moment'
import axios from 'axios'

export default function(req, res, next) {
  const secrets = req.webtaskContext.secrets
  const id = req.query.id

  get('Developer', id)
  .then((user) => {
    if (user.origins.indexOf(req.query.forward) === -1) throw {
      status: 404,
      message: 'Forward address not a valid origin'
    }

    const token = setJwt({
      id,
      iat: user.iat,
      exp: parseInt(moment().endOf('hour').format('X'))
    }, secrets.CRYPTO_SECRET);

    return axios.post(req.query.forward, { token })
    .then(() => res.sendStatus(200))
    .catch(() => res.sendStatus(404))
  })
  .catch((err) => next(err))
}
