/**
 * INVITI AUTOMATICI PLUS - 200 inviti/mese automatizzati  
 * Funzionalità: 200 inviti/mese automatizzati
 */

class AutomatedInvites {
  constructor(dbAPI, businessId, planType = 'plus') {
    this.dbAPI = dbAPI;
    this.businessId = businessId;
    this.planType = planType;
    this.monthlyLimits = this.getPlanLimits();
    this.inviteTemplates = new Map();
    this.automationRules = new Map();
    this.initializeTemplates();
    this.initializeAutomationRules();
  }

  // Ottieni limiti mensili basati sul piano
  getPlanLimits() {
    const limits = {
      free: 0,
      plus: 200,
      premium: 500,
      advanced: 2500
    };
    return limits[this.planType] || 0;
  }

  // Inizializza template di invito
  initializeTemplates() {
    const templates = {
      post_purchase: {
        subject: "Come è stata la tua esperienza con {business_name}?",
        message: `Ciao {customer_name}!

Grazie per aver scelto {business_name}. Speriamo che tu sia soddisfatto del nostro servizio/prodotto.

Ci piacerebbe conoscere la tua opinione! Potresti dedicare un minuto per lasciare una recensione?

👉 Lascia la tua recensione qui: {review_link}

La tua opinione è molto importante per noi e ci aiuta a migliorare continuamente.

Grazie mille!
Il team di {business_name}`,
        trigger: 'post_purchase',
        delay_hours: 24,
        channel: 'email'
      },
      post_service: {
        subject: "Ci piacerebbe il tuo feedback su {business_name}",
        message: `Ciao {customer_name}!

Ci auguriamo che il servizio ricevuto da {business_name} abbia soddisfatto le tue aspettative.

Per continuare a migliorare, ci farebbe molto piacere ricevere il tuo feedback:

⭐ Condividi la tua esperienza: {review_link}

Bastano solo 30 secondi e ci aiuterai enormemente!

Cordiali saluti,
{business_name}`,
        trigger: 'post_service',
        delay_hours: 2,
        channel: 'email'
      },
      follow_up: {
        subject: "Un piccolo favore da {business_name}",
        message: `Ciao {customer_name},

Qualche giorno fa hai ricevuto il nostro servizio e speriamo tu sia rimasto soddisfatto.

Se hai un momento, ci piacerebbe davvero ricevere una tua recensione:

🌟 {review_link}

La tua opinione sincera ci aiuta a crescere e a servire meglio i nostri clienti.

Grazie per il tempo che ci dedicherai!

{business_name}`,
        trigger: 'follow_up',
        delay_hours: 72,
        channel: 'email'
      },
      sms_quick: {
        subject: null,
        message: "Ciao {customer_name}! Come è andata con {business_name}? Lascia una recensione veloce qui: {review_link} Grazie! 😊",
        trigger: 'immediate',
        delay_hours: 1,
        channel: 'sms'
      }
    };

    Object.entries(templates).forEach(([key, template]) => {
      this.inviteTemplates.set(key, template);
    });
  }

  // Inizializza regole di automazione
  initializeAutomationRules() {
    const rules = {
      auto_post_purchase: {
        name: 'Invito Post-Acquisto Automatico',
        trigger: 'order_completed',
        conditions: [
          { field: 'order_status', operator: 'equals', value: 'completed' },
          { field: 'customer_email', operator: 'exists', value: true }
        ],
        template: 'post_purchase',
        active: true,
        priority: 1
      },
      auto_post_service: {
        name: 'Invito Post-Servizio',
        trigger: 'service_completed',
        conditions: [
          { field: 'service_status', operator: 'equals', value: 'completed' },
          { field: 'customer_satisfaction', operator: 'greater_than', value: 3 }
        ],
        template: 'post_service',
        active: true,
        priority: 2
      },
      auto_follow_up: {
        name: 'Follow-up Automatico',
        trigger: 'no_review_after_72h',
        conditions: [
          { field: 'invite_sent', operator: 'equals', value: true },
          { field: 'review_received', operator: 'equals', value: false },
          { field: 'hours_since_invite', operator: 'greater_than', value: 72 }
        ],
        template: 'follow_up',
        active: true,
        priority: 3
      }
    };

    Object.entries(rules).forEach(([key, rule]) => {
      this.automationRules.set(key, rule);
    });
  }

