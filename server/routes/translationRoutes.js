const express = require('express');
const router = express.Router();
const translationService = require('../services/translationService');


// Get supported languages
router.get('/languages', async (req, res) => {
  try {
    const languages = await translationService.getSupportedLanguages();
    res.json({ languages });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch languages' });
  }
});

// Translate text (server-side only)
router.post('/translate', async (req, res) => {
  try {
    const { text, targetLang, sourceLang = 'en' } = req.body;
    
    if (!text || !targetLang) {
      return res.status(400).json({ error: 'Text and target language are required' });
    }
    
    if (!translationService.isLanguageSupported(targetLang)) {
      return res.status(400).json({ error: 'Unsupported target language' });
    }
    
    const translatedText = await translationService.translateText(text, targetLang, sourceLang);
    res.json({ translatedText });
  } catch (error) {
    res.status(500).json({ error: 'Translation failed' });
  }
});

// Translate content and store in database
router.post('/translate-content', async (req, res) => {
  try {
    const { contentId, contentType, contentField, targetLang, sourceLang = 'en' } = req.body;
    
    if (!contentId || !contentType || !contentField || !targetLang) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Get original content
    const originalContent = await getOriginalContent(contentId, contentType, contentField);
    if (!originalContent) {
      return res.status(404).json({ error: 'Original content not found' });
    }
    
    // Check if translation already exists
    const existingTranslation = await getTranslation(contentId, contentType, contentField, targetLang);
    if (existingTranslation) {
      return res.json({ translatedText: existingTranslation.translated_text });
    }
    
    // Translate and store
    const translatedText = await translationService.translateText(originalContent, targetLang, sourceLang);
    await storeTranslation(contentId, contentType, contentField, targetLang, translatedText);
    
    res.json({ translatedText });
  } catch (error) {
    res.status(500).json({ error: 'Content translation failed' });
  }
});

// Get translated content
router.get('/content/:contentId/:contentType/:contentField/:lang', async (req, res) => {
  try {
    const { contentId, contentType, contentField, lang } = req.params;
    
    // Try to get translated content first
    const translation = await getTranslation(contentId, contentType, contentField, lang);
    if (translation) {
      return res.json({ content: translation.translated_text, isTranslated: true });
    }
    
    // Fallback to original content
    const originalContent = await getOriginalContent(contentId, contentType, contentField);
    if (originalContent) {
      return res.json({ content: originalContent, isTranslated: false });
    }
    
    res.status(404).json({ error: 'Content not found' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

// Helper functions
async function getOriginalContent(contentId, contentType, contentField) {
  return new Promise((resolve, reject) => {
    let query = '';
    let params = [contentId];
    
    switch (contentType) {
      case 'course':
        query = `SELECT ${contentField} FROM courses WHERE id = ?`;
        break;
      case 'week':
        query = `SELECT ${contentField} FROM weeks WHERE id = ?`;
        break;
      case 'course_material':
        query = `SELECT ${contentField} FROM course_materials WHERE id = ?`;
        break;
      case 'assessment':
        query = `SELECT ${contentField} FROM assessments WHERE id = ?`;
        break;
      case 'assessment_question':
        query = `SELECT ${contentField} FROM assessment_questions WHERE id = ?`;
        break;
      default:
        return resolve(null);
    }
    
    db.get(query, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row ? row[contentField] : null);
      }
    });
  });
}

async function getTranslation(contentId, contentType, contentField, targetLang) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT translated_text 
      FROM content_translations 
      WHERE content_id = ? AND content_type = ? AND content_field = ? AND language_code = ?
    `;
    const params = [contentId, contentType, contentField, targetLang];
    
    db.get(query, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

async function storeTranslation(contentId, contentType, contentField, targetLang, translatedText) {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO content_translations 
      (content_id, content_type, content_field, language_code, translated_text, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `;
    const params = [contentId, contentType, contentField, targetLang, translatedText];
    
    db.run(query, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.lastID);
      }
    });
  });
}

// Batch translate multiple texts - LIGHTWEIGHT ENDPOINT
router.post('/translate-batch', async (req, res) => {
  try {
    const { texts, targetLang, sourceLang = 'en' } = req.body;
    
    if (!texts || !Array.isArray(texts) || texts.length === 0 || !targetLang) {
      return res.status(400).json({ error: 'Texts array and target language are required' });
    }
    
    if (!translationService.isLanguageSupported(targetLang)) {
      return res.status(400).json({ error: 'Unsupported target language' });
    }
    
    console.log(`⏳ Batch translating ${texts.length} texts to ${targetLang}`);
    
    const translatedTexts = await translationService.translateBatch(texts, targetLang, sourceLang);
    
    res.json({ 
      success: true,
      translatedTexts,
      count: translatedTexts.length 
    });
  } catch (error) {
    console.error('Batch translation error:', error);
    res.status(500).json({ error: 'Batch translation failed', details: error.message });
  }
});

module.exports = router;
