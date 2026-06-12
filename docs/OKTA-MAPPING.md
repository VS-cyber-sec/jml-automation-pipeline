# 🗺️ Okta Workflows Mapping Guide

This document shows exactly how every component of this Auth0
project maps to Okta Workflows in a production environment.

Auth0 is owned by Okta (acquired 2021). The platforms share the
same parent company and identical architectural concepts.

---

## Component-by-Component Mapping

| Auth0 Concept | Okta Equivalent | Notes |
|---------------|-----------------|-------|
| Auth0 Tenant | Okta Org | The top-level identity container |
| Auth0 Actions | Okta Workflows | Event-driven automation engine |
| Post User Registration trigger | User Created event hook | Both fire on new user creation |
| `event.user.user_metadata` | Okta user profile attributes | Custom attributes on the user object |
| Auth0 Roles | Okta Groups | Collection of users with shared access |
| Management API `/users/{id}/roles` | Okta API `POST /api/v1/groups/{id}/users/{id}` | Adds user to role/group |
| Auth0 M2M App | Okta Service App / API token | Machine authentication credentials |
| Client Credentials grant | Okta API token | M2M authentication method |
| Auth0 Logs | Okta System Log | Audit trail of every event |
| Auth0 Actions Secrets | Okta Workflows Connection credentials | Encrypted secret storage |

---

## Flow-Level Mapping

### Auth0 Action trigger
```javascript
exports.onExecutePostUserRegistration = async (event, api) => {
```

### Okta Workflows equivalent
```
Trigger card: "Okta — User Created"
Fires when: a new user is created in any way
Output: user object with all profile fields
```

Both trigger on user creation. Both provide the user object
as the output that downstream steps can reference.

---

### If/Else department routing

**Auth0 Action (JavaScript):**
```javascript
if (dept === "engineering") {
  rolesToAssign.push(event.secrets.ROLE_ID_ENGINEERING);
} else if (dept === "hr") {
  rolesToAssign.push(event.secrets.ROLE_ID_HR_FINANCE);
}
```

**Okta Workflows (visual):**
```
[If/Else card]
  Condition: user.department equals "Engineering"
  TRUE  branch → [Add User to Group: engineering]
  FALSE branch → [If/Else: department equals "HR"...]
```

Same logic — JavaScript code vs drag-and-drop cards.
The decision tree is identical.

---

### Role / Group assignment

**Auth0 Action:**
```javascript
await axios.post(
  `https://${domain}/api/v2/users/${userId}/roles`,
  { roles: [roleId] },
  { headers: { Authorization: `Bearer ${token}` } }
);
```

**Okta Workflows:**
```
[Add User to Group card]
  User:  {{user.id}}   (from trigger output)
  Group: engineering   (selected from dropdown)
```

Same operation — both add a user to a collection that controls
app access. Auth0 uses the Management API directly;
Okta Workflows uses a built-in connector that makes the same API
call under the hood.

---

### Slack notification

**Auth0 Action:**
```javascript
await axios.post(webhookUrl, { text: "New hire: {{name}}" });
```

**Okta Workflows:**
```
[Slack connector card: Send Message to Channel]
  Channel:  #iam-alerts
  Message:  New hire: {{user.firstName}} {{user.lastName}}
```

Identical outcome. Okta Workflows has a built-in Slack connector
so you do not need to manage the webhook URL manually — the connector
handles authentication. Auth0 requires the raw webhook URL.

---

### Audit logging

**Auth0 Action:**
```javascript
await axios.post(sheetsAppendUrl, { values: [auditRow] });
```

**Okta Workflows:**
```
[Google Sheets connector card: Add Row]
  Spreadsheet: Okta JML Audit Log
  Sheet:       Sheet1
  Row data:    {{timestamp}}, {{user.email}}, ...
```

Okta Workflows has a native Google Sheets connector — no API
key management needed. Auth0 requires manual API key setup.
The outcome is identical: one row per event.

---

### Error handling

**Auth0 Action:**
```javascript
try {
  await axios.post(...)
} catch (err) {
  console.error("Step failed:", err.message);
  // continue to next step — do not crash
}
```

**Okta Workflows:**
```
Each card has an "On Error" setting:
  ○ Stop flow
  ○ Continue flow
  ○ Go to error path

Error path connects to:
  [Send Slack alert: "Workflow failed at step X"]
```

Okta Workflows gives a visual error path. Auth0 Actions
use standard JavaScript try/catch. The concept is identical:
catch failures, log them, continue where possible.

---

## Why This Experience Transfers Directly

When you move to Okta Workflows in a real job:

1. **Trigger** → just click "User Created" instead of writing
   `onExecutePostUserRegistration`

2. **If/Else routing** → drag an If/Else card and configure
   conditions in a UI instead of writing JavaScript if statements

3. **Group assignment** → drag "Add User to Group" card and
   select from a dropdown instead of calling the API manually

4. **Slack** → use the built-in Slack connector instead of
   managing webhook URLs

5. **Google Sheets** → use the built-in connector instead of
   managing API keys

The **architecture**, **logic**, and **concepts** you built here
are 100% identical. Okta Workflows just gives you a visual
interface for the same operations your JavaScript code performs.
