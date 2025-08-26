/**
 * RISPONDI ALLE RECENSIONI - Sistema interazione clienti
 * Funzionalità: Interagisci con i clienti
 */

class ReviewResponses {
  constructor(dbAPI, businessId, userId) {
    this.dbAPI = dbAPI;
    this.businessId = businessId;
    this.userId = userId;
    this.responseTemplates = new Map();
    this.initializeTemplates();
  }

  // Inizializza template di risposta predefiniti
  initializeTemplates() {
    const templates = {
      positive_5_star: {
        template: "Grazie {customer_name} per la tua recensione a 5 stelle! ⭐⭐⭐⭐⭐ Siamo felici di averti fornito un'esperienza eccellente. Continueremo a lavorare per mantenere questo standard!",
        tone: 'enthusiastic',
        category: 'positive'
      },
      positive_4_star: {
        template: "Ciao {customer_name}, grazie per la tua recensione positiva! ⭐⭐⭐⭐ Apprezziamo il tuo feedback e continueremo a migliorare per meritare anche quella quinta stella!",
        tone: 'grateful',
        category: 'positive'
      },
      neutral_3_star: {
        template: "Ciao {customer_name}, grazie per il tuo feedback. ⭐⭐⭐ Ci piacerebbe sapere come possiamo migliorare la tua esperienza. Ti contattiamo privatamente per approfondire.",
        tone: 'constructive',
        category: 'neutral'
      },
      negative_2_star: {
        template: "Ciao {customer_name}, ci dispiace per l'esperienza non soddisfacente. ⭐⭐ Prendiamo molto seriamente il tuo feedback e vorremmo l'opportunità di migliorare. Ti contatteremo per risolvere la situazione.",
        tone: 'apologetic',
        category: 'negative'
      },
      negative_1_star: {
        template: "Ciao {customer_name}, siamo davvero dispiaciuti per la tua esperienza negativa. ⭐ Questo non riflette i nostri standard e vogliamo fare di tutto per rimediare. Un nostro responsabile ti contatterà al più presto.",
        tone: 'urgent_apologetic',
        category: 'negative'
      }
    };

    Object.entries(templates).forEach(([key, template]) => {
      this.responseTemplates.set(key, template);
    });
  }

