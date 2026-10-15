/**
 * St. Cecilia's College - Cecilian Alumnet
 * Offline Outgoing Message Queue Service
 *
 * Allows users to compose and dispatch peer & event messages while disconnected.
 * Messages are persistently stored in local device storage and automatically synchronized
 * to both the Express backend API and Cloud Firestore once network connectivity is restored.
 */

import { ChatMessage, ChatThread } from '../types';
import { saveChatMessageToFirestore, saveChatToFirestore } from '../lib/firebase';
import { triggerHaptic } from './hapticsService';

export const OFFLINE_QUEUE_STORAGE_KEY = 'alumni_offline_message_queue_v1';

export interface QueuedOfflineMessage extends ChatMessage {
  status: 'pending' | 'queued' | 'syncing' | 'failed' | 'sent';
  queuedAt: string;
  retryCount: number;
  lastError?: string;
}

let isSyncing = false;

/**
 * Retrieves all pending messages currently in the offline queue
 */
export function getOfflineMessageQueue(): QueuedOfflineMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Error reading offline message queue:', err);
    return [];
  }
}

/**
 * Saves the offline message queue to local storage and dispatches change event
 */
export function saveOfflineMessageQueue(queue: QueuedOfflineMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(queue));
    window.dispatchEvent(
      new CustomEvent('applet:offline-queue-change', {
        detail: { count: queue.length, queue }
      })
    );
  } catch (err) {
    console.warn('Error writing offline message queue:', err);
  }
}

/**
 * Sends a message to the backend REST API
 */
async function sendChatMessageToBackend(chatId: string, msg: ChatMessage): Promise<boolean> {
  try {
    const token =
      (typeof localStorage !== 'undefined' &&
        (localStorage.getItem('alumni_server_auth_token') || localStorage.getItem('alumni_auth_token'))) ||
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('alumni_server_auth_token')) ||
      '';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch('/api/messages/send', {
      method: 'POST',
      headers,
      body: JSON.stringify({ chatId, message: msg })
    });
    return res.ok;
  } catch (err) {
    console.warn('Backend API message dispatch notice:', err);
    return false;
  }
}

/**
 * Enqueues an outgoing message composed while offline
 */
export function enqueueOfflineMessage(
  chatId: string,
  message: ChatMessage
): QueuedOfflineMessage {
  const queuedMsg: QueuedOfflineMessage = {
    ...message,
    status: (message.status as any) || 'pending',
    offlineQueued: true,
    queuedAt: (message as any).queuedAt || new Date().toISOString(),
    retryCount: (message as any).retryCount || 0
  };

  const queue = getOfflineMessageQueue();
  // Prevent duplicate insertion
  const existingIdx = queue.findIndex((m) => m.id === message.id);
  if (existingIdx >= 0) {
    queue[existingIdx] = { ...queue[existingIdx], ...queuedMsg };
  } else {
    queue.push(queuedMsg);
  }

  saveOfflineMessageQueue(queue);
  triggerHaptic('selection');
  return queuedMsg;
}

/**
 * Removes a message from the offline queue (e.g. after successful delivery or user cancellation)
 */
export function removeOfflineMessage(messageId: string): void {
  const queue = getOfflineMessageQueue();
  const filtered = queue.filter((m) => m.id !== messageId);
  saveOfflineMessageQueue(filtered);
}

/**
 * Returns all queued messages destined for a specific chat thread
 */
export function getQueuedMessagesForChat(chatId: string): QueuedOfflineMessage[] {
  return getOfflineMessageQueue().filter((m) => m.chatId === chatId);
}

/**
 * Automatically syncs and delivers all pending messages in the queue to backend and Firestore
 */
