import moment from 'moment'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import { generateKeyPair, encode32 } from '../../js/stellar'
import { getJwt, setJwt } from '../../js/jwt';
import { encrypt, decrypt } from '../../js/crypto'

export default async function(req, res, next) {
  const secrets = req.webtaskContext.secrets
  const secret = encrypt(req.query.id)

  if (req.query.code) {
    try {
      const verified = speakeasy.totp.verify({
        secret,
        token: req.query.code,
        encoding: 'base32'
      });

      if (verified) {
        const authToken = setJwt({
          sub: secret,
          iat: parseInt(moment().format('X')),
          exp: parseInt(moment().add(1, 'day').format('X'))
        }, secrets.CRYPTO_SECRET)
        const keyPair = generateKeyPair(req.url, secret)
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
    return QRCode.toDataURL(`otpauth://totp/StellarAuth?secret=${secret}&algorithm=SHA512`)
    .then((qrCode) => ({
      secret,
      qrCode
    }))
    .then((response) => res.json(response))
    .catch((err) => next(err));
  }
}
