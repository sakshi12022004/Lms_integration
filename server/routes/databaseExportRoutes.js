const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const translationService = require('../services/translationService');
const authMiddleware = require('../middleware/authMiddleware');
const { checkExportAccess } = require('../middleware/quotaMiddleware');
const { rateLimiters } = require('../middleware/rateLimiter');
const db = require('../config/database-switch');

// Hardcoded Arabic translations for common field names
const arabicTranslations = {
  'id': 'المعرّف',
  'name': 'الاسم',
  'email': 'البريد الإلكتروني',
  'password': 'كلمة السر',
  'role': 'الدور',
  'createdAt': 'تم الإنشاء في',
  'updatedAt': 'تم التحديث في',
  'isApproved': 'موافق عليه',
  'description': 'الوصف',
  'title': 'العنوان',
  'content': 'المحتوى',
  'status': 'الحالة',
  'userId': 'معرّف المستخدم',
  'user_id': 'معرّف المستخدم',
  'classroomId': 'معرّف الفصل',
  'classroom_id': 'معرّف الفصل',
  'courseId': 'معرّف الدورة',
  'course_id': 'معرّف الدورة',
  'students': 'الطلاب',
  'teachers': 'المعلمون',
  'mentors': 'المرشدون',
  'courses': 'الدورات',
  'classrooms': 'الفصول',
  'payments': 'المدفوعات',
  'amount': 'المبلغ',
  'date': 'التاريخ',
  'phone': 'الهاتف',
  'address': 'العنوان',
  'city': 'المدينة',
  'country': 'الدولة',
  'startDate': 'تاريخ البدء',
  'endDate': 'تاريخ الانتهاء',
  'grade': 'الدرجة',
  'remarks': 'الملاحظات',
  'comments': 'التعليقات'
};

// Helper function to translate field name to Arabic
function getArabicFieldName(fieldName) {
  // Check hardcoded translations first
  if (arabicTranslations[fieldName]) {
    return arabicTranslations[fieldName];
  }
  // For unknown fields, try to construct Arabic version
  // If it looks like camelCase or snake_case, return as is for translation service
  return fieldName;
}

