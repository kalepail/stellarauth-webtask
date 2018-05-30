import moment from 'moment'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import { generateKeyPair, encode32 } from '../../js/stellar'
import { getJwt, setJwt } from '../../js/jwt';
import { encrypt, decrypt } from '../../js/crypto'

export default async function(req, res, next) {
  const secrets = req.webtaskContext.secrets
  const token = req.headers['authorization'] ? req.headers['authorization'].split(' ')[1] : null

  if (token && req.query.code) {
    try {
      const tokenData = getJwt(token, secrets.JWT_SECRET);
      const verified = speakeasy.totp.verify({
        secret: tokenData.sub,
        token: req.query.code,
        encoding: 'base32'
      });

      if (verified) {
        const keyPair = generateKeyPair(req.url, tokenData.sub + secrets.STR_SECRET)
        const publicKey = keyPair.publicKey()

        res.json({
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

  else if (req.query.id) {
    const secret = encrypt(req.query.id)

    return QRCode.toDataURL(`otpauth://totp/StellarAuth?secret=${secret}&algorithm=SHA512`)
    .then((qrCode) => ({
      token: setJwt({
        sub: secret,
        iat: parseInt(moment().format('X')),
        exp: parseInt(moment().add(1, 'day').format('X'))
      }, secrets.JWT_SECRET),
      secret,
      qrCode
    }))
    .then((response) => res.json(response))
    .catch((err) => next(err));
  }

  else
    next()
}
