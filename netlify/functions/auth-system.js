// ENTERPRISE AUTHENTICATION SYSTEM - PRODUCTION READY
// Real login/registration with Supabase Auth
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Supabase configuration - REQUIRES PROPER ENVIRONMENT VARIABLES
if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
  throw new Error('CONFIGURATION ERROR: Missing Supabase environment variables. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Netlify.');
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

console.log('✅ Supabase properly configured');

// Enterprise users with special privileges
const ENTERPRISE_USERS = [
  'robertoromagnino83@gmail.com'
];

exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { action } = body;

    switch (action) {
      case 'register':
        return await registerUser(body, headers);
        
      case 'login':
        return await loginUser(body, headers);
        
      case 'verify_email':
        return await verifyEmail(body, headers);
        
      case 'reset_password':
        return await resetPassword(body, headers);
        
      case 'get_user_profile':
        return await getUserProfile(body, headers);
        
      case 'update_profile':
        return await updateProfile(body, headers);
        
      case 'check_enterprise_access':
        return await checkEnterpriseAccess(body, headers);
        
      case 'check_session':
        return await checkSession(body, headers);
        
      case 'logout':
        return await logoutUser(body, headers);

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid action' })
        };
    }

  } catch (error) {
    console.error('Auth system error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// REGISTER NEW USER
async function registerUser(body, headers) {
  try {
    console.log('Registration attempt:', { email: body.email, hasPassword: !!body.password });
    
    const { email, password, full_name, company_name } = body;

    if (!email || !password || !full_name) {
      console.log('Missing required fields');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Missing required fields: email, password, full_name' 
        })
      };
    }

    // Password validation
    if (password.length < 8) {
      console.log('Password too short');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Password must be at least 8 characters long' 
        })
      };
    }

    console.log('Attempting Supabase signUp...');
    
    // Register with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password: password,
      options: {
        data: {
          full_name: full_name.trim(),
          company_name: company_name?.trim() || null,
          registration_date: new Date().toISOString()
        }
      }
    });

    console.log('Supabase signUp result:', { 
      hasData: !!data, 
      hasUser: !!data?.user, 
      hasError: !!error,
      errorMessage: error?.message 
    });

    if (error) {
      console.error('Supabase signup error:', error);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: error.message 
        })
      };
    }

    // Check if user gets enterprise privileges
    const isEnterpriseUser = ENTERPRISE_USERS.includes(email.toLowerCase());
    console.log('User enterprise status:', { email: email.toLowerCase(), isEnterprise: isEnterpriseUser });
    
    // Create user profile in database - MUST SUCCEED
    console.log('Creating user profile...');
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: data.user.id,
        email: email.toLowerCase(),
        full_name: full_name.trim(),
        company_name: company_name?.trim() || null,
        subscription_plan: isEnterpriseUser ? 'advanced' : 'free',
        enterprise_access: isEnterpriseUser,
        created_at: new Date().toISOString()
      });

    if (profileError) {
      console.error('❌ DATABASE ERROR - user_profiles table missing or misconfigured:', profileError);
      console.error('🔧 SOLUTION: Run database-migrations/003_auth_system.sql in Supabase SQL Editor');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Database not configured. Run the database migration first.',
          technical_error: profileError.message
        })
      };
    }
    
    console.log('✅ User profile created successfully');

    console.log('Registration successful, returning response');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Registration successful! Please check your email to verify your account.',
        user: {
          id: data.user.id,
          email: data.user.email,
          full_name: full_name,
          enterprise_access: isEnterpriseUser
        }
      })
    };

  } catch (error) {
    console.error('Registration error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Registration failed: ' + error.message 
      })
    };
  }
}

