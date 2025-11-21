const express = require('express');
const router = express.Router();

/**
 * Admin Dashboard Routes - Foundation Phase
 * ZERO MODIFICATION to existing functionality
 * Only READING and AGGREGATING existing data
 */

/**
 * GET /api/admin/dashboard-data
 * Aggregated metrics for admin dashboard - PUBLIC ACCESS FOR FOUNDATION PHASE
 */
router.get('/dashboard-data', async (req, res) => {
  try {
    const startTime = Date.now();
    const db = require('../../config/database');
    
    // 1. Users Overview
    const usersStats = await getUsersStats(db);
    
    // 2. Geofences Overview  
    const geofencesStats = await getGeofencesStats(db);
    
    // 3. Recent Activity
    const recentActivity = await getRecentActivity(db);
    
    // 4. System Health
    const systemHealth = await getSystemHealth(db);
    
    // 5. Active Users on Map
    const activeUsers = await getActiveUsersForMap(db);
    
    const responseTime = Date.now() - startTime;
    
    res.json({
      success: true,
      data: {
        users: usersStats,
        geofences: geofencesStats,
        activity: recentActivity,
        system: systemHealth,
        map: activeUsers,
        meta: {
          generated_at: new Date().toISOString(),
          response_time_ms: responseTime
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting dashboard data:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error loading dashboard data',
      message: error.message
    });
  }
});

/**
 * Get users statistics - READ ONLY
 */
async function getUsersStats(db) {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE active = true) as active_users,
        COUNT(*) FILTER (WHERE active = false) as inactive_users,
        COUNT(DISTINCT role) as total_roles,
        COUNT(DISTINCT group_name) as total_groups
      FROM tracking_users
    `);
    
    // Get users by role
    const roleStats = await db.query(`
      SELECT 
        COALESCE(role, 'undefined') as role,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE active = true) as active_count
      FROM tracking_users 
      GROUP BY role
      ORDER BY count DESC
    `);
    
    // Get recent user activity
    const recentUsers = await db.query(`
      SELECT 
        tracker_id,
        display_name,
        role,
        active,
        last_location_time,
        created_at
      FROM tracking_users 
      WHERE active = true
      ORDER BY COALESCE(last_location_time, created_at) DESC
      LIMIT 10
    `);
    
    return {
      overview: stats.rows[0],
      by_role: roleStats.rows,
      recent_active: recentUsers.rows
    };
    
  } catch (error) {
    console.error('❌ Error in getUsersStats:', error.message);
    return {
      overview: { total_users: 0, active_users: 0, inactive_users: 0 },
      by_role: [],
      recent_active: []
    };
  }
}

/**
 * Get geofences statistics - READ ONLY
 */
async function getGeofencesStats(db) {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_geofences,
        COUNT(*) FILTER (WHERE geofence_enabled = true) as active_geofences,
        COUNT(*) FILTER (WHERE geofence_enabled = false) as inactive_geofences,
        AVG(geofence_radius) as avg_radius,
        COUNT(DISTINCT group_name) as total_groups
      FROM tracking_locations_cache
      WHERE geofence_radius IS NOT NULL
    `);
    
    // Get geofences by group
    const groupStats = await db.query(`
      SELECT 
        COALESCE(group_name, 'Sin Grupo') as group_name,
        COUNT(*) as total_locations,
        COUNT(*) FILTER (WHERE geofence_enabled = true) as active_geofences,
        AVG(geofence_radius) as avg_radius
      FROM tracking_locations_cache 
      WHERE geofence_radius IS NOT NULL
      GROUP BY group_name
      ORDER BY total_locations DESC
      LIMIT 10
    `);
    
    return {
      overview: stats.rows[0],
      by_group: groupStats.rows
    };
    
  } catch (error) {
    console.error('❌ Error in getGeofencesStats:', error.message);
    return {
      overview: { total_geofences: 0, active_geofences: 0, inactive_geofences: 0 },
      by_group: []
    };
  }
}

/**
 * Get recent activity - READ ONLY
 */
