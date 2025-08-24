// Netlify Function: Environment Setup Test
// Check and configure environment variables

exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: { 
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      env_check: {
        VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ? 'Set' : 'Missing',
        VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Missing',
        NODE_ENV: process.env.NODE_ENV || 'unknown',
        CONTEXT: process.env.CONTEXT || 'unknown'
      },
      message: 'Environment variable status check',
      instructions: process.env.VITE_SUPABASE_URL ? 'Environment configured correctly' : 'Manual configuration required via Netlify dashboard'
    })
  };
};