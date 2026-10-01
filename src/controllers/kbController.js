const kbService = require('../services/kbService');

function getAllArticles(req, res) {
  const category = req.query.category;
  if (category) {
    const articles = kbService.getArticlesByCategory(category);
    return res.status(200).json({ count: articles.length, data: articles });
  }
  const articles = kbService.getAllArticles();
  return res.status(200).json({ count: articles.length, data: articles });
}

function getArticleById(req, res) {
  const id = req.params.id;
  if (!/^[a-zA-Z0-9-]+$/.test(id)) {
    return res.status(400).json({
      error: {
        message: 'Invalid article ID format.',
        code: 400
      }
    });
  }

  const article = kbService.getArticleById(id);
  if (!article) {
    return res.status(404).json({
      error: {
        message: `Knowledge Base article with ID '${id}' not found.`,
        code: 404
      }
    });
  }

  return res.status(200).json({ data: article });
}

module.exports = {
  getAllArticles,
  getArticleById
};
