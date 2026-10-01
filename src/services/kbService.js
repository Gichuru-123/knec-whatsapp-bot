const kbRepository = require('../repository/kbRepository');

function getAllArticles() {
  return kbRepository.findAll();
}

function getArticleById(id) {
  if (!id || typeof id !== 'string') return null;
  return kbRepository.findById(id.trim());
}

function getArticlesByCategory(category) {
  if (!category || typeof category !== 'string') return [];
  return kbRepository.findByCategory(category.trim());
}

module.exports = {
  getAllArticles,
  getArticleById,
  getArticlesByCategory
};
