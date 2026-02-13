import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import User from '../models/User';
import { authenticateToken } from '../middleware/authenticateToken';
import { syncAvatarToCloud } from '../services/cloudSync';

const router = express.Router();

// 配置 multer 存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req: any, file, cb) => {
    const userId = req.user.id;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${userId}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  },
});

// Upload Avatar
router.post('/avatar', authenticateToken, upload.single('avatar'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user.id;
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // 构建相对 URL
    const filename = req.file.filename;
    const avatarUrl = `/uploads/avatars/${filename}`;

    // 更新用户头像字段
    user.avatar = avatarUrl;
    await user.save();

    // 触发云同步
    try {
        const fileContent = fs.readFileSync(req.file.path);
        const ext = path.extname(filename).substring(1); // 去掉点
        await syncAvatarToCloud(userId, fileContent, ext);
    } catch (syncError) {
        console.error('Avatar cloud sync failed:', syncError);
        // 不阻断主流程
    }

    res.json({ message: 'Avatar uploaded successfully', avatar: avatarUrl });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update Profile (Avatar URL)
router.put('/profile', authenticateToken, async (req: any, res) => {
  try {
    const { avatar } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (avatar !== undefined) {
      user.avatar = avatar;
    }

    await user.save();
    res.json({ message: 'Profile updated successfully', user: { id: user.id, username: user.username, avatar: user.avatar } });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Profile
router.get('/profile', authenticateToken, async (req: any, res) => {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
  
      res.json({ user: { id: user.id, username: user.username, avatar: user.avatar, mobileKey: user.mobileKey } });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

export default router;
