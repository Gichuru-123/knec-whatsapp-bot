const express = require('express');
const router = express.Router();
const kbController = require('../controllers/kbController');
const config = require('../config');

// Production Guard: Internal inspection routes return 403 when disabled
router.use((req, res, next) => {
  if (!config.enableDevInspectionRoutes) {
    return res.status(403).json({
      error: {
        code: 403,
        message: 'Forbidden: Knowledge Base inspection endpoints are disabled in this environment.'
      }
    });
  }
  next();
});

router.get('/', (req, res) => kbController.getAllArticles(req, res));
router.get('/:id', (req, res) => kbController.getArticleById(req, res));

module.exports = router;
