import express from 'express';

import get from './get';
import jwt from './jwt';

const router = express.Router();

router.get(/\/(test|public)/, get);
router.post(/\/(test|public)/, jwt);

export default router;
