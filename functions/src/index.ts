/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * St. Cecilia's College — Cecilian Alumnet
 * Firebase Cloud Functions v2 (TypeScript, Node.js 20)
 * 
 * 1. onEmployerAccredited: Target unicast/multicast to employer FCM tokens
 * 2. onNewAnnouncementPublished: Topic send to batch_{targetBatch} or all_alumni
 * 3. onNewEventCreated: Broadcast to all_alumni
 * 4. subscribeToTopicsCallable: HTTPS callable for subscribing device tokens to topics
 */

import * as admin from 'firebase-admin';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

/**
 * 1. EMPLOYER ACCREDITATION TRIGGER
 * Listens for updates to an employer's user profile.
 * When status changes from "pending" to "approved", dispatches targeted push notifications.
 */
export const onEmployerAccredited = onDocumentUpdated('users/{userId}', async (event) => {
  const beforeData = event.data?.before.data();
  const afterData = event.data?.after.data();

  if (!beforeData || !afterData) return;

  const previousStatus = beforeData.employerStatus || beforeData.employerVerificationStatus || 'pending';
  const newStatus = afterData.employerStatus || afterData.employerVerificationStatus;

  // Verify transition from 'pending' (or unverified) to 'approved' / 'verified'
  const isNowApproved =
    (previousStatus === 'pending' || previousStatus === 'submitted') &&
    (newStatus === 'approved' || newStatus === 'verified');

  if (!isNowApproved) {
    return;
  }

  const userId = event.params.userId;
  const companyName = afterData.companyName || afterData.company || afterData.name || 'Partner Company';
  const fcmTokens: string[] = afterData.fcmTokens || [];

  console.info(`[FCM Trigger] Employer accredited: ${companyName} (${userId}). Total tokens: ${fcmTokens.length}`);

  const payloadTitle = 'Employer Accreditation Approved';
  const payloadBody = `Congratulations! ${companyName} has been officially accredited by St. Cecilia's College. You may now post vacancies and recruit Cecilian graduates.`;

  // A. Direct Multicast to all active device tokens of the employer
  if (fcmTokens.length > 0) {
    try {
      const response = await messaging.sendEachForMulticast({
        tokens: fcmTokens,
        notification: {
          title: payloadTitle,
          body: payloadBody
        },
        data: {
          route: 'profile',
          tag: 'employer_accreditation',
          companyName,
          status: 'approved',
          timestamp: new Date().toISOString()
        },
        android: {
          priority: 'high',
          notification: {
            icon: 'ic_stat_alumnet',
            color: '#8B181B',
            channelId: 'accreditation_alerts',
            sound: 'default'
          }
        },
        webpush: {
          headers: { Urgency: 'high' },
          notification: {
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png'
          }
        }
      });

      console.info(`[FCM Trigger] Accreditation sent: ${response.successCount} succeeded, ${response.failureCount} failed.`);
    } catch (err) {
      console.error('[FCM Trigger] Failed to send accreditation multicast:', err);
    }
  }

  // B. Topic Dispatch to employer's dedicated topic (employer_{userId})
  try {
    await messaging.send({
      topic: `employer_${userId}`,
      notification: {
        title: payloadTitle,
        body: payloadBody
      },
      data: {
        route: 'profile',
        tag: 'employer_accreditation'
      }
    });
  } catch (err) {
    console.warn(`[FCM Trigger] Topic broadcast for employer_${userId} fallback notice:`, err);
  }
});

/**
 * 2. FYP & ANNOUNCEMENTS TRIGGER (BATCH-SPECIFIC OR ALL-ALUMNI)
 * Triggered when a new document is added to the "announcements" collection.
 * If targetBatch is present (e.g. 2024), notifies only users of that batch.
 * Otherwise, notifies all Alumni users.
 */
