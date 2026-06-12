# 🐛 Debugging Guide — JML Automation Pipeline

All real errors encountered during development, their root causes,
and step-by-step fixes.

---

## Error 1 — 401 Unauthorized on token request

### Symptom
```
Failed to get management token: Request failed with status code 401
```

### Root Cause
Using a **Regular Web Application** Client ID and Secret for
a machine-to-machine token request. The `client_credentials` grant
type is only valid for Machine-to-Machine applications.

OAuth specification: web apps use Authorization Code flow (human present).
M2M apps use Client Credentials flow (no human, machine authenticates as itself).

### Fix
1. Go to Auth0 Dashboard → Applications → + Create Application
2. Select **Machine to Machine Applications** (not Regular Web App)
3. Authorize for **Auth0 Management API**
4. Grant permissions: `read:users`, `update:users`, `read:roles`, `create:role_members`
5. Copy new Client ID and Client Secret into Action Secrets

### Lesson
Always match the OAuth grant type to the application type:
- Human present → Authorization Code (Regular Web App)
- Machine to machine → Client Credentials (M2M App)

---

## Error 2 — Cannot read properties of undefined (reading 'post')

### Symptom
```
Failed to get management token: Cannot read properties of undefined (reading 'post')
```

### Root Cause
Code used `api.http.post()` — Auth0 Actions do NOT provide a built-in
HTTP client via the `api` object. The `api` object only exposes
Auth0-specific methods (like `api.access.deny()`).

### Fix
1. In Action editor → click 📦 Modules icon (left sidebar)
2. Click **Add Module**
3. Name: `axios` | Version: `0.27.2`
4. Click Save
5. Add `const axios = require("axios");` at top of Action code

### Lesson
Auth0 Actions run in an isolated Node.js environment.
External packages must be explicitly declared in the Modules panel.
They are not auto-available even if they are common npm packages.

---

## Error 3 — 404 User Does Not Exist

### Symptom
```
Role assignment failed: 404
{
  statusCode: 404,
  error: 'Not Found',
  message: 'The user does not exist.',
  errorCode: 'inexistent_user'
}
```

### Root Cause
Test payload used the synthetic user ID `auth0|test123` which does
not exist in the Auth0 directory. The Management API performs a real
directory lookup — fake IDs return 404.

### Fix — Option A (recommended): Use real user ID in test payload
1. Go to Auth0 Dashboard → User Management → Users
2. Click any existing user
3. Copy the **User ID** from the user detail page (format: `auth0|64abc...`)
4. Replace `"auth0|test123"` in test payload with real ID

### Fix — Option B: Add test detection in code
```javascript
const isTestUser = event.user.user_id === "auth0|test123";
if (rolesToAssign.length > 0 && !isTestUser) {
  // assign roles
} else if (isTestUser) {
  console.log("Test user — skipping role assignment ✓");
}
```

### Why this never happens in production
The Post User Registration Action fires **after** a real user registers.
The user always exists in Auth0 directory at that point.
The 404 is test-mode only.

---

## Error 4 — Secrets showing as MISSING

### Symptom
```
Domain check:     MISSING ✗
Client ID check:  MISSING ✗
Secret check:     MISSING ✗
```

### Root Cause A — .env file parse errors
`python-dotenv` cannot parse lines with comments (`# comment`) or
blank lines in some configurations. All values load as `None`.

**Fix:** Remove ALL comments and blank lines from `.env`:
```bash
# WRONG — has comment
AUTH0_DOMAIN=dev-xxxx.us.auth0.com  # my tenant

# CORRECT — no comments, no blank lines
AUTH0_DOMAIN=dev-xxxx.us.auth0.com
AUTH0_CLIENT_ID=abc123
```

### Root Cause B — Secrets not saved in Auth0 Secrets panel
Secrets were added but Save was not clicked, or the Action was not
redeployed after adding secrets.

**Fix:**
1. Click 🔑 Secrets icon in Action editor
2. Verify all secrets are listed with correct values
3. For each secret: click → verify value → Save
4. Click **Deploy** (not just Save Draft) after updating secrets

### Root Cause C — Wrong AUTH0_DOMAIN format
Domain has `https://` prefix or trailing `/` which breaks URL construction.

```
WRONG:  https://dev-xxxx.us.auth0.com
WRONG:  dev-xxxx.us.auth0.com/
CORRECT: dev-xxxx.us.auth0.com
```

---

## Error 5 — Google Sheets 403 Forbidden

### Symptom
```
Google Sheets FAILED
Status: 403
Error: {"error":{"code":403,"message":"The caller does not have permission"}}
```

### Root Cause
Google Sheets API not enabled for the project, or API key does not
have access to the spreadsheet.

### Fix
1. Go to console.cloud.google.com
2. Select your project
3. Search "Google Sheets API" → Enable
4. Go to Credentials → click your API Key → Application restrictions
5. Set to "None" for testing (restrict properly in production)
6. Verify spreadsheet is not restricted to specific accounts

---

## Error 6 — Slack returns non-200 status

### Symptom
```
Slack notification FAILED
Slack returned status: 404
```

### Root Cause
Webhook URL has been revoked, the Slack app was deleted, or the
channel `#iam-alerts` was deleted.

### Fix
1. Go to api.slack.com/apps → select your app
2. Incoming Webhooks → verify webhook is active
3. Add New Webhook if needed → select channel → copy new URL
4. Update `SLACK_WEBHOOK_URL` secret in Auth0 Action

---

## General Debugging Tips

### Check Auth0 Logs first
Auth0 Dashboard → **Monitoring → Logs**
Filter by: `Post User Registration`
Click any entry to see full console output including all `console.log` lines.

### Token endpoint verification
Test your M2M credentials manually using curl:
```bash
curl --request POST \
  --url 'https://YOUR_DOMAIN/oauth/token' \
  --header 'content-type: application/json' \
  --data '{
    "client_id": "YOUR_M2M_CLIENT_ID",
    "client_secret": "YOUR_M2M_CLIENT_SECRET",
    "audience": "https://YOUR_DOMAIN/api/v2/",
    "grant_type": "client_credentials"
  }'
```
Expected response: `{"access_token":"eyJ...","token_type":"Bearer"}`
If 401: credentials wrong or M2M app not authorized for Management API.

### Role assignment verification
After successful test, verify in Auth0:
Dashboard → Users → click user → **Roles tab**
Should show: `all-employees` + department-specific role
