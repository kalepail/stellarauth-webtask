import generateKeyPair from '../../js/sep5'
import { getStellarServer } from '../../js/stellar';
import { getJwt } from '../../js/jwt';
import speakeasy from 'speakeasy'

export default async function(req, res, next) {
  const token = req.headers['authorization'] ? req.headers['authorization'].split(' ')[1] : null;

  try {
    const secrets = req.webtaskContext.secrets;
    const tokenData = getJwt(token, secrets.CRYPTO_SECRET);

    const verified = speakeasy.totp.verify({
      encoding: 'base32',
      secret: tokenData.sub,
      token: req.body.code
    });

    if (verified) {
      const keyPair = generateKeyPair(req.url, `${tokenData.sub}@${secrets.CRYPTO_SECRET}`)
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
