// Business Database Management System
// CRUD operations for business profiles, contacts, and data management
const { createClient } = require('@supabase/supabase-js');
const { checkAndTrackUsage, getOrganizationByEmail, USAGE_METRICS } = require('./usage-tracker');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path.replace('/.netlify/functions/business-database', '');
  
  try {
    switch (path) {
      // Business Profile Management
      case '/create-business':
        return await createBusinessProfile(event, headers);
      
      case '/update-business':
        return await updateBusinessProfile(event, headers);
      
      case '/get-business':
        return await getBusinessProfile(event, headers);
      
      case '/list-businesses':
        return await listBusinessProfiles(event, headers);
      
      case '/delete-business':
        return await deleteBusinessProfile(event, headers);
      
      // Contact Management
      case '/add-contact':
        return await addBusinessContact(event, headers);
      
      case '/update-contact':
        return await updateBusinessContact(event, headers);
      
      case '/list-contacts':
        return await listBusinessContacts(event, headers);
      
      case '/delete-contact':
        return await deleteBusinessContact(event, headers);
      
      case '/import-contacts':
        return await importBulkContacts(event, headers);
      
      // Business Intelligence
      case '/enrich-business':
        return await enrichBusinessData(event, headers);
      
      case '/verify-business':
        return await verifyBusinessDetails(event, headers);
      
      case '/merge-duplicates':
        return await mergeDuplicateBusinesses(event, headers);
        
      default:
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Business database endpoint not found' })
        };
    }
  } catch (error) {
    console.error('Business Database error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Create new business profile
async function createBusinessProfile(event, headers) {
  const { 
    business_name,
    industry,
    website,
    phone,
    email,
    address,
    description,
    social_media_links,
    user_email
  } = JSON.parse(event.body || '{}');
  
  if (!business_name || !user_email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'business_name and user_email are required' })
    };
  }

  console.log(`🏢 Creating business profile: "${business_name}" by ${user_email}`);

  const org = await getOrganizationByEmail(user_email);
  if (!org) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not get user organization' })
    };
  }

  // Check if business already exists
  const { data: existingBusiness } = await supabase
    .from('business_profiles')
    .select('id')
    .eq('organization_id', org.id)
    .eq('business_name', business_name)
    .single();

  if (existingBusiness) {
    return {
      statusCode: 409,
      headers,
      body: JSON.stringify({ 
        error: 'Business already exists',
        existing_business_id: existingBusiness.id
      })
    };
  }

  // Create business profile
  const { data: business, error } = await supabase
    .from('business_profiles')
    .insert({
      organization_id: org.id,
      business_name,
      industry,
      website,
      phone,
      email,
      address,
      description,
      social_media_links: social_media_links || {},
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating business:', error);
    throw error;
  }

  // Initialize business stats
  await supabase
    .from('business_statistics')
    .insert({
      business_id: business.id,
      organization_id: org.id,
      total_reviews: 0,
      avg_rating: 0,
      total_invites_sent: 0,
      response_rate: 0,
      last_review_date: null,
      created_at: new Date().toISOString()
    });

  console.log(`✅ Business profile created: ${business_name} (ID: ${business.id})`);

  return {
    statusCode: 201,
    headers,
    body: JSON.stringify({
      success: true,
      business: {
        ...business,
        statistics: {
          total_reviews: 0,
          avg_rating: 0,
          total_invites_sent: 0,
          response_rate: 0
        }
      }
    })
  };
}

// Update business profile
async function updateBusinessProfile(event, headers) {
  const { business_id, updates, user_email } = JSON.parse(event.body || '{}');
  
  if (!business_id || !user_email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'business_id and user_email are required' })
    };
  }

  const org = await getOrganizationByEmail(user_email);
  if (!org) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not get user organization' })
    };
  }

  // Verify business ownership
  const { data: business, error: findError } = await supabase
    .from('business_profiles')
    .select('*')
    .eq('id', business_id)
    .eq('organization_id', org.id)
    .single();

  if (findError || !business) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Business not found or access denied' })
    };
  }

  // Update business
  const { data: updatedBusiness, error } = await supabase
    .from('business_profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', business_id)
    .eq('organization_id', org.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating business:', error);
    throw error;
  }

  console.log(`✅ Business profile updated: ${updatedBusiness.business_name}`);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      business: updatedBusiness
    })
  };
}

