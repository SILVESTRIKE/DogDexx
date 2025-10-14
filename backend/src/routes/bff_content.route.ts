import { Router } from 'express';
import { getBreedDetail, getBreeds, uploadMedia } from '../controllers/bff_content.controller';

const router = Router();

router.get('/breed/:slug', getBreedDetail);
router.get('/breeds', getBreeds);
router.post('/media/upload', uploadMedia);

export default router;