export async function syncOfflineMessageQueue(options?: {
  onProgress?: (synced: number, total: number) => void;
  onMessageSynced?: (syncedMsg: QueuedOfflineMessage) => void;
}): Promise<{ syncedCount: number; failedCount: number }> {
  if (typeof window === 'undefined') return { syncedCount: 0, failedCount: 0 };
  if (isSyncing) {
    return { syncedCount: 0, failedCount: 0 };
  }

  const queue = getOfflineMessageQueue();
  if (queue.length === 0) {
    return { syncedCount: 0, failedCount: 0 };
  }

  // Quick verify network reachability
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { syncedCount: 0, failedCount: queue.length };
  }

  isSyncing = true;
  let syncedCount = 0;
  let failedCount = 0;
  const remainingQueue: QueuedOfflineMessage[] = [];

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];

    // Immediately mark status as 'syncing' and notify listeners
    item.status = 'syncing';
    saveOfflineMessageQueue(queue);
    window.dispatchEvent(
      new CustomEvent('applet:message-status-change', {
        detail: { messageId: item.id, chatId: item.chatId, status: 'syncing' }
      })
    );

    try {
      const cleanMsg: ChatMessage = {
        id: item.id,
        chatId: item.chatId,
        senderId: item.senderId,
        senderName: item.senderName,
        senderAvatar: item.senderAvatar,
        senderRole: item.senderRole,
        text: item.text,
        createdAt: item.createdAt,
        status: 'sent',
        offlineQueued: false,
        reactions: item.reactions || {}
      };

      // 1. Deliver to Backend REST API (with token if available)
      await sendChatMessageToBackend(item.chatId, cleanMsg);

      // 2. Deliver message payload to Cloud Firestore
      await saveChatMessageToFirestore(item.chatId, cleanMsg);

      // 3. Update thread preview in Firestore
      try {
        const chatPreviewUpdate: Partial<ChatThread> = {
          id: item.chatId,
          lastMessage: cleanMsg.text,
          lastMessageAt: cleanMsg.createdAt
        };
        await saveChatToFirestore(chatPreviewUpdate as ChatThread);
      } catch (chatUpdateErr) {
        console.warn('Notice updating chat thread metadata in Firestore:', chatUpdateErr);
      }

      // 4. Dispatch custom event so context & UI update the bubble status to 'sent'
      window.dispatchEvent(
        new CustomEvent('applet:message-synced', {
          detail: { messageId: item.id, chatId: item.chatId, cleanMsg }
        })
      );

      if (options?.onMessageSynced) {
        options.onMessageSynced({ ...item, status: 'sent', offlineQueued: false });
      }

      syncedCount++;
      if (options?.onProgress) {
        options.onProgress(syncedCount, queue.length);
      }
    } catch (err: any) {
      console.warn(`[Offline Queue] Failed to sync message ${item.id}:`, err);
      failedCount++;
      const failedItem: QueuedOfflineMessage = {
        ...item,
        status: 'failed',
        retryCount: (item.retryCount || 0) + 1,
        lastError: err?.message || 'Network sync error'
      };
      remainingQueue.push(failedItem);

      window.dispatchEvent(
        new CustomEvent('applet:message-status-change', {
          detail: {
            messageId: item.id,
            chatId: item.chatId,
            status: 'failed',
            error: failedItem.lastError
          }
        })
      );
    }
  }

  // Save remaining (failed) items so they are NEVER lost or discarded
  saveOfflineMessageQueue(remainingQueue);
  isSyncing = false;

  if (syncedCount > 0) {
    triggerHaptic('success');
    window.dispatchEvent(
      new CustomEvent('applet:offline-messages-synced', {
        detail: { syncedCount, failedCount }
      })
    );
  }

  return { syncedCount, failedCount };
}

/**
 * Manually retries sending a failed message
 */
export async function retryQueuedMessage(messageId: string): Promise<boolean> {
  const queue = getOfflineMessageQueue();
  const target = queue.find((m) => m.id === messageId);
  if (!target) return false;

  // Set status to syncing immediately
  target.status = 'syncing';
  saveOfflineMessageQueue(queue);
  window.dispatchEvent(
    new CustomEvent('applet:message-status-change', {
      detail: { messageId: target.id, chatId: target.chatId, status: 'syncing' }
    })
  );

  try {
    const cleanMsg: ChatMessage = {
      id: target.id,
      chatId: target.chatId,
      senderId: target.senderId,
      senderName: target.senderName,
      senderAvatar: target.senderAvatar,
      senderRole: target.senderRole,
      text: target.text,
      createdAt: target.createdAt,
      status: 'sent',
      offlineQueued: false,
      reactions: target.reactions || {}
    };

    // 1. Deliver to Backend REST API
    await sendChatMessageToBackend(target.chatId, cleanMsg);

    // 2. Deliver to Firestore
    await saveChatMessageToFirestore(target.chatId, cleanMsg);

    // 3. Update thread preview in Firestore
    try {
      const chatPreviewUpdate: Partial<ChatThread> = {
        id: target.chatId,
        lastMessage: cleanMsg.text,
        lastMessageAt: cleanMsg.createdAt
      };
      await saveChatToFirestore(chatPreviewUpdate as ChatThread);
    } catch {}

    removeOfflineMessage(messageId);

    window.dispatchEvent(
      new CustomEvent('applet:message-synced', {
        detail: { messageId: target.id, chatId: target.chatId, cleanMsg }
      })
    );

    triggerHaptic('success');
    return true;
  } catch (err: any) {
    console.warn(`Retry failed for message ${messageId}:`, err);
    target.status = 'failed';
    target.retryCount = (target.retryCount || 0) + 1;
    target.lastError = err?.message || 'Retry failed';
    saveOfflineMessageQueue(queue);

    window.dispatchEvent(
      new CustomEvent('applet:message-status-change', {
        detail: {
          messageId: target.id,
          chatId: target.chatId,
          status: 'failed',
          error: target.lastError
        }
      })
    );

    triggerHaptic('error');
    return false;
  }
}
