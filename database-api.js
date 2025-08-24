// Database API wrapper using Netlify Functions for SocialTrust reviews
// Handles all database operations through serverless backend

const dbAPI = {
    
    // Save a review using Netlify Functions
    async saveReview(reviewData) {
        try {
            const response = await fetch('/.netlify/functions/api-reviews', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    businessName: reviewData.businessName,
                    platform: reviewData.platform,
                    profileUrl: reviewData.profileUrl,
                    rating: reviewData.rating,
                    comment: reviewData.comment,
                    userName: reviewData.user,
                    userEmail: reviewData.userEmail
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('✅ Review saved via API:', result.review.id);
                return {
                    success: true,
                    review: result.review
                };
            } else {
                throw new Error(result.error || 'Failed to save review');
            }
            
        } catch (error) {
            console.error('❌ Error saving review:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    
    // Get reviews with filters using Netlify Functions
    async getReviews(filters = {}) {
        try {
            const params = new URLSearchParams();
            
            if (filters.platform && filters.platform !== 'all') {
                params.append('platform', filters.platform);
            }
            
            if (filters.search) {
                params.append('search', filters.search);
            }
            
            params.append('limit', '50');
            params.append('offset', '0');
            
            const response = await fetch(`/.netlify/functions/api-reviews?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log(`✅ Fetched ${result.reviews.length} reviews via API`);
                return {
                    success: true,
                    reviews: result.reviews
                };
            } else {
                throw new Error(result.error || 'Failed to fetch reviews');
            }
            
        } catch (error) {
            console.error('❌ Error fetching reviews:', error);
            return {
                success: false,
                error: error.message,
                reviews: []
            };
        }
    },
    
    // Get global statistics using Netlify Functions
    async getGlobalStats() {
        try {
            const response = await fetch('/.netlify/functions/api-stats', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('✅ Global stats fetched via API:', result.stats);
                return {
                    success: true,
                    stats: result.stats
                };
            } else {
                throw new Error(result.error || 'Failed to fetch stats');
            }
            
        } catch (error) {
            console.error('❌ Error fetching stats:', error);
            return {
                success: false,
                error: error.message,
                stats: {
                    totalReviews: 0,
                    totalBusinesses: 0,
                    avgRating: 0,
                    activePlatforms: 0
                }
            };
        }
    },
    
    // Initialize database schema
    async setupDatabase() {
        try {
            const response = await fetch('/.netlify/functions/setup-database', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('✅ Database setup completed');
                return { success: true };
            } else {
                throw new Error(result.error || 'Failed to setup database');
            }
            
        } catch (error) {
            console.error('❌ Error setting up database:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
};