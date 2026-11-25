'use strict';

/**
 * Phase 5 Menu Tree
 *
 * This file defines conversation navigation only.
 * It does NOT publish or render KNEC knowledge-base answers.
 *
 * Leaf nodes may expose semantic hooks that Phase 6 will later
 * connect to approved knowledge-base records.
 */

const MENU_TREE = Object.freeze({
  id: 'root',
  type: 'menu',
  title: 'KNEC NURU',
  children: [
    {
      id: 'registration',
      type: 'menu',
      title: 'Examinations & Registration',
      emoji: '📝',
      description: 'Assessment registration, examination series and programme guidance',
      children: [
        {
          id: 'registration.kcse',
          type: 'knowledge_hook',
          title: 'KCSE Registration',
          emoji: '🎓',
          action: { type: 'knowledge_lookup', articleId: 'reg-kcse' }
        },
        {
          id: 'registration.kpsea',
          type: 'knowledge_hook',
          title: 'KPSEA Registration',
          emoji: '📘',
          action: { type: 'knowledge_lookup', articleId: 'reg-kpsea' }
        },
        {
          id: 'registration.kjsea',
          type: 'knowledge_hook',
          title: 'KJSEA Registration',
          emoji: '📗',
          action: { type: 'knowledge_lookup', articleId: 'reg-kjsea' }
        },
        {
          id: 'registration.kilea',
          type: 'knowledge_hook',
          title: 'KILEA Registration',
          emoji: '🧩',
          action: { type: 'knowledge_lookup', articleId: 'reg-kilea' }
        },
        {
          id: 'registration.kplea',
          type: 'knowledge_hook',
          title: 'KPLEA Registration',
          emoji: '🌟',
          action: { type: 'knowledge_lookup', articleId: 'reg-kplea' }
        },
        {
          id: 'registration.business-technical',
          type: 'menu',
          title: 'Business & Technical Examinations',
          emoji: '🛠️',
          children: [
            {
              id: 'registration.business-technical.registration',
              type: 'knowledge_hook',
              title: 'General Registration Guidance',
              emoji: '🧭',
              action: { type: 'knowledge_lookup', articleId: 'reg-tvet' }
            },
            {
              id: 'registration.business-technical.business',
              type: 'menu',
              title: 'Business Examinations',
              emoji: '📚',
              children: [
                {
                  id: 'registration.business-technical.business.stage-i',
                  type: 'knowledge_hook',
                  title: 'Business Stage I',
                  emoji: '📕',
                  action: { type: 'knowledge_lookup', articleId: 'tvet-business-stage-i' }
                },
                {
                  id: 'registration.business-technical.business.stage-ii',
                  type: 'knowledge_hook',
                  title: 'Business Stage II',
                  emoji: '📙',
                  action: { type: 'knowledge_lookup', articleId: 'tvet-business-stage-ii' }
                },
                {
                  id: 'registration.business-technical.business.stage-iii',
                  type: 'knowledge_hook',
                  title: 'Business Stage III',
                  emoji: '📗',
                  action: { type: 'knowledge_lookup', articleId: 'tvet-business-stage-iii' }
                },
                {
                  id: 'registration.business-technical.business.tep-certificate',
                  type: 'knowledge_hook',
                  title: 'TEP Certificate',
                  emoji: '📜',
                  action: { type: 'knowledge_lookup', articleId: 'tvet-business-tep-certificate' }
                },
                {
                  id: 'registration.business-technical.business.tep-diploma',
                  type: 'knowledge_hook',
                  title: 'TEP Diploma',
                  emoji: '🎓',
                  action: { type: 'knowledge_lookup', articleId: 'tvet-business-tep-diploma' }
                }
              ]
            },
            {
              id: 'registration.business-technical.technical',
              type: 'menu',
              title: 'Technical Examinations',
              emoji: '🧰',
              children: [
                {
                  id: 'registration.business-technical.technical.artisan',
                  type: 'knowledge_hook',
                  title: 'Artisan',
                  emoji: '🔧',
                  action: { type: 'knowledge_lookup', articleId: 'tvet-technical-artisan' }
                },
                {
                  id: 'registration.business-technical.technical.craft',
                  type: 'knowledge_hook',
                  title: 'Craft',
                  emoji: '🛠️',
                  action: { type: 'knowledge_lookup', articleId: 'tvet-technical-craft' }
                },
                {
                  id: 'registration.business-technical.technical.diploma',
                  type: 'knowledge_hook',
                  title: 'Diploma',
                  emoji: '🎓',
                  action: { type: 'knowledge_lookup', articleId: 'tvet-technical-diploma' }
                },
                {
                  id: 'registration.business-technical.technical.higher-diploma',
                  type: 'knowledge_hook',
                  title: 'Higher Diploma',
                  emoji: '🏅',
                  action: { type: 'knowledge_lookup', articleId: 'tvet-technical-higher-diploma' }
                },
                {
                  id: 'registration.business-technical.technical.old-higher-diploma',
                  type: 'knowledge_hook',
                  title: 'Old Higher Diploma',
                  emoji: '🗂️',
                  action: { type: 'knowledge_lookup', articleId: 'tvet-technical-old-higher-diploma' }
                }
              ]
            },
            {
              id: 'registration.business-technical.series',
              type: 'menu',
              title: 'Examination Series',
              emoji: '🗓️',
              children: [
                {
                  id: 'registration.business-technical.series.2026-11',
                  type: 'knowledge_hook',
                  title: 'November 2026',
                  emoji: '📅',
                  action: { type: 'knowledge_lookup', articleId: 'tvet-series-2026-11' }
                },
                {
                  id: 'registration.business-technical.series.2027-03',
                  type: 'knowledge_hook',
                  title: 'March 2027',
                  emoji: '📅',
                  action: { type: 'knowledge_lookup', articleId: 'tvet-series-2027-03' }
                },
                {
                  id: 'registration.business-technical.series.2027-07',
                  type: 'knowledge_hook',
                  title: 'July 2027',
                  emoji: '📅',
                  action: { type: 'knowledge_lookup', articleId: 'tvet-series-2027-07' }
                }
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'certificates',
      type: 'menu',
      title: 'Certificates & Documents',
      emoji: '📄',
      description: 'Certificate replacement and examination-document guidance',
      children: [
        {
          id: 'certificates.replacement',
          type: 'knowledge_hook',
          title: 'Certification / Replacement Guidance',
          emoji: '📜',
          action: { type: 'knowledge_lookup', articleId: 'cert-replacement' }
        }
      ]
    },
    {
      id: 'verification',
      type: 'menu',
      title: 'Results & Qualifications',
      emoji: '🎓',
      description: 'Results confirmation and foreign qualification equation',
      children: [
        {
          id: 'verification.results',
          type: 'knowledge_hook',
          title: 'Confirmation of Results',
          emoji: '✅',
          action: { type: 'knowledge_lookup', articleId: 'ver-results' }
        },
        {
          id: 'verification.foreign-equation',
          type: 'knowledge_hook',
          title: 'Equation of Foreign Qualifications',
          emoji: '🌍',
          action: { type: 'knowledge_lookup', articleId: 'foreign-equation' }
        }
      ]
    },
    {
      id: 'queries',
      type: 'menu',
      title: 'Corrections & Complaints',
      emoji: '📩',
      description: 'Results queries, amendments, recovery and complaints',
      children: [
        {
          id: 'queries.results',
          type: 'knowledge_hook',
          title: 'Examination Results Query',
          emoji: '📊',
          action: { type: 'knowledge_lookup', articleId: 'results-query' }
        },
        {
          id: 'queries.biodata',
          type: 'knowledge_hook',
          title: 'Biodata Amendment',
          emoji: '✏️',
          action: { type: 'knowledge_lookup', articleId: 'biodata-amendment' }
        },
        {
          id: 'queries.photo',
          type: 'knowledge_hook',
          title: 'Photo Amendment',
          emoji: '🖼️',
          action: { type: 'knowledge_lookup', articleId: 'photo-amendment' }
        },
        {
          id: 'queries.direct-recovery',
          type: 'knowledge_hook',
          title: 'Direct Recovery of Examination Documents',
          emoji: '📂',
          action: { type: 'knowledge_lookup', articleId: 'direct-recovery' }
        },
        {
          id: 'queries.professional-payment',
          type: 'knowledge_hook',
          title: 'Contracted Professional Payment Query',
          emoji: '💳',
          action: { type: 'knowledge_lookup', articleId: 'professional-payment-query' }
        },
        {
          id: 'queries.complaints',
          type: 'knowledge_hook',
          title: 'Complaints & Grievances',
          emoji: '🗣️',
          action: { type: 'knowledge_lookup', articleId: 'public-complaints' }
        }
      ]
    },
    {
      id: 'online-services',
      type: 'menu',
      title: 'QMIS & Online Services',
      emoji: '🌐',
      description: 'Portal navigation and application-status guidance',
      children: [
        {
          id: 'online-services.qmis',
          type: 'knowledge_hook',
          title: 'QMIS Navigation & Status Guidance',
          emoji: '💻',
          action: { type: 'knowledge_lookup', articleId: 'qmis-navigation' }
        }
      ]
    },
    {
      id: 'information',
      type: 'menu',
      title: 'Information & Support',
      emoji: 'ℹ️',
      description: 'Official contacts, public information and scam awareness',
      children: [
        {
          id: 'information.general',
          type: 'knowledge_hook',
          title: 'General Support',
          emoji: '☎️',
          action: { type: 'knowledge_lookup', articleId: 'faq-general' }
        },
        {
          id: 'information.public',
          type: 'knowledge_hook',
          title: 'Requests for Public Information',
          emoji: '📢',
          action: { type: 'knowledge_lookup', articleId: 'public-information' }
        },
        {
          id: 'information.scam-awareness',
          type: 'knowledge_hook',
          title: 'Fraud & Scam Awareness',
          emoji: '🛡️',
          action: { type: 'knowledge_lookup', articleId: 'faq-scam-awareness' }
        }
      ]
    },
    {
      id: 'general-administration',
      type: 'placeholder',
      title: 'General Administration — Coming Soon',
      emoji: '🏢',
      description: 'Future institutional facility support services',
      message: '🏢 *General Administration — Coming Soon*\n\nThis service is being prepared for a future phase.\n\nType MAIN MENU to return.',
      returnTo: 'root'
    }
  ]
});

module.exports = {
  MENU_TREE
};
