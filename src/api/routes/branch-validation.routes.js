const express = require('express');
const router = express.Router();
const db = require('../../config/database');

// Actualizar coordenadas de una sucursal
router.post('/update-coordinates', async (req, res) => {
  try {
    const { branchId, latitude, longitude, forceValidation = false } = req.body;
    
    if (forceValidation) {
      // Solo marcar como validado sin cambiar coordenadas
      await db.query(`
        UPDATE branches 
        SET gps_validated = true, updated_at = NOW()
        WHERE id = $1
      `, [branchId]);
    } else {
      // Actualizar coordenadas y marcar como validado
      await db.query(`
        UPDATE branches 
        SET latitude = $1, longitude = $2, gps_validated = true, updated_at = NOW()
        WHERE id = $3
      `, [latitude, longitude, branchId]);
    }
    
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

// Obtener todas las sucursales con detalles
router.get('/all', async (req, res) => {
  try {
    const branches = await db.query(`
      SELECT 
        id, branch_number, name, city, state, municipality, address,
        latitude, longitude, phone, email, zenput_id,
        gps_validated, active, region, created_at, updated_at
      FROM branches 
      WHERE active = true
      ORDER BY id
    `);
    
    res.json({ success: true, branches: branches.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Servir la interfaz HTML directamente
router.get('/interface', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const htmlPath = path.join(__dirname, '../../../validador-completo.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Interface not available', details: error.message });
  }
});

// Servir el verificador de coordenadas
router.get('/verificador', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const htmlPath = path.join(__dirname, '../../../verificador-coordenadas.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Verificador not available', details: error.message });
  }
});

module.exports = router;