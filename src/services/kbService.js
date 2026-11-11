const kbRepository = require('../repository/kbRepository');
const { selectApprovedAnswer } = require('./kbAnswerPolicy');

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

function getApprovedAnswer(id, context) {
  const article = getArticleById(id);
  return selectApprovedAnswer(article, kbRepository.getSources(), context);
}

// Existing getAll/getById/category methods are development inspection APIs only.
module.exports = {
  getApprovedAnswer,
  getAllArticles,
  getArticleById,
  getArticlesByCategory
};
