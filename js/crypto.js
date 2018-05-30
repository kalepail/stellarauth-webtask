import base32 from 'hi-base32'
import shajs from 'sha.js'

export function encrypt(string) {
  return base32.encode(
    shajs('sha256').update(string).digest()
  ).replace(/=/g, '')
}