  // Invia invito automatico
  async sendAutomatedInvite(customerData, triggerEvent, options = {}) {
    try {
      // Verifica limiti mensili
      const canSend = await this.checkMonthlyLimit();
      if (!canSend.success) {
        return {
          success: false,
          error: 'Limite mensile inviti raggiunto',
          limit_info: canSend
        };
      }

      // Verifica se cliente ha già ricevuto inviti recenti
      const duplicateCheck = await this.checkRecentInvites(customerData.email);
      if (duplicateCheck.hasDuplicates) {
        return {
          success: false,
          error: 'Invito già inviato di recente a questo cliente',
          last_invite: duplicateCheck.lastInvite
        };
      }

      // Seleziona template appropriato
      const template = this.selectTemplateForTrigger(triggerEvent, options.templateId);
      if (!template) {
        throw new Error('Template non trovato per questo trigger');
      }

      // Personalizza messaggio
      const personalizedMessage = this.personalizeInviteMessage(template, customerData);

      // Genera link di recensione personalizzato
      const reviewLink = await this.generateReviewLink(customerData, options);

      // Sostituisci placeholder nel messaggio
      const finalMessage = this.replacePlaceholders(personalizedMessage, {
        ...customerData,
        review_link: reviewLink,
        business_name: options.businessName || 'La nostra azienda'
      });

      // Programma invio (se ha delay)
      const sendTime = this.calculateSendTime(template.delay_hours || 0);

      // Crea invito nel database
      const inviteData = {
        business_id: this.businessId,
        customer_email: customerData.email,
        customer_name: customerData.name,
        template_id: template.template_id || 'custom',
        trigger_event: triggerEvent,
        channel: template.channel || 'email',
        subject: template.subject,
        message: finalMessage.message,
        review_link: reviewLink,
        scheduled_send_time: sendTime,
        status: 'scheduled',
        created_at: new Date().toISOString(),
        metadata: {
          automation_rule: options.automationRule || null,
          customer_data: customerData,
          plan_type: this.planType
        }
      };

      const result = await this.dbAPI.createAutomatedInvite(inviteData);
      
      if (result.success) {
        // Se deve essere inviato immediatamente
        if (template.delay_hours === 0 || options.sendImmediately) {
          const sendResult = await this.executeInviteSend(result.invite);
          return {
            success: true,
            invite: result.invite,
            send_result: sendResult,
            message: 'Invito inviato immediatamente'
          };
        } else {
          // Programma per invio successivo
          await this.scheduleInviteDelivery(result.invite);
          return {
            success: true,
            invite: result.invite,
            scheduled_for: sendTime,
            message: `Invito programmato per ${sendTime}`
          };
        }
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      console.error('Errore invio invito automatico:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Verifica limite mensile
  async checkMonthlyLimit() {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const result = await this.dbAPI.getMonthlyInviteCount(this.businessId, currentMonth);
      
      const currentCount = result.success ? result.count : 0;
      const limit = this.monthlyLimits;
      const remaining = Math.max(0, limit - currentCount);

      return {
        success: remaining > 0,
        current_count: currentCount,
        monthly_limit: limit,
        remaining: remaining,
        can_send: remaining > 0
      };

    } catch (error) {
      console.error('Errore verifica limite mensile:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Verifica inviti recenti al cliente
  async checkRecentInvites(email) {
    try {
      const days = 7; // Non reinviare per 7 giorni
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);

      const result = await this.dbAPI.getRecentInvites(this.businessId, email, sinceDate.toISOString());
      
      if (result.success && result.invites.length > 0) {
        return {
          hasDuplicates: true,
          lastInvite: result.invites[0],
          count: result.invites.length
        };
      }

      return {
        hasDuplicates: false,
        lastInvite: null,
        count: 0
      };

    } catch (error) {
      console.error('Errore verifica inviti recenti:', error);
      return {
        hasDuplicates: false,
        lastInvite: null,
        count: 0
      };
    }
  }

  // Seleziona template per trigger
  selectTemplateForTrigger(triggerEvent, templateId = null) {
    if (templateId && this.inviteTemplates.has(templateId)) {
      return { template_id: templateId, ...this.inviteTemplates.get(templateId) };
    }

    // Mapping automatico trigger -> template
    const triggerMappings = {
      'order_completed': 'post_purchase',
      'service_completed': 'post_service',
      'appointment_finished': 'post_service',
      'delivery_confirmed': 'post_purchase',
      'follow_up_needed': 'follow_up',
      'immediate_request': 'sms_quick'
    };

    const mappedTemplate = triggerMappings[triggerEvent];
    if (mappedTemplate && this.inviteTemplates.has(mappedTemplate)) {
      return { template_id: mappedTemplate, ...this.inviteTemplates.get(mappedTemplate) };
    }

    // Default fallback
    return { template_id: 'post_purchase', ...this.inviteTemplates.get('post_purchase') };
  }

  // Personalizza messaggio in base al cliente
  personalizeInviteMessage(template, customerData) {
    let message = template.message;
    let subject = template.subject;

    // Personalizzazioni basate sui dati cliente
    if (customerData.purchase_type) {
      if (customerData.purchase_type === 'product') {
        message = message.replace('servizio/prodotto', 'prodotto');
        message = message.replace('servizio ricevuto', 'prodotto acquistato');
      } else if (customerData.purchase_type === 'service') {
        message = message.replace('servizio/prodotto', 'servizio');
      }
    }

    // Aggiunge dettagli specifici se disponibili
    if (customerData.order_details) {
      message += `\n\n(Ordine: ${customerData.order_details})`;
    }

    return {
      message: message,
      subject: subject
    };
  }

  // Genera link recensione personalizzato
  async generateReviewLink(customerData, options) {
    const baseUrl = options.baseUrl || 'https://socialtrust.app';
    const businessSlug = options.businessSlug || this.businessId;
    
    // Parametri tracking
    const trackingParams = new URLSearchParams({
      source: 'automated_invite',
      customer: customerData.email,
      business: this.businessId,
      timestamp: new Date().toISOString(),
      channel: options.channel || 'email'
    });

    const reviewLink = `${baseUrl}/review/${businessSlug}?${trackingParams.toString()}`;
    
    // Salva link per tracking
    await this.dbAPI.trackReviewLink({
      business_id: this.businessId,
      customer_email: customerData.email,
      review_link: reviewLink,
      generated_at: new Date().toISOString()
    });

    return reviewLink;
  }

  // Sostituisce placeholder nel testo
  replacePlaceholders(messageData, replacements) {
    let message = messageData.message;
    let subject = messageData.subject;

    Object.entries(replacements).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      message = message.replace(new RegExp(placeholder, 'g'), value || '');
      if (subject) {
        subject = subject.replace(new RegExp(placeholder, 'g'), value || '');
      }
    });

    return {
      message: message,
      subject: subject
    };
  }

  // Calcola tempo di invio
  calculateSendTime(delayHours) {
    const sendTime = new Date();
    sendTime.setHours(sendTime.getHours() + delayHours);
    return sendTime.toISOString();
  }

  // Esegue invio effettivo dell'invito
  async executeInviteSend(invite) {
    try {
      let sendResult;

      if (invite.channel === 'email') {
        sendResult = await this.sendEmailInvite(invite);
      } else if (invite.channel === 'sms') {
        sendResult = await this.sendSMSInvite(invite);
      } else {
        throw new Error(`Canale ${invite.channel} non supportato`);
      }

      // Aggiorna stato invito
      await this.dbAPI.updateInviteStatus(invite.id, {
        status: sendResult.success ? 'sent' : 'failed',
        sent_at: new Date().toISOString(),
        send_result: sendResult
      });

      return sendResult;

    } catch (error) {
      console.error('Errore esecuzione invio:', error);
      
      await this.dbAPI.updateInviteStatus(invite.id, {
        status: 'failed',
        error: error.message,
        failed_at: new Date().toISOString()
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  // Invia invito email
  async sendEmailInvite(invite) {
    try {
      console.log(`📧 Invio email invito a ${invite.customer_email}`);
      console.log(`📧 Oggetto: ${invite.subject}`);
      console.log(`📧 Messaggio: ${invite.message.slice(0, 100)}...`);
      
      // Simulazione invio email (sostituire con servizio email reale)
      // await emailService.send({
      //   to: invite.customer_email,
      //   subject: invite.subject,
      //   html: this.formatEmailHTML(invite)
      // });

      return {
        success: true,
        channel: 'email',
        sent_at: new Date().toISOString(),
        message: 'Email inviata con successo'
      };

    } catch (error) {
      console.error('Errore invio email:', error);
      return {
        success: false,
        channel: 'email',
        error: error.message
      };
    }
  }

  // Invia invito SMS
  async sendSMSInvite(invite) {
    try {
      console.log(`📱 Invio SMS invito a ${invite.customer_phone || invite.customer_email}`);
      console.log(`📱 Messaggio: ${invite.message}`);
      
      // Simulazione invio SMS
      return {
        success: true,
        channel: 'sms',
        sent_at: new Date().toISOString(),
        message: 'SMS inviato con successo'
      };

    } catch (error) {
      console.error('Errore invio SMS:', error);
      return {
        success: false,
        channel: 'sms',
        error: error.message
      };
    }
  }

  // Formatta HTML per email
  formatEmailHTML(invite) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">${invite.subject}</h2>
        <div style="white-space: pre-line; line-height: 1.6;">
          ${invite.message}
        </div>
        <div style="margin-top: 30px; padding: 20px; background: #f3f4f6; border-radius: 8px;">
          <p style="margin: 0; font-size: 0.9rem; color: #6b7280;">
            Questo invito è stato inviato automaticamente dal sistema SocialTrust.
          </p>
        </div>
      </div>
    `;
  }

  // Programma consegna invito
  async scheduleInviteDelivery(invite) {
    // Implementare sistema di scheduling (es. cron jobs, worker queues)
    console.log(`⏰ Invito programmato per ${invite.scheduled_send_time}`);
    return { success: true };
  }

  // Processo batch per inviti programmati
  async processPendingInvites() {
    try {
      const pendingInvites = await this.dbAPI.getPendingInvites(this.businessId);
      
      if (!pendingInvites.success) {
        throw new Error(pendingInvites.error);
      }

      const results = [];
      
      for (const invite of pendingInvites.invites) {
        const now = new Date();
        const scheduledTime = new Date(invite.scheduled_send_time);
        
        if (now >= scheduledTime) {
          const sendResult = await this.executeInviteSend(invite);
          results.push({ invite_id: invite.id, result: sendResult });
        }
      }

      return {
        success: true,
        processed: results.length,
        results: results
      };

    } catch (error) {
      console.error('Errore processo inviti in attesa:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Statistiche inviti
  async getInviteStats(period = 'current_month') {
    try {
      const stats = await this.dbAPI.getInviteStatistics(this.businessId, period);
      
      return {
        success: true,
        feature: 'Inviti Automatici Plus',
        plan_type: this.planType,
        monthly_limit: this.monthlyLimits,
        statistics: stats.success ? stats.stats : null
      };

    } catch (error) {
      console.error('Errore statistiche inviti:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export per uso in altri moduli
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AutomatedInvites;
} else {
  window.AutomatedInvites = AutomatedInvites;
}