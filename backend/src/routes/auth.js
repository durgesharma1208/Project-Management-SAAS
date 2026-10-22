import { Router } from 'express';
import {
  registerController, loginController, refreshController, logoutController,
  forgotPasswordController, resetPasswordController, getMeController,
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.post('/register', registerController);
router.post('/login', loginController);
router.post('/refresh', refreshController);
router.post('/forgot-password', forgotPasswordController);
router.post('/reset-password', resetPasswordController);

// Protected
router.post('/logout', protect, logoutController);
router.get('/me', protect, getMeController);

export default router;
