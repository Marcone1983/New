// Add sample businesses to database for testing
// Call this function to populate the database with some test data

async function addSampleBusinesses() {
    console.log('➕ Adding sample businesses to database...');
    
    const sampleBusinesses = [
        {
            name: 'GrowVerse',
            platform: 'instagram',
            profile_url: 'https://instagram.com/growverse',
            verified: true,
            follower_count: 15000,
            description: 'Digital marketing agency specializing in growth strategies',
            category: 'marketing'
        },
        {
            name: 'GrowVerse',
            platform: 'linkedin',
            profile_url: 'https://www.linkedin.com/company/growverse',
            verified: true,
            follower_count: 8500,
            description: 'Professional digital marketing services',
            category: 'marketing'
        },
        {
            name: 'TechFlow Solutions',
            platform: 'linkedin',
            profile_url: 'https://www.linkedin.com/company/techflow-solutions',
            verified: true,
            follower_count: 12000,
            description: 'Enterprise software solutions',
            category: 'technology'
        },
        {
            name: 'Pizza Corner',
            platform: 'facebook',
            profile_url: 'https://facebook.com/pizzacorner',
            verified: false,
            follower_count: 2500,
            description: 'Authentic Italian pizza restaurant',
            category: 'restaurant'
        },
        {
            name: 'FitLife Gym',
            platform: 'instagram',
            profile_url: 'https://instagram.com/fitlifegym',
            verified: true,
            follower_count: 8900,
            description: '24/7 fitness center with personal trainers',
            category: 'fitness'
        }
    ];

    let successCount = 0;
    let errorCount = 0;

    for (const business of sampleBusinesses) {
        try {
            const { data, error } = await supabaseClient
                .from('businesses')
                .upsert([business], { 
                    onConflict: 'name,platform',
                    ignoreDuplicates: false 
                })
                .select();

            if (error) {
                console.error(`❌ Error adding ${business.name} on ${business.platform}:`, error);
                errorCount++;
            } else {
                console.log(`✅ Added ${business.name} on ${business.platform}`);
                successCount++;
            }
        } catch (error) {
            console.error(`❌ Exception adding ${business.name}:`, error);
            errorCount++;
        }
    }

    console.log(`\n📊 Sample businesses added: ${successCount} success, ${errorCount} errors`);
    
    return {
        success: successCount > 0,
        added: successCount,
        errors: errorCount,
        total: sampleBusinesses.length
    };
}

// Export for use in console or other scripts
window.addSampleBusinesses = addSampleBusinesses;

// Auto-run after a delay to ensure database is ready
setTimeout(() => {
    if (window.confirm('Vuoi aggiungere alcune aziende di esempio al database per testare la ricerca?')) {
        addSampleBusinesses();
    }
}, 2000);