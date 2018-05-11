import express from 'express';

import setAccount from './set-account';
import createAccount from './create-account';
import fundAccount from './fund-account';
import signTransaction from './sign-transaction';

const router = express.Router();

router.post('/stellar/set-account', setAccount);
router.post(/\/stellar\/create-account\/(test|public)/, createAccount);
router.post(/\/stellar\/fund-account\/(test|public)/, fundAccount);
router.post(/\/stellar\/sign-transaction\/(test|public)/, signTransaction);

export default router;
