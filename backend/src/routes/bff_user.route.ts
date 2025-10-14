import { Router } from 'express';
import { register, login, getProfile, updateProfile, logout } from '../controllers/bff_user.controller';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.post('/logout', logout);

export default router;
