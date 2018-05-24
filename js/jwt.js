import jwt from 'jsonwebtoken';

export function getJwt(token, secret) {
  return jwt.verify(token, secret);
}

export function setJwt(data, secret) {
  return jwt.sign(data, secret);
}
