import * as miscreant from 'miscreant';
import ab2str from 'arraybuffer-to-string';
import { encode, decode } from 'base64-arraybuffer';
import crypto from 'crypto';

export async function encrypt(secret, encoded_dataKey) {
  const dataKey = new Uint8Array(decode(encoded_dataKey));
  const stringBuffer = new Buffer.from(secret, 'utf8');
  const nonce = crypto.randomBytes(16);

  const encryptor = await miscreant.AEAD.importKey(dataKey, 'AES-PMAC-SIV', new miscreant.PolyfillCryptoProvider());
  const cipherText = await encryptor.seal(stringBuffer, nonce);

  return {
    secret: encode(cipherText),
    nonce: encode(nonce)
  }
}

export async function decrypt(secret, nonce, encoded_dataKey) {
  const cipherText = new Uint8Array(decode(secret));
  const dataKey = new Uint8Array(decode(encoded_dataKey));
  nonce = new Uint8Array(decode(nonce));

  let encryptor = await miscreant.AEAD.importKey(dataKey, 'AES-PMAC-SIV', new miscreant.PolyfillCryptoProvider());
  let stringBuffer = await encryptor.open(cipherText, nonce);

  return ab2str(stringBuffer);
}