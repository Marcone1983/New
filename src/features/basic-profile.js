/**
 * PROFILO BASE - Pagina aziendale pubblica
 * Funzionalità: Pagina aziendale pubblica
 */

class BasicProfile {
  constructor(dbAPI, businessId) {
    this.dbAPI = dbAPI;
    this.businessId = businessId;
    this.profileData = null;
    this.isPublic = true;
  }

  // Inizializza profilo base
  async initializeProfile(businessData) {
    try {
      const profileConfig = {
        business_id: this.businessId,
        name: businessData.name,
        description: businessData.description || '',
        category: businessData.category || 'Business',
        location: businessData.location || '',
        website: businessData.website || '',
        phone: businessData.phone || '',
        email: businessData.email || '',
        social_links: businessData.socialLinks || {},
        is_public: true,
        profile_type: 'basic',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await this.dbAPI.createOrUpdateBusinessProfile(profileConfig);
      
      if (result.success) {
        this.profileData = result.profile;
        await this.generatePublicURL();
        
        return {
          success: true,
          profile: this.profileData,
          public_url: this.getPublicURL(),
          message: 'Profilo base creato con successo'
        };
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      console.error('Errore inizializzazione profilo base:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Genera URL pubblico per il profilo
  async generatePublicURL() {
    const slug = this.generateSlug(this.profileData.name);
    this.publicURL = `/profile/${slug}`;
    
    // Salva URL nel database
    await this.dbAPI.updateBusinessProfile(this.businessId, {
      public_url: this.publicURL,
      slug: slug
    });
    
    return this.publicURL;
  }

  // Genera slug per URL
  generateSlug(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  // Ottieni URL pubblico
  getPublicURL() {
    return this.publicURL || `/profile/${this.businessId}`;
  }

  // Ottieni dati profilo pubblico
  async getPublicProfileData() {
    try {
      if (!this.profileData) {
        const result = await this.dbAPI.getBusinessProfile(this.businessId);
        if (!result.success) {
          throw new Error('Profilo non trovato');
        }
        this.profileData = result.profile;
      }

      // Dati pubblici (filtrati per privacy)
      const publicData = {
        name: this.profileData.name,
        description: this.profileData.description,
        category: this.profileData.category,
        location: this.profileData.location,
        website: this.profileData.website,
        social_links: this.profileData.social_links,
        public_url: this.getPublicURL(),
        profile_type: 'basic',
        reviews_summary: await this.getReviewsSummary(),
        last_updated: this.profileData.updated_at
      };

      return {
        success: true,
        profile: publicData
      };

    } catch (error) {
      console.error('Errore caricamento profilo pubblico:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Ottieni summary delle recensioni per il profilo pubblico
  async getReviewsSummary() {
    try {
      const stats = await this.dbAPI.getBusinessStats(this.businessId);
      
      if (stats.success) {
        return {
          total_reviews: stats.stats.totalReviews,
          average_rating: stats.stats.avgRating,
          rating_distribution: stats.stats.ratingDistribution || {},
          recent_reviews: stats.stats.recentReviews || []
        };
      }

      return {
        total_reviews: 0,
        average_rating: 0,
        rating_distribution: {},
        recent_reviews: []
      };

    } catch (error) {
      console.error('Errore caricamento summary recensioni:', error);
      return {
        total_reviews: 0,
        average_rating: 0,
        rating_distribution: {},
        recent_reviews: []
      };
    }
  }

  // Genera HTML per pagina profilo pubblico
  generatePublicProfileHTML() {
    if (!this.profileData) {
      return '<div class="error">Profilo non disponibile</div>';
    }

    return `
      <div class="basic-profile-page">
        <div class="profile-header">
          <div class="business-info">
            <h1 class="business-name">${this.profileData.name}</h1>
            <p class="business-category">${this.profileData.category}</p>
            <p class="business-location">📍 ${this.profileData.location}</p>
          </div>
        </div>

        <div class="profile-content">
          <div class="about-section">
            <h2>Chi Siamo</h2>
            <p>${this.profileData.description || 'Descrizione non disponibile.'}</p>
          </div>

          <div class="contact-info">
            <h2>Contatti</h2>
            <div class="contact-details">
              ${this.profileData.website ? `<p>🌐 <a href="${this.profileData.website}" target="_blank">Sito Web</a></p>` : ''}
              ${this.profileData.phone ? `<p>📞 ${this.profileData.phone}</p>` : ''}
              ${this.profileData.email ? `<p>📧 ${this.profileData.email}</p>` : ''}
            </div>
          </div>

          <div class="social-links">
            <h2>Social Media</h2>
            <div class="social-icons">
              ${this.generateSocialLinksHTML()}
            </div>
          </div>

          <div class="reviews-section">
            <h2>Recensioni</h2>
            <div id="reviews-summary" class="reviews-summary">
              <!-- Caricato dinamicamente -->
            </div>
          </div>
        </div>

        <div class="profile-footer">
          <p>Pagina generata da SocialTrust - Profilo Base</p>
        </div>
      </div>

      <style>
        .basic-profile-page {
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .profile-header {
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: white;
          padding: 2rem;
          border-radius: 15px;
          margin-bottom: 2rem;
        }

        .business-name {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }

        .business-category {
          font-size: 1.1rem;
          opacity: 0.9;
        }

        .business-location {
          font-size: 1rem;
          margin-top: 0.5rem;
        }

        .profile-content {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2rem;
        }

        .about-section, .contact-info, .social-links, .reviews-section {
          background: white;
          padding: 1.5rem;
          border-radius: 10px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .about-section h2, .contact-info h2, .social-links h2, .reviews-section h2 {
          color: #4f46e5;
          margin-bottom: 1rem;
        }

        .contact-details p {
          margin: 0.5rem 0;
        }

        .contact-details a {
          color: #4f46e5;
          text-decoration: none;
        }

        .contact-details a:hover {
          text-decoration: underline;
        }

        .social-icons {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .social-icons a {
          padding: 0.5rem 1rem;
          background: #f3f4f6;
          border-radius: 8px;
          text-decoration: none;
          color: #374151;
          transition: background 0.2s;
        }

        .social-icons a:hover {
          background: #e5e7eb;
        }

        .profile-footer {
          text-align: center;
          margin-top: 2rem;
          color: #6b7280;
          font-size: 0.9rem;
        }

        @media (min-width: 768px) {
          .profile-content {
            grid-template-columns: 2fr 1fr;
          }

          .about-section, .reviews-section {
            grid-column: 1;
          }

          .contact-info, .social-links {
            grid-column: 2;
          }
        }
      </style>
    `;
  }

  // Genera HTML per social links
  generateSocialLinksHTML() {
    if (!this.profileData.social_links) return '';

    const socialLinks = this.profileData.social_links;
    let html = '';

    const platforms = {
      facebook: { name: 'Facebook', icon: 'f' },
      instagram: { name: 'Instagram', icon: '📷' },
      linkedin: { name: 'LinkedIn', icon: 'in' },
      twitter: { name: 'X', icon: '𝕏' },
      tiktok: { name: 'TikTok', icon: '♪' }
    };

    Object.entries(socialLinks).forEach(([platform, url]) => {
      if (url && platforms[platform]) {
        html += `<a href="${url}" target="_blank" rel="noopener">
          ${platforms[platform].icon} ${platforms[platform].name}
        </a>`;
      }
    });

    return html || '<p>Nessun social media collegato</p>';
  }

  // Aggiorna profilo base
  async updateProfile(updateData) {
    try {
      const result = await this.dbAPI.updateBusinessProfile(this.businessId, {
        ...updateData,
        updated_at: new Date().toISOString()
      });

      if (result.success) {
        this.profileData = { ...this.profileData, ...updateData };
        
        return {
          success: true,
          profile: this.profileData,
          message: 'Profilo aggiornato con successo'
        };
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      console.error('Errore aggiornamento profilo:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Statistiche profilo base
  getProfileStats() {
    return {
      feature: 'Profilo Base',
      status: 'active',
      is_public: this.isPublic,
      public_url: this.getPublicURL(),
      last_updated: this.profileData?.updated_at
    };
  }
}

// Export per uso in altri moduli
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BasicProfile;
} else {
  window.BasicProfile = BasicProfile;
}