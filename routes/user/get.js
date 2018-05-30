import { generateKeyPair, generateKey } from '../../js/sep5'
import { getJwt, setJwt } from '../../js/jwt';
import moment from 'moment'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'

import crypto from 'crypto'
import base32 from 'base32.js'

export default async function(req, res, next) {
  const secrets = req.webtaskContext.secrets;
  const token = req.headers['authorization'] ? req.headers['authorization'].split(' ')[1] : null;

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
    var secret = base32.encode(new Buffer(req.query.id)).toString().replace(/=/g, '')
    var url = speakeasy.otpauthURL({
      secret: req.query.id,
      label: 'StellarAuth',
      algorithm: 'sha512'
    });

    console.log(

    );

    return QRCode.toDataURL(url)
    .then((qrCode) => ({
      secret,
      qrCode
    }))
    .then((response) => res.json(response))
    .catch((err) => next(err));
  }
}
