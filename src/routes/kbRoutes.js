const express = require('express');
const router = express.Router();
const config = require('../config');
const kbController = require('../controllers/kbController');

// Technical Safety Boundary: Disable inspection endpoints unless explicitly enabled
router.use((req, res, next) => {
  if (!config.enableDevInspectionRoutes) {
    return res.status(403).json({
      error: {
        message: 'Internal inspection API endpoints are disabled in this environment.',
        code: 403
      }
    });
  }
  next();
});

router.get('/kb', kbController.getAllArticles);
router.get('/kb/:id', kbController.getArticleById);

module.exports = router;
