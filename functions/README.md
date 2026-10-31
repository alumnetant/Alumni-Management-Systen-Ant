# St. Cecilia's College — Firebase Cloud Messaging & Cloud Functions Guide

This directory contains the **Firebase Cloud Functions v2** (Node.js 20 & TypeScript) backend triggers for the **Alumni Management System (Ant)**.

---

## 1. Overview of Triggers & Push Dispatches

| Cloud Function Name | Trigger Type | Condition & Logic | Target Audience & Route |
| :--- | :--- | :--- | :--- |
| **`onEmployerAccredited`** | `onDocumentUpdated("users/{userId}")` | Listens for transition from `pending` -> `approved` or `verified`. | Targeted multicast to employer's saved `fcmTokens` + topic `employer_{userId}`. Deep-links to `/profile`. |
| **`onNewAnnouncementPublished`** | `onDocumentCreated("announcements/{id}")` | Checks `targetBatch`. If specified (e.g. `2024`), dispatches to `batch_2024`. Otherwise dispatches globally. | Topic `batch_{targetBatch}` or `all_alumni`. Deep-links to `/announcements`. |
| **`onNewEventCreated`** | `onDocumentCreated("events/{eventId}")` | Fires upon event publication with date, location, and seat count. | Topic `all_alumni`. Deep-links to `/events`. |
| **`subscribeToCohortTopics`** | HTTPS Callable (`onCall`) | Subscribes client FCM token to requested topics on login. | Authorized devices. |

---

## 2. Topic Architecture

- **`all_alumni`**: Global campus broadcasts received by every active Cecilian alumnus.
- **`batch_{YEAR}`** (e.g. `batch_2020`, `batch_2024`): Granular cohort dispatches targeting specific graduation batches.
- **`employer_{USER_ID}`**: Dedicated private push channel for partner companies and recruiters.

---

## 3. Local Setup & Deployment Guide

### Prerequisites
1. Ensure the Firebase CLI is installed and authenticated:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```
2. Link your Firebase project:
   ```bash
   firebase use gen-lang-client-0856157514
   ```

### Installation & Build
```bash
cd functions
npm install
npm run build
```

### Local Testing with Firebase Emulators
To test triggers locally with emulator data:
```bash
firebase emulators:start --only functions,firestore
```

### Production Deployment
Deploy all triggers directly to your Cloud Functions project:
```bash
firebase deploy --only functions
```
Or deploy a single function:
```bash
firebase deploy --only functions:onEmployerAccredited
```

---

## 4. Android Native Channels (Capacitor)

The Cloud Functions configure notification payloads with Android channels:
- **`accreditation_alerts`**: High priority sound & vibration for employer decisions.
- **`urgent_announcements`**: Heads-up banner display for campus advisories.
- **`general_announcements`**: Default notification tray alert.
- **`campus_events`**: Event invitations with calendar and location metadata.
