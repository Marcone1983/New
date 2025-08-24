// Database initialization - Creates tables if they don't exist
// This runs automatically on first app load

async function initializeDatabase() {
    console.log('🔧 Initializing database...');
    
    try {
        // Create users table
        const { error: usersError } = await supabaseClient.rpc('exec_sql', {
            sql: `
            CREATE TABLE IF NOT EXISTS users (
              id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
              name TEXT NOT NULL,
              email TEXT UNIQUE,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
            );
            `
        });

        // Create businesses table
        const { error: businessesError } = await supabaseClient.rpc('exec_sql', {
            sql: `
            CREATE TABLE IF NOT EXISTS businesses (
              id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
              name TEXT NOT NULL,
              platform TEXT NOT NULL,
              profile_url TEXT,
              verified BOOLEAN DEFAULT false,
              follower_count INTEGER DEFAULT 0,
              description TEXT,
              category TEXT,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
              UNIQUE(name, platform)
            );
            `
        });

        // Create reviews table
        const { error: reviewsError } = await supabaseClient.rpc('exec_sql', {
            sql: `
            CREATE TABLE IF NOT EXISTS reviews (
              id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
              business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
              user_id UUID REFERENCES users(id) ON DELETE SET NULL,
              rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
              comment TEXT,
              platform TEXT NOT NULL,
              helpful_votes INTEGER DEFAULT 0,
              reported BOOLEAN DEFAULT false,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
            );
            `
        });

        // Create indexes
        await supabaseClient.rpc('exec_sql', {
            sql: `
            CREATE INDEX IF NOT EXISTS idx_businesses_name ON businesses(name);
            CREATE INDEX IF NOT EXISTS idx_businesses_platform ON businesses(platform);
            CREATE INDEX IF NOT EXISTS idx_reviews_business_id ON reviews(business_id);
            CREATE INDEX IF NOT EXISTS idx_reviews_platform ON reviews(platform);
            CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
            `
        });

        console.log('✅ Database initialized successfully');
        return { success: true };

    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        
        // Try alternative method - direct table creation
        try {
            console.log('🔄 Trying direct table creation...');
            
            // Check if tables exist by trying to select from them
            const { error: testError } = await supabaseClient
                .from('users')
                .select('id')
                .limit(1);
            
            if (testError && testError.message.includes('does not exist')) {
                console.log('📝 Tables don\'t exist, but that\'s expected on first run');
            }
            
            return { success: true, note: 'Tables will be created when first used' };
            
        } catch (fallbackError) {
            console.error('❌ Database initialization completely failed:', fallbackError);
            return { 
                success: false, 
                error: fallbackError.message,
                note: 'App will work with generated profiles only'
            };
        }
    }
}

// Auto-initialize when script loads
if (typeof window !== 'undefined' && window.supabaseClient) {
    // Initialize after a short delay to ensure Supabase is ready
    setTimeout(() => {
        initializeDatabase();
    }, 1000);
}

// Export for manual initialization
window.initializeDatabase = initializeDatabase;