export const onNewAnnouncementPublished = onDocumentCreated('announcements/{announcementId}', async (event) => {
  const data = event.data?.data();
  if (!data) return;

  const announcementId = event.params.announcementId;
  const title = data.title || 'Official College Circular';
  const content = (data.content || '').slice(0, 150) + (data.content?.length > 150 ? '...' : '');
  const category = data.category || 'General';
  const isUrgent = Boolean(data.urgent || data.isImportant);

  // Check for targetBatch or targetBatches
  const targetBatch = data.targetBatch || (data.targetBatches && data.targetBatches.length === 1 ? data.targetBatches[0] : null);

  const notificationPayload = {
    title: isUrgent ? `URGENT: ${title}` : title,
    body: content
  };

  const dataPayload = {
    announcementId,
    route: 'announcements',
    tag: isUrgent ? 'urgent_circular' : 'college_circular',
    category,
    timestamp: new Date().toISOString()
  };

  // Case A: Batch-Specific Notification (e.g. targetBatch: "2024")
  if (targetBatch) {
    const topicName = `batch_${targetBatch}`;
    console.info(`[FCM Trigger] Dispatching announcement ${announcementId} to batch topic: ${topicName}`);

    try {
      await messaging.send({
        topic: topicName,
        notification: notificationPayload,
        data: dataPayload,
        android: {
          priority: isUrgent ? 'high' : 'normal',
          notification: {
            channelId: isUrgent ? 'urgent_announcements' : 'general_announcements',
            color: '#8B181B'
          }
        }
      });
      console.info(`[FCM Trigger] Successfully dispatched to topic ${topicName}`);
    } catch (topicErr) {
      console.warn(`[FCM Trigger] Topic dispatch error, falling back to batch query:`, topicErr);

      // Fallback: Query Firestore for all users where batch == targetBatch
      const usersSnap = await db.collection('users').where('batch', '==', String(targetBatch)).get();
      const tokens: string[] = [];
      usersSnap.forEach((docSnap) => {
        const uTokens = docSnap.data().fcmTokens;
        if (Array.isArray(uTokens)) {
          tokens.push(...uTokens);
        }
      });

      if (tokens.length > 0) {
        await messaging.sendEachForMulticast({
          tokens: Array.from(new Set(tokens)),
          notification: notificationPayload,
          data: dataPayload
        });
      }
    }
    return;
  }

  // Case B: Global All-Alumni Broadcast
  console.info(`[FCM Trigger] Dispatching global announcement ${announcementId} to topic: all_alumni`);
  try {
    await messaging.send({
      topic: 'all_alumni',
      notification: notificationPayload,
      data: dataPayload,
      android: {
        priority: isUrgent ? 'high' : 'normal',
        notification: {
          channelId: isUrgent ? 'urgent_announcements' : 'general_announcements',
          color: '#8B181B'
        }
      }
    });
  } catch (err) {
    console.error('[FCM Trigger] Failed to send broadcast to all_alumni topic:', err);
  }
});

/**
 * 3. CAMPUS EVENTS TRIGGER
 * Triggered when a new document is added to the "events" collection.
 * Sends a push notification to all Alumni users.
 */
export const onNewEventCreated = onDocumentCreated('events/{eventId}', async (event) => {
  const data = event.data?.data();
  if (!data) return;

  const eventId = event.params.eventId;
  const title = data.title || 'New Campus Event';
  const eventDate = data.startDate ? new Date(data.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Upcoming';
  const location = data.location || 'SCC Campus';

  console.info(`[FCM Trigger] Dispatching event notification for: ${title} (${eventId}) to all_alumni`);

  try {
    await messaging.send({
      topic: 'all_alumni',
      notification: {
        title: `Campus Event: ${title}`,
        body: `Scheduled for ${eventDate} at ${location}. Tap to view event details and reserve your seat.`
      },
      data: {
        eventId,
        route: 'events',
        tag: 'campus_event',
        timestamp: new Date().toISOString()
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'campus_events',
          color: '#8B181B'
        }
      }
    });
  } catch (err) {
    console.error('[FCM Trigger] Failed to broadcast event notification:', err);
  }
});

/**
 * 4. HTTPS CALLABLE: SUBSCRIBE DEVICE TOKEN TO COHORT TOPICS
 * Called by frontend to subscribe device tokens to topics (all_alumni, batch_{year}, employer_{uid})
 */
export const subscribeToCohortTopics = onCall(async (request) => {
  const { token, topics } = request.data || {};

  if (!token || !Array.isArray(topics) || topics.length === 0) {
    throw new HttpsError('invalid-argument', 'Token and topics array are required.');
  }

  // Subscribe token to each requested topic
  const results = await Promise.allSettled(
    topics.map((topic: string) => messaging.subscribeToTopic(token, topic))
  );

  const successfulTopics = topics.filter((_, idx) => results[idx].status === 'fulfilled');
  return { success: true, subscribedTopics: successfulTopics };
});
