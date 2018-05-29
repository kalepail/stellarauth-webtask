import generateKeyPair from '../../js/sep5'
import { getStellarServer } from '../../js/stellar';
import axios from 'axios';
import { setJwt } from '../../js/jwt';
import moment from 'moment'

export default async function(req, res, next) {
  const secrets = req.webtaskContext.secrets;
  const seed = new Map();

  seed.set('id', req.query.id);
  seed.set('origin', req.query.origin);
  seed.set('secret', secrets.CRYPTO_SECRET);

  const keyPair = generateKeyPair(req, JSON.stringify([...seed]));
  const { server } = getStellarServer(req.url);
  const signature = await server
  .loadAccount(keyPair.publicKey())
  .then(() => setJwt({
    secret: keyPair.secret(),
    iat: parseInt(moment().format('X')),
    exp: parseInt(moment().endOf('hour').format('X'))
  }, secrets.CRYPTO_SECRET))
  .catch(() => null);

  axios.post(req.query.origin, {
    publicKey: keyPair.publicKey(),
    signature
  })
  .then((result) => res.sendStatus(200))
  .catch((err) => next(err));
}
