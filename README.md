# 🔐 IAM JML Automation Pipeline
### Identity Lifecycle Automation — Auth0 Actions × Slack × Google Sheets

[![Auth0](https://img.shields.io/badge/Auth0-Actions-EB5424?style=for-the-badge&logo=auth0&logoColor=white)](https://auth0.com)
[![Okta](https://img.shields.io/badge/Okta-Platform-007DC1?style=for-the-badge&logo=okta&logoColor=white)](https://okta.com)
[![Node.js](https://img.shields.io/badge/Node.js-22-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Slack](https://img.shields.io/badge/Slack-Webhook-4A154B?style=for-the-badge&logo=slack&logoColor=white)](https://slack.com)
[![Google Sheets](https://img.shields.io/badge/Google_Sheets-Audit_Log-34A853?style=for-the-badge&logo=googlesheets&logoColor=white)](https://sheets.google.com)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [What is JML?](#-what-is-jml)
- [Flow Diagram](#-flow-diagram)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Setup Guide](#-setup-guide)
- [Configuration](#-configuration)
- [Testing](#-testing)


---

## 🎯 Overview

This project implements a **fully automated Joiner-Mover-Leaver (JML) identity lifecycle pipeline** using Auth0 Actions as the automation engine — the free-tier equivalent of Okta Workflows.

When a new user registers in Auth0:

- ✅ Their **department attribute** is read from user metadata
- ✅ **Role-based access** is assigned automatically via the Management API
- ✅ A **Slack notification** is sent to the IAM alerts channel
- ✅ An **audit row** is written to Google Sheets for SOC 2 compliance
- ✅ **Error handling** catches and reports any step failure

**Zero manual steps. Sub-3-second provisioning. Complete audit trail.**

> **Note:** Auth0 is built on the Okta platform (acquired 2021). All concepts, architecture, and logic demonstrated here are directly transferable to Okta Workflows in an enterprise environment.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        IDENTITY PLANE                           │
│                                                                 │
│   HR System / Admin          Auth0 Tenant                       │
│   ─────────────────    ──────────────────────────────────────   │
│   Creates new user  →  User record created                      │
│   with department       Post User Registration event fires      │
│   metadata              │                                       │
│                         ▼                                       │
│                    Auth0 Action (JML Engine)                    │
│                    ─────────────────────────                    │
│                    Reads user attributes                        │
│                    Routes by department                         │
│                    Calls Management API                         │
│                         │                                       │
└─────────────────────────┼───────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
   │  Auth0      │ │   Slack     │ │   Google    │
   │  Roles API  │ │  Webhook    │ │   Sheets    │
   │             │ │             │ │    API      │
   │ Assigns:    │ │ Notifies:   │ │ Logs:       │
   │ • engineering│ │ • #iam-alerts│ │ • Timestamp │
   │ • hr-finance│ │ • New hire  │ │ • User info │
   │ • all-staff │ │   details   │ │ • Roles     │
   └─────────────┘ └─────────────┘ │ • Status    │
                                   └─────────────┘
```

---

## 📚 What is JML?

JML stands for **Joiner · Mover · Leaver** — the three identity lifecycle events every employee experiences.

| Phase | Trigger | Action Required | Risk if Not Automated |
|-------|---------|-----------------|----------------------|
| **Joiner** | New hire joins | Create identity, assign apps, notify team | Delayed access, manual errors, no audit trail |
| **Mover** | Role/team change | Remove old access, grant new access | Access accumulation, Least Privilege violation |
| **Leaver** | Employee exits | Revoke ALL access immediately | Ex-employee retains access — #1 insider threat vector |

### Why it matters

> The average time to fully deprovision a leaver without automation: **3–7 days**.
> During this window, a terminated employee retains full system access.
> **20% of data breaches involve former employees with active credentials.**

This project automates the **Joiner** phase end-to-end and demonstrates the architectural pattern for Mover and Leaver phases.

---

## 🔄 Flow Diagram

```
User Created in Auth0
        │
        ▼
┌───────────────────────────────┐
│  Post User Registration       │
│  Trigger fires                │
│  (Auth0 Action executes)      │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│  Read Profile Attributes      │
│                               │
│  • email                      │
│  • given_name / family_name   │
│  • user_metadata.department   │
│  • user_metadata.jobTitle     │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│  Get Management API Token     │
│  (Client Credentials flow)    │
│                               │
│  POST /oauth/token            │
│  grant_type: client_creds     │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│  Department Routing           │
│  (If / Else logic)            │
│                               │
│  engineering  → [engineering] │
│  hr / finance → [hr-finance]  │
│  other        → [no dept role]│
│                               │
│  ALL users → [all-employees]  │
└───────────────┬───────────────┘
                │
        ┌───────┴────────┐
        ▼                ▼
┌──────────────┐  ┌──────────────┐
│ Assign Roles │  │ Assign Roles │
│ Engineering  │  │ HR Finance   │
└──────┬───────┘  └──────┬───────┘
        └───────┬────────┘
                ▼
┌───────────────────────────────┐
│  Assign all-employees role    │
│  (universal, every user)      │
└───────────────┬───────────────┘
                │
        ┌───────┴────────┐
        ▼                ▼
┌──────────────┐  ┌──────────────┐
│   Slack      │  │  Google      │
│ Notification │  │  Sheets      │
│ #iam-alerts  │  │  Audit Row   │
└──────────────┘  └──────────────┘
                │
                ▼
┌───────────────────────────────┐
│  Error Handler                │
│  try/catch on every step      │
│  Logs failures without crash  │
└───────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Component | Technology | Purpose | Production Equivalent |
|-----------|-----------|---------|----------------------|
| Identity Provider | Auth0 (Free Tier) | User store + event trigger | Okta Workforce Identity Cloud |
| Automation Engine | Auth0 Actions | JML workflow logic | Okta Workflows |
| Role Management | Auth0 Management API | Assign roles to users | Okta Groups API |
| Notification | Slack Incoming Webhook | Real-time team alerts | Slack / ServiceNow |
| Audit Log | Google Sheets API | Compliance evidence trail | Splunk / Datadog / SIEM |
| Runtime | Node.js 22 | Action execution environment | Node.js |
| HTTP Client | axios 0.27.2 | API calls from Action | Built-in Okta connectors |

---

## 📁 Project Structure

```
jml-automation-pipeline/
│
├── README.md                          ← You are here
├── LICENSE
├── .env.example                       ← Template for secrets
│
├── src/
│   ├── actions/
│   │   └── jml-new-hire-action.js     ← Main Auth0 Action code
│   └── scripts/
│       ├── create-roles.sh            ← Auth0 CLI: create roles
│       ├── test-payload.json          ← Test payload for Action
│       └── verify-assignment.sh       ← Verify roles were assigned
│
├── docs/
│   ├── SETUP.md                       ← Step-by-step setup guide
│   ├── ARCHITECTURE.md                ← Deep architecture explanation
│   ├── DEBUGGING.md                   ← Common errors + fixes
│   ├── JML-CONCEPTS.md                ← What is JML, why it matters
│   └── OKTA-MAPPING.md                ← How this maps to Okta
│
├── audit-samples/
│   └── sample-audit-log.csv           ← Example Google Sheets output
│
└── .github/
    └── ISSUE_TEMPLATE/
        └── bug-report.md
```

---

## ⚙️ Setup Guide

### Prerequisites

```
✓ Auth0 account (free) — auth0.com
✓ Slack workspace (free) — slack.com
✓ Google account — for Google Sheets
✓ Google Cloud project — console.cloud.google.com (free)
```

### Step 1 — Clone this repository

```bash
git clone https://github.com/VS-cyber-sec/jml-automation-pipeline.git
cd jml-automation-pipeline
```

### Step 2 — Create Auth0 roles

In Auth0 Dashboard → **User Management → Roles**, create:

| Role Name | Description |
|-----------|-------------|
| `all-employees` | Assigned to every user on registration |
| `engineering` | Engineering department access |
| `hr-finance` | HR and Finance department access |

Note each **Role ID** from the URL after creating:
```
https://manage.auth0.com/dashboard/us/YOUR-TENANT/roles/rol_XXXXXXXXXX
                                                              ^^^^^^^^^^^
                                                              copy this
```

### Step 3 — Create Machine-to-Machine app

Auth0 Dashboard → **Applications → + Create Application**

```
Name:   JML Workflows M2M
Type:   Machine to Machine Applications
API:    Auth0 Management API
```

Required permissions:
```
☑ read:users
☑ update:users
☑ read:roles
☑ create:role_members
```

### Step 4 — Set up Slack webhook

1. Go to `https://api.slack.com/apps`
2. Create App → From scratch → name: `IAM JML Bot`
3. Incoming Webhooks → Activate → Add to workspace
4. Select channel `#iam-alerts` → Allow
5. Copy webhook URL

### Step 5 — Set up Google Sheets audit log

1. Create spreadsheet named `Auth0 JML Audit Log`
2. Add headers in Row 1:

```
A: Timestamp | B: Event | C: User Email | D: Department | E: Roles | F: Status
```

3. Enable Google Sheets API at `console.cloud.google.com`
4. Create API Key under **Credentials**
5. Copy **Spreadsheet ID** from URL

### Step 6 — Create the Auth0 Action

Auth0 Dashboard → **Actions → Library → + Create Action**

```
Name:     JML New Hire Onboarding
Trigger:  Post User Registration
Runtime:  Node 22
```

Add module:
```
Name: axios  |  Version: 0.27.2
```

Add secrets (🔑 icon):

| Key | Value |
|-----|-------|
| `AUTH0_DOMAIN` | `dev-xxxx.us.auth0.com` |
| `MGMT_CLIENT_ID` | From M2M app settings |
| `MGMT_CLIENT_SECRET` | From M2M app settings |
| `ROLE_ID_ALL_EMPLOYEES` | `rol_XXXXXXXXXX` |
| `ROLE_ID_ENGINEERING` | `rol_XXXXXXXXXX` |
| `ROLE_ID_HR_FINANCE` | `rol_XXXXXXXXXX` |
| `SLACK_WEBHOOK_URL` | `https://hooks.slack.com/...` |
| `GOOGLE_SHEET_ID` | From spreadsheet URL |
| `GOOGLE_API_KEY` | From Google Cloud Console |

Paste code from `src/actions/jml-new-hire-action.js` → **Deploy**.

### Step 7 — Attach to registration flow

**Actions → Flows → Post User Registration**

Drag **JML New Hire Onboarding** between Start and Complete → **Apply**.

---

## 🔧 Configuration

### .env.example

```bash
# Auth0 Configuration
AUTH0_DOMAIN=dev-xxxx.us.auth0.com
MGMT_CLIENT_ID=your_m2m_client_id
MGMT_CLIENT_SECRET=your_m2m_client_secret

# Role IDs
ROLE_ID_ALL_EMPLOYEES=rol_XXXXXXXXXX
ROLE_ID_ENGINEERING=rol_XXXXXXXXXX
ROLE_ID_HR_FINANCE=rol_XXXXXXXXXX

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00/B00/XXXXXXXX

# Google Sheets
GOOGLE_SHEET_ID=your_spreadsheet_id
GOOGLE_API_KEY=your_google_api_key
```

> ⚠️ **Never commit real secrets.** All secrets are stored in Auth0's encrypted Secrets store and accessed via `event.secrets`.

---

## 🧪 Testing

### Test payload

Use this in the Action test panel (▶ Run):

```json
{
  "user": {
    "user_id": "auth0|REAL_USER_ID_FROM_DASHBOARD",
    "email": "jane.engineer@example.com",
    "given_name": "Jane",
    "family_name": "Engineer",
    "user_metadata": {
      "department": "Engineering",
      "jobTitle": "Software Engineer"
    }
  }
}
```

> ⚠️ Use a **real user ID** from Auth0 Dashboard → Users → click user → copy User ID.
> The fake ID `auth0|test123` returns 404 because the user does not exist in the directory.

### Expected successful output

```
Domain check: loaded
Client ID check: loaded
Secret check: loaded
JML triggered for: jane.engineer@example.com | Department: Engineering
Requesting token from: https://dev-xxxx.us.auth0.com/oauth/token
Management API token obtained successfully ✓
Adding role: all-employees
Routing: Engineering branch ✓
Total roles to assign: 2 [...]
Assigning roles at: https://dev-xxxx.us.auth0.com/api/v2/users/auth0|.../roles
Roles assigned successfully ✓
Slack notification sent ✓
Audit log written to Google Sheets ✓
JML flow completed for jane.engineer@example.com ✓
```

### Verify role assignment

Auth0 Dashboard → **Users** → click test user → **Roles tab**:

```
✓ all-employees
✓ engineering
✗ hr-finance    ← correctly NOT assigned (Least Privilege)
```

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 👤 Author

**Vaishnavi Chavan**

---

