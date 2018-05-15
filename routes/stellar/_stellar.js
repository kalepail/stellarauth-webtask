import express from 'express';

import setAccount from './set-account';
import createAccount from './create-account';
import fundAccount from './fund-account';
import signTransaction from './sign-transaction';

const router = express.Router();

router.post('/set-account', setAccount);
router.post(/\/create-account\/(test|public)/, createAccount);
router.post(/\/fund-account\/(test|public)/, fundAccount);
router.post(/\/sign-transaction\/(test|public)/, signTransaction);

export default router;
