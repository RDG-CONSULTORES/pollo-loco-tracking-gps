const express = require('express');
const router = express.Router();
const db = require('../../config/database');

// Actualizar coordenadas de una sucursal
router.post('/update-coordinates', async (req, res) => {
  try {
    const { branchId, latitude, longitude } = req.body;
    
    await db.query(`
      UPDATE branches 
      SET latitude = $1, longitude = $2, gps_validated = true, updated_at = NOW()
      WHERE id = $3
    `, [latitude, longitude, branchId]);
    
    res.json({ success: true, message: 'Coordenadas actualizadas' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener estadísticas de validación
router.get('/stats', async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as with_coords,
        COUNT(CASE WHEN gps_validated = true THEN 1 END) as validated
      FROM branches WHERE active = true
    `);
    
    res.json({ success: true, stats: stats.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Servir la interfaz HTML directamente
router.get('/interface', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const htmlPath = path.join(__dirname, '../../webapp/branch-validation.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Interface not available', details: error.message });
  }
});

module.exports = router;