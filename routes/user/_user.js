import express from 'express';

import getsert from './getsert';

const router = express.Router();

router.post('/', getsert);

export default router;
