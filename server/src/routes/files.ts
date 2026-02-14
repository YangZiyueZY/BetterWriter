import express from 'express';
import File from '../models/File';
import User from '../models/User';
import { authenticateToken } from '../middleware/authenticateToken';
import { mirrorDelete, mirrorDeleteRelative, mirrorUpsert } from '../services/localMirror';
import { syncDeleteFromCloud, syncDeleteRelativeFromCloud, syncUpsertToCloud } from '../services/cloudSync';
import { resolveRelativePath } from '../services/syncPaths';
import { enqueueFilesSync } from '../services/syncQueue';
import { ensureUniqueNameInDb } from '../services/nameUniqueness';

const router = express.Router();

const isSafeId = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  if (value.length < 1 || value.length > 128) return false;
  return /^[a-zA-Z0-9_-]+$/.test(value);
};

const isAllowedFormat = (value: unknown): value is 'md' | 'txt' => {
  return value === 'md' || value === 'txt';
};

// Get all files for the logged-in user
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const files = await File.findAll({ where: { userId: req.user.id } });
    res.json(files);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching files' });
  }
});

// Get a single file
router.get('/:id', authenticateToken, async (req: any, res) => {
    try {
        const file = await File.findOne({ where: { id: req.params.id, userId: req.user.id } });
        if (!file) return res.status(404).json({ message: 'File not found' });
        res.json(file);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching file' });
    }
});

// Create or Update a file/folder (Upsert) with Conflict Detection
router.put('/:id', authenticateToken, async (req: any, res) => {
  const { id } = req.params;
  const { parentId, name, type, content, format, updatedAt } = req.body;

  try {
    if (!isSafeId(id)) {
      return res.status(400).json({ message: 'Invalid file id' });
    }
    if (parentId != null && !isSafeId(parentId)) {
      return res.status(400).json({ message: 'Invalid parentId' });
    }
    if (format != null && !isAllowedFormat(format)) {
      return res.status(400).json({ message: 'Invalid format' });
    }
    if (type !== 'file' && type !== 'folder') {
      return res.status(400).json({ message: 'Invalid type' });
    }

    const existingFile = await File.findOne({ where: { id, userId: req.user.id } });
    const existingRel = existingFile ? await resolveRelativePath(req.user.id, existingFile) : null;

    if (existingFile) {
        // Conflict detection:
        // Client sends its 'updatedAt' which is the base version it started editing from.
        // Server compares this with its own 'updatedAt'.
        // If server.updatedAt > client.updatedAt, it means server has a newer version that client hasn't seen.
        
        const serverUpdatedAt = Number(existingFile.getDataValue('updatedAt'));
        const clientBaseUpdatedAt = Number(updatedAt); // This comes from client store

        // We allow equal timestamps or client being older.
        // If server is strictly newer, we reject.
        // Note: Initial files might have updatedAt=0 or similar, handle gracefully.
        
        if (serverUpdatedAt > clientBaseUpdatedAt) {
            console.log(`Conflict detected for file ${id}. Server: ${serverUpdatedAt}, Client: ${clientBaseUpdatedAt}`);
            return res.status(409).json({ 
                message: 'Server has newer version', 
                file: existingFile 
            });
        }
    }

    const finalName = await ensureUniqueNameInDb({
      userId: req.user.id,
      parentId: parentId ?? null,
      type,
      desiredName: String(name ?? ''),
      selfId: id,
    });

    const upsertData: any = {
      id,
      userId: req.user.id,
      parentId,
      name: finalName,
      type,
      content,
      format,
      updatedAt: Date.now() // Server generates the NEW timestamp
    };

    if (!existingFile) {
        // upsertData.createdAt = new Date().toISOString(); // Remove this for now if model doesn't support it
    } else {
        // upsertData.createdAt = existingFile.getDataValue('createdAt'); // Removed from model
    }

    // Use upsert
    await File.upsert(upsertData);
    
    // Fetch again to return clean object
    const finalFile = await File.findOne({ where: { id, userId: req.user.id } });
    res.json(finalFile);
    if (finalFile) {
      void mirrorUpsert(req.user.id, finalFile)
        .then(() => syncUpsertToCloud(req.user.id, finalFile))
        .catch(() => undefined);
      if (String(finalFile.getDataValue('type')) === 'folder') {
        void File.findAll({ where: { userId: req.user.id } })
          .then((all) => {
            const byParent = new Map<string | null, any[]>();
            for (const f of all) {
              const pid = (f as any).getDataValue('parentId');
              const key = pid ? String(pid) : null;
              const arr = byParent.get(key) || [];
              arr.push(f);
              byParent.set(key, arr);
            }
            const out: any[] = [];
            const stack: string[] = [String(finalFile.getDataValue('id'))];
            while (stack.length) {
              const cur = stack.pop()!;
              const children = byParent.get(cur) || [];
              for (const c of children) {
                out.push(c);
                if (String((c as any).getDataValue('type')) === 'folder') {
                  stack.push(String((c as any).getDataValue('id')));
                }
              }
            }
            enqueueFilesSync(req.user.id, out);
          })
          .catch(() => undefined);
      }
      if (existingRel) {
        void resolveRelativePath(req.user.id, finalFile)
          .then((nextRel) => {
            if (nextRel !== existingRel) {
              return mirrorDeleteRelative(req.user.id, existingRel)
                .then(() => syncDeleteRelativeFromCloud(req.user.id, existingRel))
                .catch(() => undefined);
            }
          })
          .catch(() => undefined);
      }
    }
  } catch (error) {
    console.error('Error saving file:', error);
    res.status(500).json({ message: 'Error saving file' });
  }
});

// Delete a file/folder
router.delete('/:id', authenticateToken, async (req: any, res) => {
  const { id } = req.params;
  try {
    if (!isSafeId(id)) {
      return res.status(400).json({ message: 'Invalid file id' });
    }
    const existing = await File.findOne({ where: { id, userId: req.user.id } });
    const rel = existing ? await resolveRelativePath(req.user.id, existing) : null;
    await File.destroy({ where: { id, userId: req.user.id } });
    res.sendStatus(204);
    if (rel) {
      void mirrorDeleteRelative(req.user.id, rel)
        .then(() => syncDeleteRelativeFromCloud(req.user.id, rel))
        .catch(() => undefined);
    }
    void mirrorDelete(req.user.id, id).then(() => syncDeleteFromCloud(req.user.id, id)).catch(() => undefined);
  } catch (error) {
    res.status(500).json({ message: 'Error deleting file' });
  }
});

// Batch Sync (Optional, but good for initial push or conflicts)
// For now, let's stick to individual operations for simplicity,
// but add a bulk create/update endpoint if needed.

export default router;
