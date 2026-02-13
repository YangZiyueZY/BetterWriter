import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/authenticateToken';
import { syncImageToCloud } from '../services/cloudSync';

const router = express.Router();

// 配置 multer 存储
const storage = multer.diskStorage({
  destination: (req: any, file, cb) => {
    // 基础上传目录
    const baseUploadDir = path.join(__dirname, '../../uploads/images');
    // 用户独立目录
    const userDir = path.join(baseUploadDir, req.user.id.toString());
    
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg|bmp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  },
});

// Upload Image
router.post('/', authenticateToken, upload.single('image'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user.id;
    const filename = req.file.filename;
    // 构建相对 URL
    const imageUrl = `/uploads/images/${userId}/${filename}`;

    // 触发云同步
    try {
        const fileContent = fs.readFileSync(req.file.path);
        await syncImageToCloud(userId, fileContent, filename);
    } catch (syncError) {
        console.error('Image cloud sync failed:', syncError);
        // 不阻断主流程
    }

    res.json({ message: 'Image uploaded successfully', url: imageUrl, filename: req.file.originalname });
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
