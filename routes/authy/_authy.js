import express from 'express';

import setAccount from './set-account';
import sendSms from './send-sms';
import verifyCode from './verify-code';
import generateQr from './generate-qr';

const router = express.Router();

router.post('/set-account', setAccount);
router.post('/send-sms', sendSms);
router.post('/verify-code', verifyCode);
router.post('/generate-qr', generateQr);

export default router;
