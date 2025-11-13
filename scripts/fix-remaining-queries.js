const fs = require('fs');
const path = require('path');

/**
 * Fix remaining SQL query issues
 */

const fixes = [
  // Fix JOIN issues - user_id is integer, tracker_id is varchar
  {
    from: /LEFT JOIN tracking_users tu ON v\.user_id = tu\.tracker_id/g,
    to: 'LEFT JOIN tracking_users tu ON v.user_id = tu.id'
  },
  {
    from: /JOIN tracking_users tu ON v\.user_id = tu\.tracker_id/g,
    to: 'JOIN tracking_users tu ON v.user_id = tu.id'
  },
  {
    from: /LEFT JOIN tracking_users tu ON tv\.user_id = tu\.tracker_id/g,
    to: 'LEFT JOIN tracking_users tu ON tv.user_id = tu.id'
  },
  {
    from: /JOIN tracking_users tu ON tv\.user_id = tu\.tracker_id/g,
    to: 'JOIN tracking_users tu ON tv.user_id = tu.id'
  },
  
  // Fix remaining tracker_id references in WHERE clauses for tracking_visits
  {
    from: /FROM tracking_visits[^;]*WHERE tracker_id = /g,
    to: match => match.replace('WHERE tracker_id =', 'WHERE user_id =')
  },
  {
    from: /tracking_visits\s+WHERE\s+tracker_id\s*=/g,
    to: 'tracking_visits WHERE user_id ='
  }
];

function updateFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    fixes.forEach(({ from, to }) => {
      if (content.match(from)) {
        content = content.replace(from, to);
        modified = true;
      }
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Fixed: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}: ${error.message}`);
    return false;
  }
}

function fixDirectory(dirPath) {
  const files = fs.readdirSync(dirPath, { withFileTypes: true });
  let totalFixed = 0;
  
  for (const file of files) {
    const fullPath = path.join(dirPath, file.name);
    
    if (file.isDirectory() && file.name !== 'node_modules' && file.name !== '.git') {
      totalFixed += fixDirectory(fullPath);
    } else if (file.isFile() && (file.name.endsWith('.js') || file.name.endsWith('.sql'))) {
      if (updateFile(fullPath)) {
        totalFixed++;
      }
    }
  }
  
  return totalFixed;
}

function main() {
  console.log('🔧 Fixing remaining SQL query issues...');
  console.log('📁 Directory: /Users/robertodavila/pollo-loco-tracking-gps/src');
  
  const fixed = fixDirectory('/Users/robertodavila/pollo-loco-tracking-gps/src');
  
  console.log(`\n✅ Fixed ${fixed} files`);
  console.log('\n📋 Fixes applied:');
  console.log('   - JOIN tracking_users ON v.user_id = tu.id (not tu.tracker_id)');
  console.log('   - WHERE user_id = (not tracker_id) in tracking_visits');
}

if (require.main === module) {
  main();
}

module.exports = { fixDirectory, updateFile };