// Get all tables in the database
router.get('/tables', rateLimiters.sensitive, authMiddleware, checkExportAccess, async (req, res) => {
  try {
    db.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC", (err, tables) => {
      if (err) {
        console.error('Error fetching tables:', err);
        return res.status(500).json({ error: 'Error fetching tables' });
      }
      
      const tableNames = (tables || []).map(table => table.name);
      res.json({ tables: tableNames });
    });
  } catch (error) {
    console.error('Server error fetching tables:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get table structure
router.get('/table/:tableName/structure', rateLimiters.sensitive, authMiddleware, checkExportAccess, async (req, res) => {
  try {
    const { tableName } = req.params;
    
    // Validate table name to prevent SQL injection
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }
    
    db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
      if (err) {
        console.error('Error fetching table structure:', err);
        return res.status(500).json({ error: 'Error fetching table structure' });
      }
      
      const cols = (columns || []).map(col => ({
        name: col.name,
        column_name: col.name,
        data_type: col.type || 'TEXT',
        nullable: !col.notnull,
        is_primary: !!col.pk
      }));
      res.json({ columns: cols });
    });
  } catch (error) {
    console.error('Server error fetching table structure:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


// Get table data
router.get('/table/:tableName/data', rateLimiters.sensitive, authMiddleware, checkExportAccess, async (req, res) => {
  try {
    const { tableName } = req.params;
    const { limit = 10000, offset = 0 } = req.query;
    
    // Validate table name to prevent SQL injection
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }
    
    // Get total count
    db.get(`SELECT COUNT(*) as total FROM ${tableName}`, (err, countResult) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching data count' });
      }
      
      // Get data
      db.all(`SELECT * FROM ${tableName} LIMIT ? OFFSET ?`, [parseInt(limit), parseInt(offset)], (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Error fetching table data' });
        }
        
        res.json({
          data: rows,
          total: countResult.total,
          limit: parseInt(limit),
          offset: parseInt(offset)
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Export table as Excel (CSV format - Excel compatible)
router.get('/table/:tableName/excel', rateLimiters.sensitive, authMiddleware, checkExportAccess, async (req, res) => {
  try {
    const { tableName } = req.params;
    const lang = (req.query.lang || 'en').toLowerCase();

    // Validate table name to prevent SQL injection
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }

    // Get table structure first
    db.all(`PRAGMA table_info(${tableName})`, async (err, columns) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching table structure' });
      }

      // Build language-aware column map
      const cols = (columns || []).map(col => col.name);
      const columnMap = {};
      cols.forEach(c => {
        const m = c.match(/^(.*)_(en|ar)$/);
        if (m) {
          const base = m[1];
          const l = m[2];
          columnMap[base] = columnMap[base] || {};
          columnMap[base][l] = c;
        } else {
          columnMap[c] = columnMap[c] || {};
          columnMap[c].default = c;
        }
      });

      // Build select to include both ar and en source columns where available
      const selectParts = [];
      const bases = Object.keys(columnMap);
      bases.forEach(base => {
        const arCol = columnMap[base].ar || null;
        const enCol = columnMap[base].en || null;
        const defCol = columnMap[base].default || null;

        if (arCol) selectParts.push(`${arCol} as ${base}__ar_src`);
        else selectParts.push(`NULL as ${base}__ar_src`);

        if (enCol) selectParts.push(`${enCol} as ${base}__en_src`);
        else if (defCol) selectParts.push(`${defCol} as ${base}__en_src`);
        else selectParts.push(`NULL as ${base}__en_src`);
      });

      const selectQuery = `SELECT ${selectParts.join(', ')} FROM ${tableName}`;

      db.all(selectQuery, async (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Error fetching table data' });
        }

        // Convert to CSV (Excel compatible format)
        let csv = '\uFEFF'; // UTF-8 BOM for Excel compatibility

        // Headers are base names; translate if requested
        let headers = bases.slice();
        if (lang === 'ar') {
          headers = headers.map(h => getArabicFieldName(h));
        }

        csv += headers.join(',') + '\n';

        // Prepare batch translations for missing Arabic cells to reduce roundtrips
        for (const row of rows || []) {
          const toTranslate = [];
          const translateKeys = [];

          // collect missing ar values that need translation
          bases.forEach(base => {
            const arVal = row[`${base}__ar_src`];
            const enVal = row[`${base}__en_src`];

            if (lang === 'ar') {
              if (arVal && String(arVal).trim() !== '') {
                // nothing to do
              } else if (enVal && String(enVal).trim() !== '') {
                toTranslate.push(String(enVal));
                translateKeys.push(base);
              } else {
                toTranslate.push('');
                translateKeys.push(base);
              }
            }
          });

          let translated = [];
          if (toTranslate.length > 0) {
            try {
              translated = await translationService.translateBatch(toTranslate, 'ar', 'en');
            } catch (e) {
              console.error('Value batch translation failed:', e.message);
              translated = toTranslate.map(t => t);
            }
          }

          const values = bases.map(base => {
            const arVal = row[`${base}__ar_src`];
            const enVal = row[`${base}__en_src`];

            let finalVal = '';
            if (lang === 'ar') {
              if (arVal && String(arVal).trim() !== '') finalVal = String(arVal);
              else {
                const idx = translateKeys.indexOf(base);
                finalVal = (idx !== -1) ? translated[idx] : '';
              }
            } else {
              if (enVal && String(enVal).trim() !== '') finalVal = String(enVal);
              else if (arVal && String(arVal).trim() !== '') finalVal = String(arVal);
              else finalVal = '';
            }

            if (finalVal === null || finalVal === undefined) finalVal = '';
            const stringValue = String(finalVal);
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
          });

          csv += values.join(',') + '\n';
        }

        // Set headers for Excel download
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${tableName}_export_${lang}_${new Date().toISOString().split('T')[0]}.csv"`);
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.send(csv);
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Export entire database as Excel (multiple sheets in separate files)
router.get('/database/excel', rateLimiters.sensitive, authMiddleware, checkExportAccess, async (req, res) => {
  try {
    const lang = (req.query.lang || 'en').toLowerCase();
    // Get all tables
    db.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC", async (err, tables) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching tables' });
      }
      
      const tableNames = (tables || []).map(table => table.name);
      
      let combinedCsv = '\uFEFF'; // UTF-8 BOM for Excel compatibility

      let line1 = 'DATABASE EXPORT - LMS System';
      let line2 = 'Export Date:';
      let line3 = 'Total Tables:';
      let line4 = 'Language:';
      
      if (lang === 'ar') {
        line1 = 'تصدير قاعدة البيانات - نظام LMS';
        line2 = 'تاريخ التصدير:';
        line3 = 'إجمالي الجداول:';
        line4 = 'اللغة:';
      }

      combinedCsv += `${line1}\n`;
      combinedCsv += `${line2} ${new Date().toLocaleString()}\n`;
      combinedCsv += `${line3} ${tableNames.length}\n`;
      combinedCsv += `${line4} ${lang.toUpperCase()}\n\n`;

      if (tableNames.length === 0) {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="lms_database_export_${new Date().toISOString().split('T')[0]}.csv"`);
        return res.send(combinedCsv);
      }

      let completedTables = 0;
      
      tableNames.forEach(tableName => {
        db.all(`PRAGMA table_info(${tableName})`, async (err, columns) => {
          if (err) {
            completedTables++;
            if (completedTables === tableNames.length) {
              res.setHeader('Content-Type', 'text/csv; charset=utf-8');
              res.setHeader('Content-Disposition', `attachment; filename="lms_database_export_${new Date().toISOString().split('T')[0]}.csv"`);
              res.send(combinedCsv);
            }
            return;
          }

          const cols = (columns || []).map(col => col.name);
          const columnMap = {};
          cols.forEach(c => {
            const m = c.match(/^(.*)_(en|ar)$/);
            if (m) {
              const base = m[1];
              const l = m[2];
              columnMap[base] = columnMap[base] || {};
              columnMap[base][l] = c;
            } else {
              columnMap[c] = columnMap[c] || {};
              columnMap[c].default = c;
            }
          });

          const selectParts = [];
          const bases = Object.keys(columnMap);
          bases.forEach(base => {
            const arCol = columnMap[base].ar || null;
            const enCol = columnMap[base].en || null;
            const defCol = columnMap[base].default || null;

            if (arCol) selectParts.push(`${arCol} as ${base}__ar_src`);
            else selectParts.push(`NULL as ${base}__ar_src`);

            if (enCol) selectParts.push(`${enCol} as ${base}__en_src`);
            else if (defCol) selectParts.push(`${defCol} as ${base}__en_src`);
            else selectParts.push(`NULL as ${base}__en_src`);
          });

          const selectQuery = `SELECT ${selectParts.join(', ')} FROM ${tableName}`;

          db.all(selectQuery, async (err, rows) => {
            if (!err && rows && rows.length > 0) {
              let tableLabel = lang === 'ar' ? 'جدول' : 'TABLE';
              let recordsLabel = lang === 'ar' ? 'السجلات' : 'records';
              let displayTableName = tableName;

              combinedCsv += `${tableLabel}: ${String(displayTableName).toUpperCase()} (${rows.length} ${recordsLabel})\n`;

              let headers = bases.slice();
              if (lang === 'ar') {
                headers = headers.map(h => getArabicFieldName(h));
              }

              combinedCsv += headers.join(',') + '\n';

              for (const row of rows) {
                const values = bases.map(base => {
                  const arVal = row[`${base}__ar_src`];
                  const enVal = row[`${base}__en_src`];
                  let finalVal = '';
                  if (lang === 'ar') {
                    finalVal = (arVal && String(arVal).trim() !== '') ? String(arVal) : (enVal || '');
                  } else {
                    finalVal = (enVal && String(enVal).trim() !== '') ? String(enVal) : (arVal || '');
                  }

                  if (finalVal === null || finalVal === undefined) finalVal = '';
                  const stringValue = String(finalVal);
                  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
                    return `"${stringValue.replace(/"/g, '""')}"`;
                  }
                  return stringValue;
                });

                combinedCsv += values.join(',') + '\n';
              }

              combinedCsv += '\n';
            }
            
            completedTables++;
            if (completedTables === tableNames.length) {
              res.setHeader('Content-Type', 'text/csv; charset=utf-8');
              res.setHeader('Content-Disposition', `attachment; filename="lms_database_export_${new Date().toISOString().split('T')[0]}.csv"`);
              res.setHeader('Cache-Control', 'no-cache');
              res.setHeader('Pragma', 'no-cache');
              res.setHeader('Expires', '0');
              res.send(combinedCsv);
            }
          });
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get database statistics
router.get('/stats', rateLimiters.sensitive, authMiddleware, checkExportAccess, async (req, res) => {
  try {
    db.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC", (err, tables) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching tables' });
      }
      
      const tableNames = (tables || []).map(table => table.name);
      const stats = {
        totalTables: tableNames.length,
        tables: {},
        exportDate: new Date().toISOString()
      };
      
      if (tableNames.length === 0) {
        return res.json(stats);
      }
      
      let completedTables = 0;
      
      tableNames.forEach(tableName => {
        db.get(`SELECT COUNT(*) as count FROM ${tableName}`, (err, result) => {
          completedTables++;
          
          if (!err && result) {
            stats.tables[tableName] = result.count;
          }
          
          if (completedTables === tableNames.length) {
            res.json(stats);
          }
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

