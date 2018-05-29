import express from 'express';

import get from './get';
import submit from './submit';

const router = express.Router();

router.get('/', get);
router.post(/\/(test|public)/, submit);

export default router;
