import express from 'express';
import {
  loginUser,
  registerUser,
  forgotPassword,
  resetPassword,
  getUsers,
  updateUserProfile,
  updateUserStatus,
  toggleUserRole,
} from '../controllers/authController.js';

const router = express.Router();

// Auth & Users
router.post('/login', loginUser);
router.post('/register', registerUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/users', getUsers);
router.put('/users/:id/profile', updateUserProfile);
router.put('/users/:id/status', updateUserStatus);
router.put('/users/:id/role', toggleUserRole);

export default router;
