/**
 * RECENSIONI ILLIMITATE - Sistema di raccolta recensioni senza limiti
 * Funzionalità: Raccogli recensioni senza limiti
 */

class UnlimitedReviews {
  constructor(dbAPI, userPlan = 'free') {
    this.dbAPI = dbAPI;
    this.userPlan = userPlan;
    this.reviewCache = new Map();
  }

  // Verifica se l'utente può aggiungere recensioni illimitate
  canAddUnlimitedReviews() {
    return true; // Tutti i piani hanno recensioni illimitate
  }

  // Raccolta recensione senza limiti
  async collectReview(reviewData) {
    try {
      // Validazione dati recensione
      if (!this.validateReviewData(reviewData)) {
        throw new Error('Dati recensione non validi');
      }

      // Creare recensione nel database
      const result = await this.dbAPI.createReview({
        business_id: reviewData.businessId,
        user_id: reviewData.userId,
        rating: reviewData.rating,
        comment: reviewData.comment,
        platform: reviewData.platform,
        review_date: new Date().toISOString(),
        status: 'active',
        metadata: {
          unlimited_plan: true,
          source: 'socialtrust',
          collected_at: new Date().toISOString()
        }
      });

      if (result.success) {
        // Aggiorna cache locale
        this.updateReviewCache(result.review);
        
        // Trigger eventi post-raccolta
        await this.triggerPostCollectionEvents(result.review);
        
        return {
          success: true,
          review: result.review,
          message: 'Recensione raccolta con successo - Nessun limite!'
        };
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      console.error('Errore raccolta recensione illimitata:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Raccolta recensioni in batch (senza limiti)
  async collectReviewsBatch(reviewsArray) {
    const results = [];
    
    for (const reviewData of reviewsArray) {
      const result = await this.collectReview(reviewData);
      results.push(result);
      
      // Piccola pausa per non sovraccaricare il sistema
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return {
      success: true,
      totalProcessed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results: results
    };
  }

  // Importa recensioni da piattaforme esterne (illimitato)
  async importFromExternalPlatform(platform, businessId, options = {}) {
    try {
      let importedReviews = [];

      switch (platform.toLowerCase()) {
        case 'google':
          importedReviews = await this.importFromGoogle(businessId, options);
          break;
        case 'facebook':
          importedReviews = await this.importFromFacebook(businessId, options);
          break;
        case 'linkedin':
          importedReviews = await this.importFromLinkedIn(businessId, options);
          break;
        case 'instagram':
          importedReviews = await this.importFromInstagram(businessId, options);
          break;
        default:
          throw new Error(`Piattaforma ${platform} non supportata`);
      }

      // Elabora tutte le recensioni importate (senza limiti)
      const batchResult = await this.collectReviewsBatch(importedReviews);

      return {
        success: true,
        platform: platform,
        imported: batchResult.successful,
        failed: batchResult.failed,
        message: `Importate ${batchResult.successful} recensioni da ${platform}`
      };

    } catch (error) {
      console.error(`Errore importazione da ${platform}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Validazione dati recensione
  validateReviewData(reviewData) {
    const required = ['businessId', 'userId', 'rating', 'platform'];
    
    for (const field of required) {
      if (!reviewData[field]) {
        console.error(`Campo obbligatorio mancante: ${field}`);
        return false;
      }
    }

    // Validazione rating
    if (reviewData.rating < 1 || reviewData.rating > 5) {
      console.error('Rating deve essere tra 1 e 5');
      return false;
    }

    return true;
  }

  // Aggiorna cache locale
  updateReviewCache(review) {
    const cacheKey = `${review.business_id}_${review.id}`;
    this.reviewCache.set(cacheKey, {
      ...review,
      cached_at: new Date().toISOString()
    });
  }

  // Eventi post-raccolta
  async triggerPostCollectionEvents(review) {
    try {
      // Notifica business proprietario
      await this.notifyBusinessOwner(review);
      
      // Aggiorna statistiche in tempo reale
      await this.updateReviewStatistics(review);
      
      // Trigger automazioni (se disponibili)
      await this.triggerAutomations(review);
      
    } catch (error) {
      console.error('Errore eventi post-raccolta:', error);
    }
  }

  // Notifica proprietario business
  async notifyBusinessOwner(review) {
    // Implementazione notifiche
    console.log(`📧 Notifica: Nuova recensione ${review.rating}⭐ per business ${review.business_id}`);
  }

  // Aggiorna statistiche
  async updateReviewStatistics(review) {
    try {
      // Aggiorna conteggi e medie in tempo reale
      const stats = await this.dbAPI.updateBusinessStats(review.business_id);
      console.log(`📊 Statistiche aggiornate per business ${review.business_id}`);
      return stats;
    } catch (error) {
      console.error('Errore aggiornamento statistiche:', error);
    }
  }

  // Trigger automazioni
  async triggerAutomations(review) {
    // Hook per Marketing Automation e AI Auto-Response
    if (window.marketingAutomation) {
      await window.marketingAutomation.processNewReview(review);
    }
    
    if (window.aiAutoResponse) {
      await window.aiAutoResponse.generateResponse(review);
    }
  }

  // Import methods per diverse piattaforme
  async importFromGoogle(businessId, options) {
    // Simulazione import Google Reviews
    return [
      {
        businessId: businessId,
        userId: 'google_user_1',
        rating: 5,
        comment: 'Servizio eccellente!',
        platform: 'google',
        external_id: 'google_review_001'
      }
    ];
  }

  async importFromFacebook(businessId, options) {
    // Simulazione import Facebook Reviews
    return [
      {
        businessId: businessId,
        userId: 'fb_user_1',
        rating: 4,
        comment: 'Molto soddisfatto',
        platform: 'facebook',
        external_id: 'fb_review_001'
      }
    ];
  }

  async importFromLinkedIn(businessId, options) {
    return [];
  }

  async importFromInstagram(businessId, options) {
    return [];
  }

  // Statistiche raccolta illimitata
  getCollectionStats() {
    return {
      feature: 'Recensioni Illimitate',
      status: 'active',
      unlimited: true,
      cached_reviews: this.reviewCache.size,
      last_collection: new Date().toISOString()
    };
  }
}

// Export per uso in altri moduli
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UnlimitedReviews;
} else {
  window.UnlimitedReviews = UnlimitedReviews;
}