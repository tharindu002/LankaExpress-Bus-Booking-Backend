import express from 'express';
import { handlePayHereNotification } from '../controllers/payhereController.js';

const router = express.Router();

// PayHere server-to-server webhook endpoint accepts form-urlencoded & json
router.post('/notify', express.urlencoded({ extended: true }), express.json(), handlePayHereNotification);

export default router;
