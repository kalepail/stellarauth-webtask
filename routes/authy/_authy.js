import express from 'express';

import setAccount from './set-account';
import sendSms from './send-sms';
import verifyCode from './verify-code';
import generateQr from './generate-qr';

const router = express.Router();

router.post('/authy/set-account', setAccount);
router.post('/authy/send-sms', sendSms);
router.post('/authy/verify-code', verifyCode);
router.post('/authy/generate-qr', generateQr);

export default router;
