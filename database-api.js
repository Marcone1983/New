// Database API functions for SocialTrust
class DatabaseAPI {
  constructor() {
    this.supabase = supabaseClient;
  }

  // User management
  async createUser(userData) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .insert([userData])
        .select()
        .single();
      
      if (error) throw error;
      return { success: true, user: data };
    } catch (error) {
      console.error('Error creating user:', error);
      return { success: false, error: error.message };
    }
  }

  async getUserByName(name) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('name', name)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return { success: true, user: data };
    } catch (error) {
      console.error('Error getting user:', error);
      return { success: false, error: error.message };
    }
  }

  // Business management
  async createBusiness(businessData) {
    try {
      const { data, error } = await this.supabase
        .from('businesses')
        .upsert([businessData], { 
          onConflict: 'name,platform',
          ignoreDuplicates: false 
        })
        .select()
        .single();
      
      if (error) throw error;
      return { success: true, business: data };
    } catch (error) {
      console.error('Error creating business:', error);
      return { success: false, error: error.message };
    }
  }

  async searchBusinesses(query, platform = null) {
    try {
      let queryBuilder = this.supabase
        .from('businesses')
        .select('*')
        .ilike('name', `%${query}%`);

      if (platform && platform !== 'all') {
        queryBuilder = queryBuilder.eq('platform', platform);
      }

      const { data, error } = await queryBuilder
        .order('name')
        .limit(50);
      
      if (error) throw error;
      return { success: true, businesses: data };
    } catch (error) {
      console.error('Error searching businesses:', error);
      return { success: false, error: error.message };
    }
  }

  // Review management
  async createReview(reviewData) {
    try {
      const { data, error } = await this.supabase
        .from('reviews')
        .insert([reviewData])
        .select(`
          *,
          businesses!inner(name, platform, profile_url),
          users!inner(name)
        `)
        .single();
      
      if (error) throw error;
      return { success: true, review: data };
    } catch (error) {
      console.error('Error creating review:', error);
      return { success: false, error: error.message };
    }
  }

  async getReviews(filters = {}) {
    try {
      let queryBuilder = this.supabase
        .from('reviews')
        .select(`
          *,
          businesses!inner(name, platform, profile_url),
          users!inner(name)
        `);

      if (filters.platform && filters.platform !== 'all') {
        queryBuilder = queryBuilder.eq('platform', filters.platform);
      }

      if (filters.businessId) {
        queryBuilder = queryBuilder.eq('business_id', filters.businessId);
      }

      if (filters.search) {
        queryBuilder = queryBuilder.or(
          `businesses.name.ilike.%${filters.search}%,comment.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await queryBuilder
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return { success: true, reviews: data };
    } catch (error) {
      console.error('Error getting reviews:', error);
      return { success: false, error: error.message };
    }
  }

  async getBusinessStats(businessId) {
    try {
      const { data, error } = await this.supabase
        .from('reviews')
        .select('rating')
        .eq('business_id', businessId);
      
      if (error) throw error;
      
      const totalReviews = data.length;
      const avgRating = totalReviews > 0 
        ? data.reduce((sum, review) => sum + review.rating, 0) / totalReviews 
        : 0;

      return { 
        success: true, 
        stats: { 
          totalReviews, 
          avgRating: Math.round(avgRating * 10) / 10 
        } 
      };
    } catch (error) {
      console.error('Error getting business stats:', error);
      return { success: false, error: error.message };
    }
  }

  async getGlobalStats() {
    try {
      const [reviewsResult, businessesResult] = await Promise.all([
        this.supabase.from('reviews').select('rating'),
        this.supabase.from('businesses').select('id')
      ]);

      if (reviewsResult.error) throw reviewsResult.error;
      if (businessesResult.error) throw businessesResult.error;

      const totalReviews = reviewsResult.data.length;
      const totalBusinesses = businessesResult.data.length;
      const avgRating = totalReviews > 0 
        ? reviewsResult.data.reduce((sum, review) => sum + review.rating, 0) / totalReviews 
        : 0;

      return {
        success: true,
        stats: {
          totalReviews,
          totalBusinesses,
          avgRating: Math.round(avgRating * 10) / 10,
          activePlatforms: 5
        }
      };
    } catch (error) {
      console.error('Error getting global stats:', error);
      return { success: false, error: error.message };
    }
  }
}

// Initialize database API
const dbAPI = new DatabaseAPI();