import express from 'express';

import lookup from './lookup';

const router = express.Router();

router.post('/utils/lookup', lookup);

export default router;