// Get business profile with statistics
async function getBusinessProfile(event, headers) {
  const { business_id, user_email } = event.queryStringParameters || {};
  
  if (!business_id || !user_email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'business_id and user_email parameters required' })
    };
  }

  const org = await getOrganizationByEmail(user_email);
  if (!org) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not get user organization' })
    };
  }

  // Get business with statistics
  const [businessResult, statsResult, contactsResult, reviewsResult] = await Promise.all([
    supabase
      .from('business_profiles')
      .select('*')
      .eq('id', business_id)
      .eq('organization_id', org.id)
      .single(),
    
    supabase
      .from('business_statistics')
      .select('*')
      .eq('business_id', business_id)
      .single(),
    
    supabase
      .from('business_contacts')
      .select('*')
      .eq('business_id', business_id)
      .order('created_at', { ascending: false })
      .limit(5),
    
    supabase
      .from('review_invites')
      .select('*')
      .eq('business_id', business_id)
      .order('sent_at', { ascending: false })
      .limit(5)
  ]);

  if (businessResult.error || !businessResult.data) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Business not found or access denied' })
    };
  }

  const business = businessResult.data;
  const stats = statsResult.data || {};
  const recentContacts = contactsResult.data || [];
  const recentReviews = reviewsResult.data || [];

  // Calculate additional metrics
  const totalContacts = recentContacts.length;
  const activeContacts = recentContacts.filter(c => c.status === 'active').length;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      business: {
        ...business,
        statistics: {
          ...stats,
          total_contacts: totalContacts,
          active_contacts: activeContacts,
          last_activity: business.updated_at
        },
        recent_contacts: recentContacts,
        recent_reviews: recentReviews
      }
    })
  };
}

// List all businesses for organization
async function listBusinessProfiles(event, headers) {
  const { user_email, page = '1', limit = '20', search = '' } = event.queryStringParameters || {};
  
  if (!user_email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'user_email parameter required' })
    };
  }

  const org = await getOrganizationByEmail(user_email);
  if (!org) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not get user organization' })
    };
  }

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  let query = supabase
    .from('business_profiles')
    .select(`
      *,
      business_statistics(*)
    `)
    .eq('organization_id', org.id);

  if (search) {
    query = query.or(`business_name.ilike.%${search}%,industry.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data: businesses, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limitNum - 1);

  if (error) {
    throw error;
  }

  // Get total count for pagination
  let countQuery = supabase
    .from('business_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', org.id);

  if (search) {
    countQuery = countQuery.or(`business_name.ilike.%${search}%,industry.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { count } = await countQuery;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      businesses: businesses || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limitNum)
      },
      search_term: search
    })
  };
}

// Add business contact
async function addBusinessContact(event, headers) {
  const {
    business_id,
    name,
    email,
    phone,
    role,
    is_primary,
    user_email
  } = JSON.parse(event.body || '{}');
  
  if (!business_id || !name || !email || !user_email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'business_id, name, email, and user_email are required' })
    };
  }

  const org = await getOrganizationByEmail(user_email);
  if (!org) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not get user organization' })
    };
  }

  // Verify business ownership
  const { data: business, error: businessError } = await supabase
    .from('business_profiles')
    .select('id, business_name')
    .eq('id', business_id)
    .eq('organization_id', org.id)
    .single();

  if (businessError || !business) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Business not found or access denied' })
    };
  }

  // If this is primary contact, unset other primary contacts
  if (is_primary) {
    await supabase
      .from('business_contacts')
      .update({ is_primary: false })
      .eq('business_id', business_id);
  }

  // Create contact
  const { data: contact, error } = await supabase
    .from('business_contacts')
    .insert({
      business_id,
      organization_id: org.id,
      name,
      email,
      phone,
      role,
      is_primary: !!is_primary,
      status: 'active',
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating contact:', error);
    throw error;
  }

  console.log(`✅ Contact added: ${name} for ${business.business_name}`);

  return {
    statusCode: 201,
    headers,
    body: JSON.stringify({
      success: true,
      contact
    })
  };
}

// List business contacts
async function listBusinessContacts(event, headers) {
  const { business_id, user_email } = event.queryStringParameters || {};
  
  if (!business_id || !user_email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'business_id and user_email parameters required' })
    };
  }

  const org = await getOrganizationByEmail(user_email);
  if (!org) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not get user organization' })
    };
  }

  // Verify business ownership
  const { data: business, error: businessError } = await supabase
    .from('business_profiles')
    .select('id, business_name')
    .eq('id', business_id)
    .eq('organization_id', org.id)
    .single();

  if (businessError || !business) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Business not found or access denied' })
    };
  }

  // Get contacts with invitation stats
  const { data: contacts, error } = await supabase
    .from('business_contacts')
    .select(`
      *,
      review_invites!inner(count)
    `)
    .eq('business_id', business_id)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      business_name: business.business_name,
      contacts: contacts || [],
      summary: {
        total_contacts: contacts?.length || 0,
        active_contacts: contacts?.filter(c => c.status === 'active').length || 0,
        primary_contact: contacts?.find(c => c.is_primary) || null
      }
    })
  };
}

