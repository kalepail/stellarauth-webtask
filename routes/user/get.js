import moment from 'moment'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import { getStellarServer, generateKeyPair } from '../../js/stellar'
import { setJwt } from '../../js/jwt';
import { encrypt } from '../../js/crypto'

import crypto from 'crypto'

// TODO: Once publicKey has been displayed never again show qrCode & secret

export default async function(req, res, next) {
  const secrets = req.webtaskContext.secrets
  const secret = encrypt(req.query.id + secrets.TOTP_SECRET)
  const keyPair = generateKeyPair(req.url, secret + secrets.STR_SECRET)
  const publicKey = keyPair.publicKey()
  const { server, StellarSdk } = getStellarServer(req.url)
  const verified = speakeasy.totp.verify({
    secret,
    token: req.query.code,
    encoding: 'base32'
  });

  console.log(
    crypto.randomBytes(64).toString('hex')
  );

  server.loadAccount(publicKey)
  .then(() => {
    if (verified) {
      const token = setJwt({
        sub: secret,
        iat: parseInt(moment().format('X')),
        exp: parseInt(moment().add(1, 'hour').format('X'))
      }, secrets.JWT_SECRET);

      return { token }
    }

    throw {
      status: 400,
      message: 'Invalid 2fa code'
    }
  })
  .catch(StellarSdk.NotFoundError, () => {
    if (verified)
      return { publicKey }

    else
      return QRCode.toDataURL(`otpauth://totp/StellarAuth?secret=${secret}&algorithm=SHA512`)
      .then((qrCode) => ({
        secret,
        qrCode
      }))
  })
  .then((response) => res.json(response))
  .catch((err) => next(err));
}
