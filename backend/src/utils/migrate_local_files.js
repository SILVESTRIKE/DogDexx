// scripts/migrate_local_files.js
require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const path = require('path');
const { glob } = require('glob');

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME_CLOUDINARY,
    api_key: process.env.API_KEY_CLOUDINARY,
    api_secret: process.env.API_SECRET_CLOUDINARY,
});

const localPublicDir = path.join(__dirname, '../../public');

const migrate = async () => {
    console.log("Bắt đầu quét thư mục public...");
    const files = await glob('**/*', { cwd: localPublicDir, nodir: true });
    console.log(`Tìm thấy ${files.length} file. Bắt đầu di chuyển...`);

    for (const fileRelativePath of files) {
        // Biến này chứa đường dẫn đầy đủ mà bạn muốn in ra
        const fullLocalPath = path.join(localPublicDir, fileRelativePath);
        
        const publicId = path.join('public', fileRelativePath).replace(/\\/g, "/").replace(/\.[^/.]+$/, "");

        try {
            // --- THAY ĐỔI Ở DÒNG NÀY ---
            // In ra biến fullLocalPath thay vì fileRelativePath
            console.log(`- Uploading ${fullLocalPath}...`);
            
            const result = await cloudinary.uploader.upload(fullLocalPath, {
                public_id: publicId,
                resource_type: 'auto',
                overwrite: false,
            });

            console.log(`  => Thành công!`);
            console.log(`  => URL: ${result.secure_url}`);
            
        } catch (error) {
            if (error.http_code === 409) {
                console.log(`  => BỎ QUA: File đã tồn tại trên Cloudinary.`);
            } else {
                console.error(`  => LỖI với file ${fileRelativePath}:`, error.message);
            }
        }
    }
    console.log("--------------------------------------");
    console.log("Hoàn tất quá trình di chuyển!");
    console.log("--------------------------------------");
};

migrate();