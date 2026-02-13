import express from 'express';
import User from '../models/User';

const router = express.Router();

// Middleware to authenticate via mobileKey
const authenticateMobileKey = async (req: any, res: any, next: any) => {
  const { key } = req.params;

  if (!key) {
    return res.status(401).json({ error: 'Mobile key required' });
  }

  try {
    const user = await User.findOne({ where: { mobileKey: key } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid mobile key' });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error('Mobile auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Sync Check / Info
router.get('/sync/:key', authenticateMobileKey, (req: any, res) => {
  res.json({
    status: 'success',
    message: 'Mobile interface connected',
    user: {
      id: req.user.id,
      username: req.user.username
    }
  });
});

export default router;