async function getRecentActivity(db) {
  try {
    // Recent geofence events
    const recentEvents = await db.query(`
      SELECT 
        ge.event_type,
        ge.user_tracker_id,
        ge.location_name,
        ge.event_time,
        ge.telegram_sent,
        tu.display_name
      FROM geofence_events ge
      LEFT JOIN tracking_users tu ON tu.tracker_id = ge.user_tracker_id
      ORDER BY ge.event_time DESC
      LIMIT 20
    `);
    
    // Recent GPS locations
    const recentLocations = await db.query(`
      SELECT 
        gl.tracker_id,
        gl.latitude,
        gl.longitude,
        gl.timestamp,
        gl.battery_level,
        tu.display_name
      FROM gps_locations gl
      LEFT JOIN tracking_users tu ON tu.tracker_id = gl.tracker_id
      ORDER BY gl.timestamp DESC
      LIMIT 15
    `);
    
    // Daily activity summary
    const todayStats = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE DATE(event_time) = CURRENT_DATE) as events_today,
        COUNT(*) FILTER (WHERE DATE(event_time) = CURRENT_DATE AND telegram_sent = true) as alerts_sent_today,
        COUNT(DISTINCT user_tracker_id) FILTER (WHERE DATE(event_time) = CURRENT_DATE) as active_users_today
      FROM geofence_events
    `);
    
    return {
      recent_events: recentEvents.rows,
      recent_locations: recentLocations.rows,
      today_summary: todayStats.rows[0]
    };
    
  } catch (error) {
    console.error('❌ Error in getRecentActivity:', error.message);
    return {
      recent_events: [],
      recent_locations: [],
      today_summary: { events_today: 0, alerts_sent_today: 0, active_users_today: 0 }
    };
  }
}

/**
 * Get system health - READ ONLY
 */
async function getSystemHealth(db) {
  try {
    // System config check
    const configCheck = await db.query(`
      SELECT key, value 
      FROM tracking_config 
      WHERE key IN ('system_active', 'last_health_check')
    `);
    
    // Database size and performance
    const dbStats = await db.query(`
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as database_size,
        (SELECT count(*) FROM gps_locations WHERE timestamp > NOW() - INTERVAL '24 hours') as locations_24h,
        (SELECT count(*) FROM geofence_events WHERE event_time > NOW() - INTERVAL '24 hours') as events_24h
    `);
    
    // Check Telegram config
    const telegramConfig = {
      bot_configured: !!process.env.TELEGRAM_BOT_TOKEN,
      admin_ids_configured: !!process.env.TELEGRAM_ADMIN_IDS,
      web_app_url: !!process.env.WEB_APP_URL
    };
    
    return {
      config: configCheck.rows.reduce((acc, row) => {
        acc[row.key] = row.value;
        return acc;
      }, {}),
      database: dbStats.rows[0],
      telegram: telegramConfig,
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      }
    };
    
  } catch (error) {
    console.error('❌ Error in getSystemHealth:', error.message);
    return {
      config: {},
      database: {},
      telegram: {},
      uptime: 0,
      memory: { used: 0, total: 0 }
    };
  }
}

/**
 * Get active users for map display - READ ONLY
 */
async function getActiveUsersForMap(db) {
  try {
    // Get users with recent locations for map
    const activeUsers = await db.query(`
      SELECT DISTINCT ON (gl.tracker_id)
        gl.tracker_id,
        gl.latitude,
        gl.longitude,
        gl.timestamp,
        gl.battery_level,
        tu.display_name,
        tu.role,
        tu.active as user_active,
        EXTRACT(EPOCH FROM (NOW() - gl.timestamp)) as seconds_ago
      FROM gps_locations gl
      JOIN tracking_users tu ON tu.tracker_id = gl.tracker_id
      WHERE tu.active = true 
        AND gl.timestamp > NOW() - INTERVAL '24 hours'
      ORDER BY gl.tracker_id, gl.timestamp DESC
    `);
    
    // Get geofences for map overlay
    const geofences = await db.query(`
      SELECT 
        location_code,
        name,
        latitude,
        longitude,
        geofence_radius,
        geofence_enabled,
        group_name
      FROM tracking_locations_cache
      WHERE latitude IS NOT NULL 
        AND longitude IS NOT NULL
        AND geofence_radius IS NOT NULL
        AND active = true
      ORDER BY geofence_enabled DESC, name
    `);
    
    return {
      users: activeUsers.rows,
      geofences: geofences.rows,
      last_update: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Error in getActiveUsersForMap:', error.message);
    return {
      users: [],
      geofences: [],
      last_update: new Date().toISOString()
    };
  }
}

module.exports = router;