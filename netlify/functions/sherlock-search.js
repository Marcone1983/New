// Netlify Function: Sherlock OSINT Business Search
// Executes Python Sherlock script for business profile discovery

const { spawn } = require('child_process');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { query, platforms } = JSON.parse(event.body);
    
    if (!query || query.length < 2) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Query must be at least 2 characters' })
      };
    }

    console.log('🔍 Sherlock OSINT search for:', query);

    // Check cache first
    const cachedResult = await getCachedResult(query, 'sherlock_osint');
    if (cachedResult) {
      console.log('⚡ CACHE HIT - Sherlock results');
      return {
        statusCode: 200,
        headers: getCorsHeaders(),
        body: JSON.stringify({
          ...cachedResult,
          cached: true,
          message: 'Cached OSINT results'
        })
      };
    }

    // Execute Sherlock search
    const sherlockResults = await executeSherlockSearch(query, platforms);
    
    const finalResult = {
      success: true,
      query: query,
      platform: 'sherlock_osint',
      results: sherlockResults.profiles || [],
      method: 'osint',
      totalFound: sherlockResults.total_profiles_found || 0,
      searchedUsernames: sherlockResults.searched_usernames || [],
      source: 'sherlock'
    };

    // Cache the result
    await cacheResult(query, 'sherlock_osint', finalResult);
    
    console.log(`✅ Sherlock found ${finalResult.results.length} profiles`);

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        ...finalResult,
        message: 'OSINT search completed'
      })
    };

  } catch (error) {
    console.error('Sherlock search error:', error);
    
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: false,
        error: 'Sherlock OSINT search failed',
        message: error.message
      })
    };
  }
};

async function executeSherlockSearch(businessName, targetPlatforms = null) {
  return new Promise((resolve, reject) => {
    try {
      // Path to Python script
      const pythonScript = path.join(process.cwd(), 'python', 'sherlock_business_search.py');
      
      // Build command arguments
      const args = [pythonScript, businessName];
      if (targetPlatforms && Array.isArray(targetPlatforms)) {
        args.push(...targetPlatforms);
      }

      console.log('🐍 Executing Python Sherlock:', args.join(' '));

      // Spawn Python process
      const pythonProcess = spawn('python3', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONPATH: process.cwd() }
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.error('Python script error:', stderr);
          reject(new Error(`Sherlock process exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          // Parse JSON output from Python script
          const result = JSON.parse(stdout.trim());
          resolve(result);
        } catch (parseError) {
          console.error('Failed to parse Python output:', stdout);
          reject(new Error('Failed to parse Sherlock results'));
        }
      });

      pythonProcess.on('error', (error) => {
        console.error('Failed to start Python process:', error);
        reject(new Error('Failed to execute Sherlock search'));
      });

      // Timeout after 60 seconds
      setTimeout(() => {
        pythonProcess.kill('SIGKILL');
        reject(new Error('Sherlock search timeout'));
      }, 60000);

    } catch (error) {
      reject(error);
    }
  });
}

// Cache functions
function generateQueryHash(query, platform) {
  const normalizedQuery = query.toLowerCase().trim();
  const hashInput = `${normalizedQuery}_${platform}`;
  
  let hash = 0;
  for (let i = 0; i < hashInput.length; i++) {
    const char = hashInput.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(36);
}

async function getCachedResult(query, platform) {
  const queryHash = generateQueryHash(query, platform);
  
  try {
    const { data, error } = await supabase
      .from('api_cache')
      .select('*')
      .eq('query_hash', queryHash)
      .eq('platform', platform)
      .single();

    if (error && error.code !== 'PGRST116') {
      return null;
    }

    if (data) {
      // Update hit count
      await supabase
        .from('api_cache')
        .update({
          hit_count: data.hit_count + 1,
          last_accessed_at: new Date().toISOString()
        })
        .eq('id', data.id);
      
      return {
        success: true,
        results: data.response_data.results || data.response_data,
        query: data.query_text,
        platform: data.platform,
        hitCount: data.hit_count + 1
      };
    }

    return null;
  } catch (error) {
    console.error('Cache lookup error:', error);
    return null;
  }
}

async function cacheResult(query, platform, apiResponse) {
  const queryHash = generateQueryHash(query, platform);
  
  try {
    const expiresAt = new Date(Date.now() + (90 * 24 * 60 * 60 * 1000)); // 90 days

    const cacheData = {
      query_hash: queryHash,
      query_text: query,
      platform: platform,
      response_data: apiResponse,
      expires_at: expiresAt.toISOString(),
      hit_count: 1
    };

    await supabase
      .from('api_cache')
      .insert([cacheData]);

    console.log('💾 CACHED SHERLOCK QUERY:', query);

  } catch (error) {
    console.error('Cache storage error:', error);
  }
}

function getCorsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}