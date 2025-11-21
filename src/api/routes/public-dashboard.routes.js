const express = require('express');
const router = express.Router();

/**
 * Public Dashboard Routes - NO AUTH REQUIRED
 * Foundation Phase - Read-only dashboard data
 */

/**
 * GET /api/public/dashboard-stats
 * Public dashboard statistics - NO AUTH REQUIRED
 */
router.get('/dashboard-stats', async (req, res) => {
  try {
    const startTime = Date.now();
    const db = require('../../config/database');
    
    console.log('📊 Loading public dashboard stats...');
    
    // Basic stats only - no sensitive data
    const basicStats = await getBasicStats(db);
    const systemHealth = await getBasicSystemHealth();
    
    const responseTime = Date.now() - startTime;
    
    res.json({
      success: true,
      data: {
        stats: basicStats,
        system: systemHealth,
        meta: {
          generated_at: new Date().toISOString(),
          response_time_ms: responseTime
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting public dashboard stats:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error loading dashboard stats',
      message: error.message
    });
  }
});

/**
 * GET /api/public/dashboard-activity
 * Recent activity - NO AUTH, limited data
 */
router.get('/dashboard-activity', async (req, res) => {
  try {
    const startTime = Date.now();
    const db = require('../../config/database');
    
    console.log('📊 Loading public dashboard activity...');
    
    const activity = await getBasicActivity(db);
    const responseTime = Date.now() - startTime;
    
    res.json({
      success: true,
      data: {
        activity,
        meta: {
          generated_at: new Date().toISOString(),
          response_time_ms: responseTime
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting activity:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error loading activity',
      message: error.message
    });
  }
});

/**
 * Basic stats - safe for public dashboard
 */
async function getBasicStats(db) {
  try {
    // Users overview (counts only)
    const userStats = await db.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE active = true) as active_users,
        COUNT(*) FILTER (WHERE active = false) as inactive_users
      FROM tracking_users
    `);
    
    // Geofences overview (counts only) - using branches table
    const geofenceStats = await db.query(`
      SELECT 
        COUNT(*) as total_geofences,
        COUNT(*) FILTER (WHERE active = true) as active_geofences,
        COUNT(*) FILTER (WHERE active = false) as inactive_geofences
      FROM branches
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    `);
    
    // Today's activity - simplified for now
    const todayStats = {
      events_today: 0,
      alerts_sent_today: 0
    };
    
    return {
      users: userStats.rows[0] || { total_users: 0, active_users: 0, inactive_users: 0 },
      geofences: geofenceStats.rows[0] || { total_geofences: 0, active_geofences: 0, inactive_geofences: 0 },
      today: todayStats
    };
    
  } catch (error) {
    console.error('❌ Error in getBasicStats:', error.message);
    return {
      users: { total_users: 0, active_users: 0, inactive_users: 0 },
      geofences: { total_geofences: 0, active_geofences: 0, inactive_geofences: 0 },
      today: { events_today: 0, alerts_sent_today: 0 }
    };
  }
}

/**
 * Basic activity - safe for public dashboard
 */
async function getBasicActivity(db) {
  try {
    // Recent GPS activity (anonymized)
    let recentEvents = [];
    try {
      const locationsResult = await db.query(`
        SELECT 
          'location_update' as event_type,
          'GPS Update' as location_name,
          timestamp as event_time,
          false as telegram_sent,
          'User-' || SUBSTR(tracker_id, 1, 2) as anonymous_user
        FROM gps_locations
        ORDER BY timestamp DESC
        LIMIT 10
      `);
      recentEvents = locationsResult.rows || [];
    } catch (locError) {
      console.warn('⚠️ GPS locations table not available yet');
      recentEvents = [];
    }
    
    // Recent users activity (counts only, no personal info)
    let activeToday = 0;
    try {
      const activeTodayResult = await db.query(`
        SELECT 
          COUNT(DISTINCT tracker_id) as unique_active_today
        FROM gps_locations
        WHERE DATE(timestamp) = CURRENT_DATE
      `);
      activeToday = activeTodayResult.rows[0]?.unique_active_today || 0;
    } catch (activeError) {
      console.warn('⚠️ Active users count not available yet');
      activeToday = 0;
    }
    
    return {
      recent_events: recentEvents,
      active_today: activeToday
    };
    
  } catch (error) {
    console.error('❌ Error in getBasicActivity:', error.message);
    return {
      recent_events: [],
      active_today: 0
    };
  }
}

/**
 * Basic system health - public info only
 */
async function getBasicSystemHealth() {
  try {
    return {
      status: 'operational',
      uptime: Math.round(process.uptime()),
      memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Error in getBasicSystemHealth:', error.message);
    return {
      status: 'unknown',
      uptime: 0,
      memory_mb: 0,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = router;