// LOGIN USER
async function loginUser(body, headers) {
  try {
    const { email, password } = body;

    if (!email || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Email and password are required' 
        })
      };
    }

    // Login with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password: password
    });

    if (error) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: error.message })
      };
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', data.user.id)
      .single();

    // Check enterprise access
    const isEnterpriseUser = ENTERPRISE_USERS.includes(email.toLowerCase());
    
    // Update enterprise access if needed
    if (isEnterpriseUser && (!profile || !profile.enterprise_access)) {
      await supabase
        .from('user_profiles')
        .upsert({
          user_id: data.user.id,
          email: email.toLowerCase(),
          enterprise_access: true,
          subscription_plan: 'advanced',
          updated_at: new Date().toISOString()
        });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Login successful',
        user: {
          id: data.user.id,
          email: data.user.email,
          full_name: profile?.full_name || data.user.user_metadata?.full_name,
          company_name: profile?.company_name || data.user.user_metadata?.company_name,
          subscription_plan: isEnterpriseUser ? 'advanced' : (profile?.subscription_plan || 'free'),
          enterprise_access: isEnterpriseUser
        },
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at
        }
      })
    };

  } catch (error) {
    console.error('Login error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Login failed' })
    };
  }
}

// VERIFY EMAIL
async function verifyEmail(body, headers) {
  try {
    const { token, type } = body;

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: type || 'signup'
    });

    if (error) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: error.message })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Email verified successfully',
        user: data.user
      })
    };

  } catch (error) {
    console.error('Email verification error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Email verification failed' })
    };
  }
}

// RESET PASSWORD
async function resetPassword(body, headers) {
  try {
    const { email } = body;

    if (!email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email is required' })
      };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.toLowerCase().trim(),
      {
        redirectTo: `${process.env.FRONTEND_URL || 'https://socialtrust.netlify.app'}/reset-password`
      }
    );

    if (error) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: error.message })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Password reset email sent. Please check your inbox.'
      })
    };

  } catch (error) {
    console.error('Password reset error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Password reset failed' })
    };
  }
}

// GET USER PROFILE
async function getUserProfile(body, headers) {
  try {
    const { user_id, email } = body;

    if (!user_id && !email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'User ID or email is required' })
      };
    }

    const query = supabase.from('user_profiles').select('*');
    
    if (user_id) {
      query.eq('user_id', user_id);
    } else {
      query.eq('email', email.toLowerCase());
    }

    const { data: profile, error } = await query.single();

    if (error) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Profile not found' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        profile: profile
      })
    };

  } catch (error) {
    console.error('Get profile error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to get profile' })
    };
  }
}

// CHECK ENTERPRISE ACCESS
async function checkEnterpriseAccess(body, headers) {
  try {
    const { email } = body;

    if (!email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email is required' })
      };
    }

    const hasEnterpriseAccess = ENTERPRISE_USERS.includes(email.toLowerCase());

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        enterprise_access: hasEnterpriseAccess,
        user_email: email.toLowerCase()
      })
    };

  } catch (error) {
    console.error('Enterprise access check error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Access check failed' })
    };
  }
}

// CHECK SESSION VALIDITY
async function checkSession(body, headers) {
  try {
    const { session_token } = body;

    if (!session_token) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Session token required' })
      };
    }

    // Get user from session token
    const { data: session, error: sessionError } = await supabase.auth.getUser(session_token);
    
    if (sessionError || !session.user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'Invalid session' })
      };
    }

    // Get user profile from database
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
    }

    const userData = {
      id: session.user.id,
      email: session.user.email,
      name: profile?.full_name || session.user.user_metadata?.full_name,
      plan: profile?.subscription_plan || 'free',
      company: profile?.company_name,
      enterprise_access: ENTERPRISE_USERS.includes(session.user.email.toLowerCase())
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        user: userData,
        session_token: session_token
      })
    };

  } catch (error) {
    console.error('Session check error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Session check failed' })
    };
  }
}

// LOGOUT USER
async function logoutUser(body, headers) {
  try {
    const { session_token } = body;

    if (session_token) {
      // Invalidate session in Supabase
      await supabase.auth.admin.signOut(session_token);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Logout successful'
      })
    };

  } catch (error) {
    console.error('Logout error:', error);
    return {
      statusCode: 200, // Return success even if logout fails
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Logout completed'
      })
    };
  }
}