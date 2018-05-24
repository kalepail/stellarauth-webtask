import express from 'express';

import create from './create';
import update from './update';
import show from './show';

const router = express.Router();

router.post('/', create);
router.put('/', update);
router.get('/:id', show);

export default router;