// Import bulk contacts
async function importBulkContacts(event, headers) {
  const { business_id, contacts, user_email } = JSON.parse(event.body || '{}');
  
  if (!business_id || !contacts || !Array.isArray(contacts) || !user_email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'business_id, contacts array, and user_email are required' })
    };
  }

  console.log(`📥 Bulk contact import: ${contacts.length} contacts for business ${business_id}`);

  const org = await getOrganizationByEmail(user_email);
  if (!org) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not get user organization' })
    };
  }

  // Verify business ownership
  const { data: business, error: businessError } = await supabase
    .from('business_profiles')
    .select('id, business_name')
    .eq('id', business_id)
    .eq('organization_id', org.id)
    .single();

  if (businessError || !business) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Business not found or access denied' })
    };
  }

  // Validate and prepare contacts
  const validContacts = [];
  const errors = [];

  contacts.forEach((contact, index) => {
    if (!contact.name || !contact.email) {
      errors.push(`Contact ${index + 1}: name and email are required`);
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contact.email)) {
      errors.push(`Contact ${index + 1}: invalid email format`);
      return;
    }

    validContacts.push({
      business_id,
      organization_id: org.id,
      name: contact.name,
      email: contact.email.toLowerCase(),
      phone: contact.phone || null,
      role: contact.role || 'Customer',
      is_primary: false,
      status: 'active',
      created_at: new Date().toISOString(),
      import_batch: generateBatchId()
    });
  });

  if (errors.length > 0 && validContacts.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'No valid contacts to import',
        validation_errors: errors
      })
    };
  }

  // Import valid contacts
  const { data: importedContacts, error } = await supabase
    .from('business_contacts')
    .insert(validContacts)
    .select();

  if (error) {
    console.error('Error importing contacts:', error);
    throw error;
  }

  console.log(`✅ Bulk import completed: ${importedContacts.length} contacts imported for ${business.business_name}`);

  return {
    statusCode: 201,
    headers,
    body: JSON.stringify({
      success: true,
      import_summary: {
        total_submitted: contacts.length,
        successfully_imported: importedContacts.length,
        validation_errors: errors.length,
        business_name: business.business_name
      },
      validation_errors: errors,
      imported_contacts: importedContacts
    })
  };
}

// Enrich business data using external sources
async function enrichBusinessData(event, headers) {
  const { business_id, user_email } = JSON.parse(event.body || '{}');
  
  if (!business_id || !user_email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'business_id and user_email are required' })
    };
  }

  const org = await getOrganizationByEmail(user_email);
  if (!org) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not get user organization' })
    };
  }

  // Get business
  const { data: business, error: businessError } = await supabase
    .from('business_profiles')
    .select('*')
    .eq('id', business_id)
    .eq('organization_id', org.id)
    .single();

  if (businessError || !business) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Business not found or access denied' })
    };
  }

  // Simulate business enrichment (in real implementation, use external APIs)
  const enrichmentData = await simulateBusinessEnrichment(business);
  
  // Update business with enriched data
  const { data: updatedBusiness, error: updateError } = await supabase
    .from('business_profiles')
    .update({
      ...enrichmentData.updates,
      enrichment_data: enrichmentData.enrichment_data,
      enrichment_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', business_id)
    .eq('organization_id', org.id)
    .select()
    .single();

  if (updateError) {
    throw updateError;
  }

  console.log(`✅ Business enriched: ${business.business_name}`);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      business: updatedBusiness,
      enrichment_summary: enrichmentData.summary
    })
  };
}

// Simulate business enrichment
async function simulateBusinessEnrichment(business) {
  // Simulate API calls to external services for business data
  const enrichmentData = {
    company_size: generateCompanySize(),
    annual_revenue: generateRevenue(),
    industry_category: generateIndustryCategory(business.industry),
    social_media_metrics: generateSocialMetrics(),
    competitive_landscape: generateCompetitiveData(),
    market_presence_score: Math.floor(Math.random() * 100) + 1
  };

  return {
    updates: {
      industry_category: enrichmentData.industry_category,
      market_presence_score: enrichmentData.market_presence_score
    },
    enrichment_data: enrichmentData,
    summary: {
      data_points_added: 6,
      confidence_score: Math.floor(Math.random() * 40) + 60,
      last_updated: new Date().toISOString()
    }
  };
}

// Generate helper functions for simulation
function generateCompanySize() {
  const sizes = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];
  return sizes[Math.floor(Math.random() * sizes.length)];
}

function generateRevenue() {
  const ranges = ['<$1M', '$1M-$5M', '$5M-$25M', '$25M-$100M', '$100M+'];
  return ranges[Math.floor(Math.random() * ranges.length)];
}

function generateIndustryCategory(industry) {
  if (!industry) return 'General Business';
  
  const categories = {
    'technology': 'Technology & Software',
    'retail': 'Retail & E-commerce',
    'restaurant': 'Food & Beverage',
    'healthcare': 'Healthcare & Medical',
    'finance': 'Financial Services'
  };
  
  return categories[industry.toLowerCase()] || 'General Business';
}

function generateSocialMetrics() {
  return {
    facebook_followers: Math.floor(Math.random() * 10000),
    instagram_followers: Math.floor(Math.random() * 5000),
    twitter_followers: Math.floor(Math.random() * 3000),
    linkedin_followers: Math.floor(Math.random() * 2000)
  };
}

function generateCompetitiveData() {
  return {
    direct_competitors: Math.floor(Math.random() * 20) + 5,
    market_share_estimate: `${Math.floor(Math.random() * 15) + 1}%`,
    competitive_advantage: ['Price', 'Quality', 'Service', 'Innovation'][Math.floor(Math.random() * 4)]
  };
}

// Helper functions
function generateBatchId() {
  return 'batch_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}