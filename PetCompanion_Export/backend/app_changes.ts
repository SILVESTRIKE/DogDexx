// --- CHANGES FOR backend/src/app.ts ---

// 1. Add Imports
import bffDogRoutes from './routes/bff_dog.route';
import bffPostRoutes from './routes/bff_post.route';

// 2. Register Routes
app.use('/bff/dog', bffDogRoutes);
app.use('/bff/community', bffPostRoutes); // New Community Route
