import express from 'express';

import lookup from './lookup';

const router = express.Router();

router.post('/lookup', lookup);

export default router;
