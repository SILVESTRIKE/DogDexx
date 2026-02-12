const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env from backend
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/dog_breed_id';

const userSchema = new mongoose.Schema({
    email: String,
    role: String
});
const User = mongoose.model('User', userSchema);

async function promote() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to DB');

        const email = process.argv[2];
        if (!email) {
            console.error('Please provide email');
            process.exit(1);
        }

        const res = await User.updateOne({ email: email }, { $set: { role: 'admin' } });
        console.log('Update result:', res);

        await mongoose.disconnect();
    } catch (e) {
        console.error(e);
    }
}

promote();
