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
  title: 'KNEC Information Assistant',
  children: [
    {
      id: 'registration',
      type: 'menu',
      title: 'Registration',
      description: 'Assessment registration, examination series and programme guidance',
      children: [
        {
          id: 'registration.kcse',
          type: 'knowledge_hook',
          title: 'KCSE Registration',
          action: { type: 'knowledge_lookup', articleId: 'reg-kcse' }
        },
        {
          id: 'registration.kpsea',
          type: 'knowledge_hook',
          title: 'KPSEA Registration',
          action: { type: 'knowledge_lookup', articleId: 'reg-kpsea' }
        },
        {
          id: 'registration.kjsea',
          type: 'knowledge_hook',
          title: 'KJSEA Registration',
          action: { type: 'knowledge_lookup', articleId: 'reg-kjsea' }
        },
        {
          id: 'registration.kilea',
          type: 'knowledge_hook',
          title: 'KILEA Registration',
          action: { type: 'knowledge_lookup', articleId: 'reg-kilea' }
        },
        {
          id: 'registration.kplea',
          type: 'knowledge_hook',
          title: 'KPLEA Registration',
          action: { type: 'knowledge_lookup', articleId: 'reg-kplea' }
        },
        {
          id: 'registration.business-technical',
          type: 'menu',
          title: 'Business & Technical Examinations',
          children: [
            {
              id: 'registration.business-technical.registration',
              type: 'knowledge_hook',
              title: 'General Registration Guidance',
              action: { type: 'knowledge_lookup', articleId: 'reg-tvet' }
            },
            {
              id: 'registration.business-technical.business',
              type: 'menu',
              title: 'Business Examinations',
              children: [
                {
                  id: 'registration.business-technical.business.stage-i',
                  type: 'knowledge_hook',
                  title: 'Business Stage I',
                  action: { type: 'knowledge_lookup', articleId: 'tvet-business-stage-i' }
                },
                {
                  id: 'registration.business-technical.business.stage-ii',
                  type: 'knowledge_hook',
                  title: 'Business Stage II',
                  action: { type: 'knowledge_lookup', articleId: 'tvet-business-stage-ii' }
                },
                {
                  id: 'registration.business-technical.business.stage-iii',
                  type: 'knowledge_hook',
                  title: 'Business Stage III',
                  action: { type: 'knowledge_lookup', articleId: 'tvet-business-stage-iii' }
                },
                {
                  id: 'registration.business-technical.business.tep-certificate',
                  type: 'knowledge_hook',
                  title: 'TEP Certificate',
                  action: { type: 'knowledge_lookup', articleId: 'tvet-business-tep-certificate' }
                },
                {
                  id: 'registration.business-technical.business.tep-diploma',
                  type: 'knowledge_hook',
                  title: 'TEP Diploma',
                  action: { type: 'knowledge_lookup', articleId: 'tvet-business-tep-diploma' }
                }
              ]
            },
            {
              id: 'registration.business-technical.technical',
              type: 'menu',
              title: 'Technical Examinations',
              children: [
                {
                  id: 'registration.business-technical.technical.artisan',
                  type: 'knowledge_hook',
                  title: 'Artisan',
                  action: { type: 'knowledge_lookup', articleId: 'tvet-technical-artisan' }
                },
                {
                  id: 'registration.business-technical.technical.craft',
                  type: 'knowledge_hook',
                  title: 'Craft',
                  action: { type: 'knowledge_lookup', articleId: 'tvet-technical-craft' }
                },
                {
                  id: 'registration.business-technical.technical.diploma',
                  type: 'knowledge_hook',
                  title: 'Diploma',
                  action: { type: 'knowledge_lookup', articleId: 'tvet-technical-diploma' }
                },
                {
                  id: 'registration.business-technical.technical.higher-diploma',
                  type: 'knowledge_hook',
                  title: 'Higher Diploma',
                  action: { type: 'knowledge_lookup', articleId: 'tvet-technical-higher-diploma' }
                },
                {
                  id: 'registration.business-technical.technical.old-higher-diploma',
                  type: 'knowledge_hook',
                  title: 'Old Higher Diploma',
                  action: { type: 'knowledge_lookup', articleId: 'tvet-technical-old-higher-diploma' }
                }
              ]
            },
            {
              id: 'registration.business-technical.series',
              type: 'menu',
              title: 'Examination Series',
              children: [
                {
                  id: 'registration.business-technical.series.2026-11',
                  type: 'knowledge_hook',
                  title: 'November 2026',
                  action: { type: 'knowledge_lookup', articleId: 'tvet-series-2026-11' }
                },
                {
                  id: 'registration.business-technical.series.2027-03',
                  type: 'knowledge_hook',
                  title: 'March 2027',
                  action: { type: 'knowledge_lookup', articleId: 'tvet-series-2027-03' }
                },
                {
                  id: 'registration.business-technical.series.2027-07',
                  type: 'knowledge_hook',
                  title: 'July 2027',
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
      title: 'Certificates & Certification',
      description: 'Certification letters and replacement guidance',
      children: [
        {
          id: 'certificates.replacement',
          type: 'knowledge_hook',
          title: 'Certification / Replacement Guidance',
          action: { type: 'knowledge_lookup', articleId: 'cert-replacement' }
        }
      ]
    },
    {
      id: 'verification',
      type: 'menu',
      title: 'Verification & Confirmation',
      description: 'Results confirmation and foreign qualification equation',
      children: [
        {
          id: 'verification.results',
          type: 'knowledge_hook',
          title: 'Confirmation of Results',
          action: { type: 'knowledge_lookup', articleId: 'ver-results' }
        },
        {
          id: 'verification.foreign-equation',
          type: 'knowledge_hook',
          title: 'Equation of Foreign Qualifications',
          action: { type: 'knowledge_lookup', articleId: 'foreign-equation' }
        }
      ]
    },
    {
      id: 'queries',
      type: 'menu',
      title: 'Queries, Corrections & Recovery',
      description: 'Results queries, amendments, recovery and complaints',
      children: [
        {
          id: 'queries.results',
          type: 'knowledge_hook',
          title: 'Examination Results Query',
          action: { type: 'knowledge_lookup', articleId: 'results-query' }
        },
        {
          id: 'queries.biodata',
          type: 'knowledge_hook',
          title: 'Biodata Amendment',
          action: { type: 'knowledge_lookup', articleId: 'biodata-amendment' }
        },
        {
          id: 'queries.photo',
          type: 'knowledge_hook',
          title: 'Photo Amendment',
          action: { type: 'knowledge_lookup', articleId: 'photo-amendment' }
        },
        {
          id: 'queries.direct-recovery',
          type: 'knowledge_hook',
          title: 'Direct Recovery of Examination Documents',
          action: { type: 'knowledge_lookup', articleId: 'direct-recovery' }
        },
        {
          id: 'queries.professional-payment',
          type: 'knowledge_hook',
          title: 'Contracted Professional Payment Query',
          action: { type: 'knowledge_lookup', articleId: 'professional-payment-query' }
        },
        {
          id: 'queries.complaints',
          type: 'knowledge_hook',
          title: 'Complaints & Grievances',
          action: { type: 'knowledge_lookup', articleId: 'public-complaints' }
        }
      ]
    },
    {
      id: 'online-services',
      type: 'menu',
      title: 'QMIS & Online Services',
      description: 'Portal navigation and application-status guidance',
      children: [
        {
          id: 'online-services.qmis',
          type: 'knowledge_hook',
          title: 'QMIS Navigation & Status Guidance',
          action: { type: 'knowledge_lookup', articleId: 'qmis-navigation' }
        }
      ]
    },
    {
      id: 'information',
      type: 'menu',
      title: 'FAQs & General Information',
      description: 'Official contacts, public information and scam awareness',
      children: [
        {
          id: 'information.general',
          type: 'knowledge_hook',
          title: 'General Support',
          action: { type: 'knowledge_lookup', articleId: 'faq-general' }
        },
        {
          id: 'information.public',
          type: 'knowledge_hook',
          title: 'Requests for Public Information',
          action: { type: 'knowledge_lookup', articleId: 'public-information' }
        },
        {
          id: 'information.scam-awareness',
          type: 'knowledge_hook',
          title: 'Fraud & Scam Awareness',
          action: { type: 'knowledge_lookup', articleId: 'faq-scam-awareness' }
        }
      ]
    },
    {
      id: 'general-administration',
      type: 'placeholder',
      title: 'General Administration',
      description: 'Future departmental and administrative services',
      message: 'General Administration services are planned for a future phase.',
      returnTo: 'root'
    }
  ]
});

module.exports = {
  MENU_TREE
};
