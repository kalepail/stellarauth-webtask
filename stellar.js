import express from 'express';
import wt from 'webtask-tools';
import { json, urlencoded } from 'body-parser';
import { getJwt } from './js/jwt';

import stellar from './routes/stellar/_stellar';

const app = express();

app.use(urlencoded({extended: true}));
app.use(json());
app.use(stellar);

app.use((req, res, next) => {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

app.use((err, req, res, next) => {
  if (err.response)
    err = err.response;

  if (err.data)
    err = err.data;

  console.error(err);
  res.status(err.status || 500);
  res.json(err);
});

module.exports = wt.fromExpress(app).auth0({
  clientId: (ctx, req) => {
    const { client_id } = getJwt(req.headers['x-sa-token'], ctx.secrets.CRYPTO_SECRET);
    return client_id
  },
  clientSecret: (ctx, req) => {
    const { client_secret } = getJwt(req.headers['x-sa-token'], ctx.secrets.CRYPTO_SECRET);
    return client_secret
  },
  domain: (ctx, req) => ctx.secrets.AUTH0_DOMAIN
});
