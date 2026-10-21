const kbService = require('../services/kbService');

class KBController {
  getAllArticles(req, res) {
    const { category } = req.query;
    let articles;

    if (category) {
      articles = kbService.getArticlesByCategory(category);
    } else {
      articles = kbService.getAllArticles();
    }

    return res.status(200).json({
      count: articles.length,
      data: articles
    });
  }

  getArticleById(req, res) {
    const { id } = req.params;

    // Validate ID format (alphanumeric with hyphens)
    if (!id || typeof id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(id)) {
      return res.status(400).json({
        error: {
          code: 400,
          message: 'Bad Request: Invalid article ID format.'
        }
      });
    }

    const article = kbService.getArticleById(id);
    if (!article) {
      return res.status(404).json({
        error: {
          code: 404,
          message: `Not Found: Knowledge base article '${id}' does not exist.`
        }
      });
    }

    return res.status(200).json({ data: article });
  }
}

module.exports = new KBController();
