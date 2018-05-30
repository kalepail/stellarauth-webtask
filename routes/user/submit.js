import speakeasy from 'speakeasy'
import { getStellarServer, generateKeyPair } from '../../js/stellar'
import { getJwt } from '../../js/jwt'
import { encode } from '../../js/crypto'

export default async function(req, res, next) {
  const secrets = req.webtaskContext.secrets;
  const token = req.headers['authorization'] ? req.headers['authorization'].split(' ')[1] : null;

  try {
    const tokenData = getJwt(token, secrets.JWT_SECRET);
    const verified = speakeasy.totp.verify({
      secret: tokenData.sub,
      token: req.body.code,
      encoding: 'base32'
    });

    if (verified) {
      const keyPair = generateKeyPair(req.url, tokenData.sub + secrets.STR_SECRET)
      const { server, StellarSdk } = getStellarServer(req.url);

      server
      .loadAccount(keyPair.publicKey())
      .then((account) => {
        const transaction = new StellarSdk.Transaction(req.body.xdr);

        transaction.sign(keyPair);
        return server.submitTransaction(transaction);
      })
      .then((result) => res.json(result))
      .catch(({data}) => next(data));
    }

    else {
      next({
        status: 400,
        message: 'Invalid or expired 2fa code'
      })
    }
  } catch(err) {
    next(err)
  }
}
