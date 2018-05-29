import generateKeyPair from '../../js/sep5'
import { getJwt, setJwt } from '../../js/jwt';
import moment from 'moment'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'

export default async function(req, res, next) {
  const secrets = req.webtaskContext.secrets;
  const token = req.headers['authorization'].split(' ')[1];

  if (token && req.query.code) {
    try {
      const tokenData = getJwt(token, secrets.CRYPTO_SECRET);
      const verified = speakeasy.totp.verify({
        encoding: 'base32',
        secret: tokenData.sub,
        token: req.query.code
      });

      if (verified) {
        const authToken = setJwt({
          sub: tokenData.sub,
          iat: parseInt(moment().format('X')),
          exp: parseInt(moment().add(1, 'day').format('X'))
        }, secrets.CRYPTO_SECRET)
        const keyPair = generateKeyPair(req.url, `${tokenData.sub}@${secrets.CRYPTO_SECRET}`)
        const publicKey = keyPair.publicKey()

        res.json({
          authToken,
          publicKey
        })
      }

      else {
        next({
          status: 400,
          message: 'Invalid 2fa code'
        })
      }
    } catch(err) {
      next(err)
    }
  }

  else {
    const secret = speakeasy.generateSecret({ name: 'StellarAuth' });

    return QRCode.toDataURL(secret.otpauth_url)
    .then((qrCode) => ({
      userToken: setJwt({
        sub: secret.base32,
        iat: parseInt(moment().format('X'))
      }, secrets.CRYPTO_SECRET),
      qrCode
    }))
    .then((response) => res.json(response))
    .catch((err) => next(err));
  }
}
