/**
 * ============================================================
 * JML New Hire Onboarding — Auth0 Action
 * ============================================================

 * Trigger:  Post User Registration
 * Runtime:  Node.js 22
 * Module:   axios 0.27.2 (add via Modules panel)
 *
 * Required Secrets (add via 🔑 Secrets panel):
 *   AUTH0_DOMAIN          — dev-xxxx.us.auth0.com
 *   MGMT_CLIENT_ID        — M2M app Client ID
 *   MGMT_CLIENT_SECRET    — M2M app Client Secret
 *   ROLE_ID_ALL_EMPLOYEES — rol_XXXXXXXXXX
 *   ROLE_ID_ENGINEERING   — rol_XXXXXXXXXX
 *   ROLE_ID_HR_FINANCE    — rol_XXXXXXXXXX
 *   SLACK_WEBHOOK_URL     — https://hooks.slack.com/...
 *   GOOGLE_SHEET_ID       — spreadsheet ID from URL
 *   GOOGLE_API_KEY        — from Google Cloud Console
 *
 * Production equivalent: Okta Workflows (Post User Create trigger)
 * ============================================================
 */

const axios = require("axios");

exports.onExecutePostUserRegistration = async (event, api) => {

  // ── DEBUG: Verify all secrets loaded ─────────────────────────────────
  // Remove these lines after confirming everything works
  console.log("Domain check:    ", event.secrets.AUTH0_DOMAIN        ? "loaded ✓" : "MISSING ✗");
  console.log("Client ID check: ", event.secrets.MGMT_CLIENT_ID      ? "loaded ✓" : "MISSING ✗");
  console.log("Secret check:    ", event.secrets.MGMT_CLIENT_SECRET   ? "loaded ✓" : "MISSING ✗");
  console.log("Role (all):      ", event.secrets.ROLE_ID_ALL_EMPLOYEES ? "loaded ✓" : "MISSING ✗");
  console.log("Role (eng):      ", event.secrets.ROLE_ID_ENGINEERING   ? "loaded ✓" : "MISSING ✗");
  console.log("Role (hr):       ", event.secrets.ROLE_ID_HR_FINANCE    ? "loaded ✓" : "MISSING ✗");
  console.log("Slack:           ", event.secrets.SLACK_WEBHOOK_URL     ? "loaded ✓" : "MISSING ✗");
  console.log("Sheets:          ", event.secrets.GOOGLE_SHEET_ID       ? "loaded ✓" : "MISSING ✗");

  // ── STEP 1: Read new user profile ────────────────────────────────────
  const userEmail  = event.user.email;
  const userId     = event.user.user_id;
  const firstName  = event.user.given_name  || "New";
  const lastName   = event.user.family_name || "Hire";
  const department = event.user.user_metadata?.department || "unknown";
  const jobTitle   = event.user.user_metadata?.jobTitle   || "not specified";
  const timestamp  = new Date().toISOString();

  console.log("─".repeat(60));
  console.log(`JML JOINER FLOW STARTED`);
  console.log(`User:        ${firstName} ${lastName}`);
  console.log(`Email:       ${userEmail}`);
  console.log(`User ID:     ${userId}`);
  console.log(`Department:  ${department}`);
  console.log(`Job Title:   ${jobTitle}`);
  console.log(`Timestamp:   ${timestamp}`);
  console.log("─".repeat(60));

  // ── STEP 2: Get Management API token ─────────────────────────────────
  // Uses OAuth 2.0 Client Credentials grant (machine-to-machine)
  // Equivalent to Okta service account authentication
  let mgmtToken;

  try {
    const tokenUrl      = `https://${event.secrets.AUTH0_DOMAIN}/oauth/token`;
    const tokenAudience = `https://${event.secrets.AUTH0_DOMAIN}/api/v2/`;

    console.log(`[STEP 2] Requesting Management API token...`);
    console.log(`         URL:      ${tokenUrl}`);
    console.log(`         Audience: ${tokenAudience}`);

    const tokenResponse = await axios.post(
      tokenUrl,
      {
        client_id:     event.secrets.MGMT_CLIENT_ID,
        client_secret: event.secrets.MGMT_CLIENT_SECRET,
        audience:      tokenAudience,
        grant_type:    "client_credentials",
      },
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    mgmtToken = tokenResponse.data.access_token;

    if (!mgmtToken) {
      console.error("[STEP 2] ERROR: Token response contained no access_token");
      console.error("         Response:", JSON.stringify(tokenResponse.data));
      return;
    }

    console.log("[STEP 2] Management API token obtained successfully ✓");

  } catch (err) {
    console.error("[STEP 2] FAILED to get management token");
    console.error("         Status:", err.response?.status);
    console.error("         Error:", JSON.stringify(err.response?.data || err.message));
    console.error("         Common causes:");
    console.error("           → Using web app credentials instead of M2M app");
    console.error("           → M2M app not authorized for Management API");
    console.error("           → AUTH0_DOMAIN has https:// prefix or trailing slash");
    return; // Cannot proceed without a token
  }

  // ── STEP 3: Determine roles to assign ────────────────────────────────
  // Department-based routing — equivalent to Okta Workflows If/Else card
  // Enforces Least Privilege: only assign what the role needs
  const rolesToAssign = [];
  const dept          = department.toLowerCase().trim();

  console.log(`[STEP 3] Department routing for: "${department}"`);

  // Universal role — every employee regardless of department
  if (event.secrets.ROLE_ID_ALL_EMPLOYEES) {
    rolesToAssign.push(event.secrets.ROLE_ID_ALL_EMPLOYEES);
    console.log("         ✓ all-employees role queued");
  } else {
    console.error("         ✗ ROLE_ID_ALL_EMPLOYEES secret missing — check Secrets panel");
  }

  // Department-specific routing
  if (dept === "engineering") {

    if (event.secrets.ROLE_ID_ENGINEERING) {
      rolesToAssign.push(event.secrets.ROLE_ID_ENGINEERING);
      console.log("         ✓ engineering role queued (Engineering branch)");
    } else {
      console.error("         ✗ ROLE_ID_ENGINEERING secret missing");
    }

  } else if (dept === "hr" || dept === "finance" || dept === "hr-finance") {

    if (event.secrets.ROLE_ID_HR_FINANCE) {
      rolesToAssign.push(event.secrets.ROLE_ID_HR_FINANCE);
      console.log("         ✓ hr-finance role queued (HR/Finance branch)");
    } else {
      console.error("         ✗ ROLE_ID_HR_FINANCE secret missing");
    }

  } else {
    console.log(`         ⚠ Department "${department}" has no specific role mapping`);
    console.log("           Only all-employees will be assigned");
    console.log("           Add new department branches to the Action code as needed");
  }

  console.log(`[STEP 3] Total roles to assign: ${rolesToAssign.length}`);
  console.log("         Role IDs:", rolesToAssign);

  // ── STEP 4: Assign roles via Management API ───────────────────────────
  // POST /api/v2/users/{id}/roles
  // Equivalent to Okta Workflows "Add User to Group" card
  let rolesAssigned = false;

  if (rolesToAssign.length === 0) {
    console.error("[STEP 4] No roles to assign — skipping role assignment");
  } else {
    try {
      const assignUrl = `https://${event.secrets.AUTH0_DOMAIN}/api/v2/users/${userId}/roles`;
      console.log(`[STEP 4] Assigning ${rolesToAssign.length} role(s)...`);
      console.log(`         URL: ${assignUrl}`);

      const assignResponse = await axios.post(
        assignUrl,
        { roles: rolesToAssign },
        {
          headers: {
            Authorization:  `Bearer ${mgmtToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      // 204 No Content = success for this endpoint
      if (assignResponse.status === 204 || assignResponse.status === 200) {
        rolesAssigned = true;
        console.log("[STEP 4] Roles assigned successfully ✓");
        console.log("         Verify: Auth0 Dashboard → Users → click user → Roles tab");
      } else {
        console.error("[STEP 4] Unexpected status:", assignResponse.status);
      }

    } catch (err) {
      console.error("[STEP 4] Role assignment FAILED");
      console.error("         Status:", err.response?.status);
      console.error("         Error:", JSON.stringify(err.response?.data || err.message));

      if (err.response?.status === 404) {
        console.error("         → User ID not found in directory");
        console.error("           In test mode: use a real user ID from Auth0 Dashboard");
        console.error("           In production: this should never occur (user just registered)");
      }
      if (err.response?.status === 403) {
        console.error("         → M2M app lacks create:role_members permission");
        console.error("           Go to: Applications → JML M2M → APIs → add permission");
      }
    }
  }

  // ── STEP 5: Slack notification ────────────────────────────────────────
  // Notifies IAM team / manager of new hire provisioning
  // Equivalent to Okta Workflows Slack connector "Send Message" card

  if (!event.secrets.SLACK_WEBHOOK_URL) {
    console.log("[STEP 5] SLACK_WEBHOOK_URL not configured — skipping notification");
  } else {
    try {
      console.log("[STEP 5] Sending Slack notification...");

      const deptDisplay =
        dept === "engineering"                          ? "Engineering" :
        (dept === "hr" || dept === "finance")           ? "HR / Finance" :
        department;

      const rolesDisplay =
        dept === "engineering"                          ? "all-employees, engineering" :
        (dept === "hr" || dept === "finance")           ? "all-employees, hr-finance" :
        "all-employees";

      const statusEmoji = rolesAssigned ? "✅" : "⚠️";
      const statusText  = rolesAssigned
        ? "Access provisioned automatically. Zero manual steps."
        : "⚠️ Role assignment may have failed. Please verify manually.";

      const slackPayload = {
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `${statusEmoji} New Hire Onboarded — Auth0 JML`,
            },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Name:*\n${firstName} ${lastName}` },
              { type: "mrkdwn", text: `*Email:*\n${userEmail}` },
              { type: "mrkdwn", text: `*Department:*\n${deptDisplay}` },
              { type: "mrkdwn", text: `*Job Title:*\n${jobTitle}` },
              { type: "mrkdwn", text: `*Roles Assigned:*\n\`${rolesDisplay}\`` },
              { type: "mrkdwn", text: `*Provisioned At:*\n${timestamp}` },
            ],
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: statusText,
              },
            ],
          },
        ],
      };

      const slackResponse = await axios.post(
        event.secrets.SLACK_WEBHOOK_URL,
        slackPayload,
        { headers: { "Content-Type": "application/json" } }
      );

      if (slackResponse.status === 200) {
        console.log("[STEP 5] Slack notification sent ✓");
      } else {
        console.error("[STEP 5] Slack returned status:", slackResponse.status);
      }

    } catch (err) {
      console.error("[STEP 5] Slack notification FAILED");
      console.error("         Error:", err.response?.data || err.message);
      console.error("         Common causes:");
      console.error("           → Webhook URL is expired or revoked");
      console.error("           → Slack app was removed from workspace");
      // Non-critical — provisioning still succeeded
    }
  }

  // ── STEP 6: Google Sheets audit log ──────────────────────────────────
  // Writes one row per onboarding event for SOC 2 / ISO 27001 evidence
  // Equivalent to Okta Workflows Google Sheets "Add Row" card

  if (!event.secrets.GOOGLE_SHEET_ID || !event.secrets.GOOGLE_API_KEY) {
    console.log("[STEP 6] Google Sheets secrets not configured — skipping audit log");
  } else {
    try {
      console.log("[STEP 6] Writing audit log to Google Sheets...");

      const sheetsUrl = [
        `https://sheets.googleapis.com/v4/spreadsheets/`,
        `${event.secrets.GOOGLE_SHEET_ID}/values/`,
        `Sheet1!A:F:append`,
        `?valueInputOption=USER_ENTERED`,
        `&key=${event.secrets.GOOGLE_API_KEY}`,
      ].join("");

      const auditRow = [
        timestamp,                            // A: Timestamp
        "New Hire Onboarded",                 // B: Event type
        userEmail,                            // C: User email
        department,                           // D: Department
        rolesToAssign.join(", "),             // E: Roles assigned
        rolesAssigned ? "Success" : "Partial",// F: Status
      ];

      const sheetsResponse = await axios.post(
        sheetsUrl,
        {
          range:          "Sheet1!A:F",
          majorDimension: "ROWS",
          values:         [auditRow],
        },
        { headers: { "Content-Type": "application/json" } }
      );

      if (sheetsResponse.status === 200) {
        console.log("[STEP 6] Audit log written to Google Sheets ✓");
        console.log("         Row:", auditRow.join(" | "));
      } else {
        console.error("[STEP 6] Sheets returned status:", sheetsResponse.status);
      }

    } catch (err) {
      console.error("[STEP 6] Google Sheets FAILED");
      console.error("         Status:", err.response?.status);
      console.error("         Error:", JSON.stringify(err.response?.data || err.message));
      console.error("         Common causes:");
      console.error("           → Google Sheets API not enabled in Cloud Console");
      console.error("           → API key does not have Sheets API access");
      console.error("           → Spreadsheet ID is incorrect");
      console.error("           → Sheet tab is not named 'Sheet1'");
      // Non-critical — provisioning still succeeded
    }
  }

  // ── STEP 7: Completion summary ────────────────────────────────────────
  console.log("─".repeat(60));
  console.log("JML JOINER FLOW COMPLETED");
  console.log(`User:         ${userEmail}`);
  console.log(`Roles:        ${rolesToAssign.length} assigned`);
  console.log(`Slack:        ${event.secrets.SLACK_WEBHOOK_URL ? "sent" : "skipped"}`);
  console.log(`Audit log:    ${event.secrets.GOOGLE_SHEET_ID ? "written" : "skipped"}`);
  console.log(`Duration:     see Stats.action_duration_ms`);
  console.log(`Completed at: ${new Date().toISOString()}`);
  console.log("─".repeat(60));

};
