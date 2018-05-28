import express from 'express';

import insert from './insert';
import get from './get';
import update from './update';

const router = express.Router();

router.post('/', insert);
router.get('/', get);
router.put('/', update);

export default router;