  // Rispondi a una recensione
  async respondToReview(reviewId, responseData) {
    try {
      // Validazione permessi
      if (!await this.canRespondToReview(reviewId)) {
        throw new Error('Non hai i permessi per rispondere a questa recensione');
      }

      // Ottieni dati recensione
      const reviewResult = await this.dbAPI.getReview(reviewId);
      if (!reviewResult.success) {
        throw new Error('Recensione non trovata');
      }

      const review = reviewResult.review;
      
      // Prepara dati risposta
      const responsePayload = {
        review_id: reviewId,
        business_id: this.businessId,
        user_id: this.userId,
        response_text: responseData.text,
        response_type: responseData.type || 'manual',
        tone: responseData.tone || this.detectTone(responseData.text),
        is_public: responseData.isPublic !== false, // Default pubblico
        created_at: new Date().toISOString(),
        metadata: {
          original_rating: review.rating,
          response_method: responseData.method || 'manual',
          template_used: responseData.templateId || null
        }
      };

      // Salva risposta nel database
      const result = await this.dbAPI.createReviewResponse(responsePayload);
      
      if (result.success) {
        // Notifica il cliente (se configurato)
        if (responseData.notifyCustomer) {
          await this.notifyCustomerOfResponse(review, result.response);
        }

        // Pubblica risposta su piattaforma esterna (se possibile)
        if (responseData.publishToExternal) {
          await this.publishToExternalPlatform(review, result.response);
        }

        // Trigger eventi post-risposta
        await this.triggerPostResponseEvents(review, result.response);

        return {
          success: true,
          response: result.response,
          message: 'Risposta pubblicata con successo'
        };
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      console.error('Errore risposta recensione:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Genera risposta automatica suggerita
  async generateSuggestedResponse(reviewId, options = {}) {
    try {
      const reviewResult = await this.dbAPI.getReview(reviewId);
      if (!reviewResult.success) {
        throw new Error('Recensione non trovata');
      }

      const review = reviewResult.review;
      const rating = review.rating;
      const comment = review.comment || '';
      
      // Seleziona template basato sul rating
      let templateKey = this.selectTemplateByRating(rating);
      let template = this.responseTemplates.get(templateKey);

      // Personalizza il template
      let suggestedText = template.template;
      
      // Sostituzioni personalizzate
      const customerName = review.user_name || 'Cliente';
      suggestedText = suggestedText.replace('{customer_name}', customerName);
      
      // Aggiungi personalizzazioni basate sul commento
      if (comment.length > 0) {
        suggestedText = await this.personalizeBasedOnComment(suggestedText, comment, rating);
      }

      // Genera varianti alternative
      const alternatives = await this.generateAlternativeResponses(review, template);

      return {
        success: true,
        suggested_response: {
          text: suggestedText,
          tone: template.tone,
          category: template.category,
          template_id: templateKey,
          confidence_score: this.calculateConfidenceScore(review, template)
        },
        alternatives: alternatives,
        review_context: {
          rating: rating,
          has_comment: comment.length > 0,
          comment_sentiment: this.analyzeCommentSentiment(comment)
        }
      };

    } catch (error) {
      console.error('Errore generazione risposta suggerita:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Seleziona template basato sul rating
  selectTemplateByRating(rating) {
    switch (rating) {
      case 5: return 'positive_5_star';
      case 4: return 'positive_4_star';
      case 3: return 'neutral_3_star';
      case 2: return 'negative_2_star';
      case 1: return 'negative_1_star';
      default: return 'neutral_3_star';
    }
  }

  // Personalizza risposta basata sul commento
  async personalizeBasedOnComment(baseText, comment, rating) {
    // Analisi keywords nel commento
    const keywords = this.extractKeywords(comment.toLowerCase());
    
    // Aggiungi personalizzazioni specifiche
    if (keywords.includes('veloce') || keywords.includes('rapido')) {
      if (rating >= 4) {
        baseText += " Siamo contenti che tu abbia apprezzato la velocità del nostro servizio!";
      }
    }
    
    if (keywords.includes('staff') || keywords.includes('personale') || keywords.includes('servizio')) {
      if (rating >= 4) {
        baseText += " Il nostro team sarà felice di sapere che hai apprezzato il servizio!";
      } else if (rating <= 2) {
        baseText += " Condivideremo il tuo feedback con il nostro team per migliorare il servizio.";
      }
    }

    if (keywords.includes('prezzo') || keywords.includes('costo') || keywords.includes('economico')) {
      if (rating <= 2) {
        baseText += " Comprendiamo le tue preoccupazioni sui prezzi e saremo felici di discutere delle opzioni disponibili.";
      }
    }

    return baseText;
  }

  // Estrai keywords dal commento
  extractKeywords(text) {
    const commonWords = ['il', 'la', 'di', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra', 'a', 'e', 'o', 'ma', 'se', 'che', 'chi', 'cui', 'non', 'più', 'come', 'quando', 'dove', 'molto', 'tutto', 'anche', 'ancora', 'solo', 'già', 'sempre'];
    
    return text
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !commonWords.includes(word))
      .slice(0, 5); // Max 5 keywords
  }

  // Genera risposte alternative
  async generateAlternativeResponses(review, baseTemplate) {
    const alternatives = [];
    const rating = review.rating;
    
    // Versione più formale
    if (baseTemplate.tone !== 'formal') {
      const formalVersion = this.convertToFormalTone(baseTemplate.template);
      alternatives.push({
        text: formalVersion,
        tone: 'formal',
        label: 'Versione formale'
      });
    }

    // Versione più casual
    if (baseTemplate.tone !== 'casual') {
      const casualVersion = this.convertToCasualTone(baseTemplate.template);
      alternatives.push({
        text: casualVersion,
        tone: 'casual',
        label: 'Versione informale'
      });
    }

    // Versione breve
    const shortVersion = this.createShortVersion(baseTemplate.template, rating);
    alternatives.push({
      text: shortVersion,
      tone: 'concise',
      label: 'Versione breve'
    });

    return alternatives;
  }

  // Converte a tono formale
  convertToFormalTone(text) {
    return text
      .replace(/Ciao/g, 'Gentile')
      .replace(/Grazie/g, 'La ringraziamo')
      .replace(/ci dispiace/g, 'ci scusiamo')
      .replace(/continueremo/g, 'ci impegneremo a continuare')
      .replace(/!+/g, '.');
  }

  // Converte a tono casual
  convertToCasualTone(text) {
    return text
      .replace(/Gentile/g, 'Ciao')
      .replace(/La ringraziamo/g, 'Grazie mille')
      .replace(/ci scusiamo/g, 'ci dispiace davvero')
      .replace(/\./g, '! 😊');
  }

  // Crea versione breve
  createShortVersion(text, rating) {
    if (rating >= 4) {
      return "Grazie per la tua recensione positiva! ⭐ Continueremo a lavorare per offrirti il meglio!";
    } else if (rating === 3) {
      return "Grazie per il feedback. Ci piacerebbe sapere come migliorare!";
    } else {
      return "Ci dispiace per l'esperienza. Ti contatteremo per risolvere la situazione.";
    }
  }

  // Analizza sentiment del commento
  analyzeCommentSentiment(comment) {
    if (!comment) return 'neutral';
    
    const positiveWords = ['ottimo', 'eccellente', 'fantastico', 'perfetto', 'bravo', 'soddisfatto', 'consiglio'];
    const negativeWords = ['pessimo', 'terribile', 'orribile', 'male', 'sbagliato', 'deluso', 'insoddisfatto'];
    
    const lowerComment = comment.toLowerCase();
    
    const positiveCount = positiveWords.filter(word => lowerComment.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerComment.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  // Calcola punteggio di fiducia per il suggerimento
  calculateConfidenceScore(review, template) {
    let score = 0.7; // Base score
    
    // Rating alignment
    if (template.category === 'positive' && review.rating >= 4) score += 0.2;
    if (template.category === 'negative' && review.rating <= 2) score += 0.2;
    if (template.category === 'neutral' && review.rating === 3) score += 0.1;
    
    // Comment presence
    if (review.comment && review.comment.length > 20) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  // Verifica permessi di risposta
  async canRespondToReview(reviewId) {
    try {
      const reviewResult = await this.dbAPI.getReview(reviewId);
      if (!reviewResult.success) return false;
      
      const review = reviewResult.review;
      
      // Solo il business proprietario può rispondere
      return review.business_id === this.businessId;
    } catch (error) {
      console.error('Errore verifica permessi:', error);
      return false;
    }
  }

  // Rileva tono della risposta
  detectTone(text) {
    const formalWords = ['gentile', 'ringraziamo', 'scusiamo'];
    const casualWords = ['ciao', 'grazie', 'fantastico'];
    const apologeticWords = ['dispiace', 'scusa', 'dispiaciuti'];
    
    const lowerText = text.toLowerCase();
    
    if (formalWords.some(word => lowerText.includes(word))) return 'formal';
    if (apologeticWords.some(word => lowerText.includes(word))) return 'apologetic';
    if (casualWords.some(word => lowerText.includes(word))) return 'casual';
    
    return 'neutral';
  }

  // Notifica cliente della risposta
  async notifyCustomerOfResponse(review, response) {
    try {
      console.log(`📧 Notifica cliente: Risposta alla tua recensione di ${review.rating}⭐`);
      // Implementare sistema di notifiche email/SMS
      return { success: true };
    } catch (error) {
      console.error('Errore notifica cliente:', error);
      return { success: false, error: error.message };
    }
  }

  // Pubblica su piattaforma esterna
  async publishToExternalPlatform(review, response) {
    try {
      // Implementare integrazione con Google My Business, Facebook, ecc.
      console.log(`📤 Pubblicazione risposta su ${review.platform}`);
      return { success: true };
    } catch (error) {
      console.error('Errore pubblicazione esterna:', error);
      return { success: false, error: error.message };
    }
  }

  // Eventi post-risposta
  async triggerPostResponseEvents(review, response) {
    try {
      // Aggiorna statistiche di engagement
      await this.updateResponseStats(review, response);
      
      // Trigger automazioni marketing
      if (window.marketingAutomation) {
        await window.marketingAutomation.processReviewResponse(review, response);
      }
      
    } catch (error) {
      console.error('Errore eventi post-risposta:', error);
    }
  }

  // Aggiorna statistiche di risposta
  async updateResponseStats(review, response) {
    try {
      await this.dbAPI.updateBusinessStats(this.businessId, {
        responses_count: 1,
        avg_response_time: this.calculateResponseTime(review, response),
        last_response_date: new Date().toISOString()
      });
    } catch (error) {
      console.error('Errore aggiornamento statistiche risposta:', error);
    }
  }

  // Calcola tempo di risposta
  calculateResponseTime(review, response) {
    const reviewDate = new Date(review.created_at);
    const responseDate = new Date(response.created_at);
    const diffHours = (responseDate - reviewDate) / (1000 * 60 * 60);
    return Math.round(diffHours * 10) / 10; // Round to 1 decimal
  }

  // Ottieni tutte le risposte per un business
  async getBusinessResponses(filters = {}) {
    try {
      return await this.dbAPI.getBusinessReviewResponses(this.businessId, filters);
    } catch (error) {
      console.error('Errore caricamento risposte business:', error);
      return { success: false, error: error.message };
    }
  }

  // Statistiche feature
  getResponseStats() {
    return {
      feature: 'Rispondi alle Recensioni',
      status: 'active',
      templates_available: this.responseTemplates.size,
      business_id: this.businessId
    };
  }
}

// Export per uso in altri moduli
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReviewResponses;
} else {
  window.ReviewResponses = ReviewResponses;
}