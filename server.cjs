const http = require("http");
const fs = require("fs");
const path = require("path");
const ldap = require("ldapjs");
const nodemailer = require("nodemailer");

const PORT = Number(process.env.PORT || 3000);
const TASKS_FILE = path.join(__dirname, "tasks.json");
const DIST_DIR = path.join(__dirname, "dist");
const ROLE_MAPPING_FILE = path.join(__dirname, "role-mapping.json");

// LDAP Configuration
const LDAP_SERVER = "ldap://10.18.0.32:389";
const LDAP_DOMAIN = "snpl";
const LDAP_BASE_DN = "DC=snpl,DC=net,DC=np";

// SMTP Configuration - Update these with your actual SMTP details
const SMTP_HOST = "192.168.70.89";       // Your SMTP server IP/hostname
const SMTP_PORT = 25;                  // Your SMTP port
const SMTP_SECURE = false;             // true for 465, false for other ports
const SMTP_USER = "";                  // SMTP username (leave empty if no auth)
const SMTP_PASS = "";                  // SMTP password (leave empty if no auth)
const EMAIL_FROM = "bsstaskcalendar@ncell.com.np";  // Sender email address
const APP_URL = "http://10.74.2.247:8001/";           // Your app URL for the link in emails

const DEFAULT_ROLE_MAPPING = {
  managers: [],
  bss_team: [],
  viewers: [],
  members: [],
  emails: {},
};

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const smtpTransporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  ...(SMTP_USER ? { auth: { user: SMTP_USER, pass: SMTP_PASS } } : {}),
  tls: { rejectUnauthorized: false },
});

function ensureJsonFile(filePath, fallbackValue) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallbackValue, null, 2), "utf-8");
  }
}

function readJsonFile(filePath, fallbackValue) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallbackValue;
  }
}

ensureJsonFile(TASKS_FILE, []);
ensureJsonFile(ROLE_MAPPING_FILE, DEFAULT_ROLE_MAPPING);

function getRoleMapping() {
  const mapping = readJsonFile(ROLE_MAPPING_FILE, DEFAULT_ROLE_MAPPING);
  return {
    managers: Array.isArray(mapping.managers) ? mapping.managers : [],
    bss_team: Array.isArray(mapping.bss_team) ? mapping.bss_team : [],
    viewers: Array.isArray(mapping.viewers) ? mapping.viewers : [],
    members: Array.isArray(mapping.members) ? mapping.members : [],
    emails: mapping.emails && typeof mapping.emails === "object" ? mapping.emails : {},
  };
}

function getUserRole(username) {
  const mapping = getRoleMapping();
  const lowerUsername = username.toLowerCase();

  if (mapping.managers.some((user) => user.toLowerCase() === lowerUsername)) return "manager";
  if (mapping.bss_team.some((user) => user.toLowerCase() === lowerUsername)) return "bss_team";
  if (mapping.viewers.some((user) => user.toLowerCase() === lowerUsername)) return "viewer";

  return "member";
}

function getEmailFromMapping(username) {
  const mapping = getRoleMapping();
  const lowerUsername = username.toLowerCase();

  for (const [mappedUser, mappedEmail] of Object.entries(mapping.emails)) {
    if (mappedUser.toLowerCase() === lowerUsername && typeof mappedEmail === "string" && mappedEmail.trim()) {
      return mappedEmail.trim();
    }
  }

  return null;
}

function ldapAuthenticate(username, password) {
  return new Promise((resolve, reject) => {
    const client = ldap.createClient({ url: LDAP_SERVER, timeout: 5000, connectTimeout: 5000 });
    let settled = false;

    const finish = (error, user) => {
      if (settled) return;
      settled = true;
      try {
        client.unbind();
      } catch {
        // no-op
      }

      if (error) {
        reject(error);
        return;
      }

      resolve(user);
    };

    client.on("error", (err) => finish(new Error(`LDAP connection error: ${err.message}`)));

    client.bind(`${LDAP_DOMAIN}\\${username}`, password, (bindError) => {
      if (bindError) {
        finish(new Error("Invalid credentials"));
        return;
      }

      client.search(
        LDAP_BASE_DN,
        {
          filter: `(sAMAccountName=${username})`,
          scope: "sub",
          attributes: ["displayName", "cn", "userPrincipalName", "sAMAccountName"],
        },
        (searchError, searchResponse) => {
          if (searchError) {
            finish(null, {
              id: `ldap-${username}`,
              name: username,
              username,
              role: getUserRole(username),
            });
            return;
          }

          let userInfo = null;

          searchResponse.on("searchEntry", (entry) => {
            const attributes = {};

            if (entry.pojo?.attributes) {
              entry.pojo.attributes.forEach((attribute) => {
                attributes[attribute.type] = attribute.values ? attribute.values[0] : "";
              });
            }

            userInfo = attributes;
          });

          searchResponse.on("error", () => {
            finish(null, {
              id: `ldap-${username}`,
              name: username,
              username,
              role: getUserRole(username),
            });
          });

          searchResponse.on("end", () => {
            finish(null, {
              id: `ldap-${username}`,
              name: userInfo?.displayName || userInfo?.cn || username,
              username,
              role: getUserRole(username),
            });
          });
        }
      );
    });
  });
}

function ldapLookupEmail(username) {
  return new Promise((resolve) => {
    const client = ldap.createClient({ url: LDAP_SERVER, timeout: 5000, connectTimeout: 5000 });
    let settled = false;

    const finish = (email) => {
      if (settled) return;
      settled = true;
      try {
        client.unbind();
      } catch {
        // no-op
      }
      resolve(email);
    };

    client.on("error", () => finish(null));

    client.search(
      LDAP_BASE_DN,
      {
        filter: `(sAMAccountName=${username})`,
        scope: "sub",
        attributes: ["userPrincipalName"],
      },
      (searchError, searchResponse) => {
        if (searchError) {
          finish(null);
          return;
        }

        let email = null;

        searchResponse.on("searchEntry", (entry) => {
          if (entry.pojo?.attributes) {
            entry.pojo.attributes.forEach((attribute) => {
              if (attribute.type === "userPrincipalName" && attribute.values?.[0]) {
                email = attribute.values[0];
              }
            });
          }
        });

        searchResponse.on("error", () => finish(null));
        searchResponse.on("end", () => finish(email));
      }
    );
  });
}

async function resolveEmail(username) {
  const configuredEmail = getEmailFromMapping(username);
  if (configuredEmail) {
    console.log(`[notify] Using email from role-mapping.json for ${username}: ${configuredEmail}`);
    return configuredEmail;
  }

  const ldapEmail = await ldapLookupEmail(username);
  if (ldapEmail) {
    console.log(`[notify] Using LDAP userPrincipalName for ${username}: ${ldapEmail}`);
  }

  return ldapEmail;
}

async function sendNotificationEmail(recipientEmail, recipientName, type) {
  if (!recipientEmail) {
    console.log(`[notify] No email address found for ${recipientName}, skipping notification.`);
    return false;
  }

  const subject = "Pending Approval";
  const salutation = type === "manager" ? "Dear Manager" : "Dear User";
  const html = `
    <p>${salutation},</p>
    <p>There is pending approval for you from <b>BSS Task Calendar</b>.</p>
    <p>Please visit the link below and approve it:</p>
    <p><a href="${APP_URL}">${APP_URL}</a></p>
    <br/>
    <p>Regards,<br/>BSS Task Calendar</p>
  `;

  try {
    console.log(`[mail] Sending notification to ${recipientEmail}`);
    await smtpTransporter.sendMail({
      from: EMAIL_FROM,
      to: recipientEmail,
      subject,
      html,
    });
    console.log(`[mail] Notification sent successfully to ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error(`[mail] Failed to send email to ${recipientEmail}: ${error.message}`);
    return false;
  }
}

async function sendTaskEventEmail(recipientEmail, recipientName, recipientRole, payload) {
  if (!recipientEmail) {
    console.log(`[notify] No email address found for ${recipientName}, skipping task-event notification.`);
    return false;
  }

  const actionLabel =
    payload.action === "added" ? "added" : payload.action === "edited" ? "edited" : "deleted";
  const subject = `BSS Task Calendar — Task ${actionLabel}: ${payload.taskTitle}`;
  const salutation = recipientRole === "bss_team" ? `Dear ${recipientName}` : `Dear ${recipientName}`;
  const dateLine = payload.assignedDate ? `<p><b>Scheduled date:</b> ${payload.assignedDate}</p>` : "";

  const html = `
    <p>${salutation},</p>
    <p>A task has been <b>${actionLabel}</b> in the <b>BSS Task Calendar</b>.</p>
    <p><b>Title:</b> ${payload.taskTitle}</p>
    <p><b>${actionLabel === "added" ? "Created by" : actionLabel === "edited" ? "Edited by" : "Deleted by"}:</b> ${payload.actorName}</p>
    ${dateLine}
    <p><b>When:</b> ${new Date().toLocaleString()}</p>
    <p>Open the calendar: <a href="${APP_URL}">${APP_URL}</a></p>
    <br/>
    <p>Regards,<br/>BSS Task Calendar</p>
  `;

  try {
    console.log(`[mail] Sending task-event (${actionLabel}) notification to ${recipientEmail}`);
    await smtpTransporter.sendMail({ from: EMAIL_FROM, to: recipientEmail, subject, html });
    return true;
  } catch (error) {
    console.error(`[mail] Failed to send task-event email to ${recipientEmail}: ${error.message}`);
    return false;
  }
}

async function notifyTaskEvent(payload) {
  const mapping = getRoleMapping();
  const recipients = [
    ...mapping.managers.map((u) => ({ username: u, role: "manager" })),
    ...mapping.bss_team.map((u) => ({ username: u, role: "bss_team" })),
  ];

  let delivered = 0;
  for (const r of recipients) {
    const email = await resolveEmail(r.username);
    if (await sendTaskEventEmail(email, r.username, r.role, payload)) delivered += 1;
  }
  return { attempted: recipients.length, delivered };
}

async function sendCatalogEventEmail(recipientEmail, recipientName, payload) {
  if (!recipientEmail) return false;

  const typeLabel = payload.requestType.toUpperCase();
  let subject;
  let intro;
  if (payload.phase === "submitted") {
    subject = `Product Catalog — ${typeLabel} request needs approval: ${payload.productName}`;
    intro = `A new <b>${typeLabel}</b> request has been submitted for catalog item <b>${payload.productName}</b> and is awaiting manager approval.`;
  } else if (payload.phase === "approved") {
    subject = `Product Catalog — ${typeLabel} approved: ${payload.productName}`;
    intro = `A <b>${typeLabel}</b> request for catalog item <b>${payload.productName}</b> has been <b>approved</b>.`;
  } else {
    subject = `Product Catalog — ${typeLabel} rejected: ${payload.productName}`;
    intro = `A <b>${typeLabel}</b> request for catalog item <b>${payload.productName}</b> has been <b>rejected</b>.`;
  }

  const changesLine = payload.changesMade
    ? `<p><b>Changes Made:</b> ${payload.changesMade}</p>`
    : "";
  const reasonLine = payload.reason ? `<p><b>Reason:</b> ${payload.reason}</p>` : "";
  const reviewerLine = payload.reviewedBy
    ? `<p><b>Reviewed by:</b> ${payload.reviewedBy}</p>`
    : "";
  const commentLine = payload.comment
    ? `<p><b>Reviewer comment:</b> ${payload.comment}</p>`
    : "";

  const html = `
    <p>Dear ${recipientName},</p>
    <p>${intro}</p>
    <p><b>Requested by:</b> ${payload.requestedBy}</p>
    ${changesLine}
    ${reasonLine}
    ${reviewerLine}
    ${commentLine}
    <p><b>When:</b> ${new Date().toLocaleString()}</p>
    <p>Open the catalog: <a href="${APP_URL}/catalog">${APP_URL}/catalog</a></p>
    <br/>
    <p>Regards,<br/>BSS Task Calendar</p>
  `;

  try {
    console.log(`[mail] Sending catalog-event (${payload.phase}/${payload.requestType}) to ${recipientEmail}`);
    await smtpTransporter.sendMail({ from: EMAIL_FROM, to: recipientEmail, subject, html });
    return true;
  } catch (error) {
    console.error(`[mail] Failed to send catalog-event email to ${recipientEmail}: ${error.message}`);
    return false;
  }
}

async function notifyCatalogEvent(payload) {
  const mapping = getRoleMapping();
  // Submitted -> notify managers (for approval) + bss_team (awareness)
  // Approved/Rejected -> notify managers + bss_team
  const usernames = Array.from(
    new Set([...(mapping.managers || []), ...(mapping.bss_team || [])])
  );

  let delivered = 0;
  for (const username of usernames) {
    const email = await resolveEmail(username);
    if (await sendCatalogEventEmail(email, username, payload)) delivered += 1;
  }
  return { attempted: usernames.length, delivered };
}

async function notifyManagers() {
  const { managers } = getRoleMapping();

  if (managers.length === 0) {
    console.log("[notify] No managers configured in role-mapping.json");
    return { attempted: 0, delivered: 0 };
  }

  let delivered = 0;

  for (const managerUsername of managers) {
    const email = await resolveEmail(managerUsername);
    console.log(`[notify] Manager ${managerUsername} resolved to ${email || "NOT FOUND"}`);

    if (await sendNotificationEmail(email, managerUsername, "manager")) {
      delivered += 1;
    }
  }

  return { attempted: managers.length, delivered };
}

function serveStatic(req, res) {
  const requestedPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  let filePath = path.join(DIST_DIR, requestedPath);

  if (!fs.existsSync(filePath)) {
    filePath = path.join(DIST_DIR, "index.html");
  }

  const contentType = MIME_TYPES[path.extname(filePath)] || "application/octet-stream";

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not Found");
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/api/login" && req.method === "POST") {
    try {
      const { username, password } = JSON.parse(await readBody(req));

      if (!username || !password) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Username and password required" }));
        return;
      }
/*
      // Check for dummy users first (no LDAP needed)
      const roleMapping = getRoleMapping();
      const dummyUsers = roleMapping.dummy_users || {};
      if (dummyUsers[username] && dummyUsers[username].password === password) {
        const dummyConfig = dummyUsers[username];
        const dummyUser = {
          id: "dummy-" + username.replace("dummy_", ""),
          name: dummyConfig.name,
          username: username,
          role: dummyConfig.role,
        };
        // Add to role arrays if not already present for proper role detection
        if (dummyConfig.role === "manager" && !roleMapping.managers.includes(username)) {
          // Role is set directly from config
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, user: dummyUser }));
        return;
      }
*/
// In your /api/login handler, ADD THIS AT THE TOP before any LDAP code:
      const roleMapping = require('./role-mapping.json');
      const dummyUsers = roleMapping.dummy_users || {};

      if (dummyUsers[username] && dummyUsers[username].password === password) {
        const user = dummyUsers[username];
       /* return res.json({ success: true, user: { username, role: user.role, displayName: user.displayName } }); */
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, user: { id: "dummy-" + username, name: user.displayName || username, username, role: user.role } }));
        return;
      }

// ... existing LDAP authentication code below ...


      const user = await ldapAuthenticate(username, password);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, user }));
      return;
    } catch (error) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message || "Authentication failed" }));
      return;
    }
  }

  if (req.url === "/api/notify" && req.method === "POST") {
    try {
      const body = JSON.parse(await readBody(req));
      const { type, username } = body;
      console.log(`[notify] Incoming request type=${type}${username ? ` username=${username}` : ""}`);

      if (type === "manager") {
        const result = await notifyManagers();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, ...result }));
        return;
      }

      if (type === "user" && username) {
        const email = await resolveEmail(username);
        console.log(`[notify] User ${username} resolved to ${email || "NOT FOUND"}`);
        const delivered = await sendNotificationEmail(email, username, "user");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, delivered }));
        return;
      }

      if (type === "task_event" && body.action && body.taskTitle) {
        const result = await notifyTaskEvent({
          action: body.action,
          taskTitle: body.taskTitle,
          actorName: body.actorName || "Unknown",
          assignedDate: body.assignedDate,
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, ...result }));
        return;
      }

      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid notification payload" }));
      return;
    } catch (error) {
      console.error(`[notify] Notification error: ${error.message}`);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
      return;
    }
  }

  if (req.url === "/api/tasks" && req.method === "GET") {
    try {
      const data = fs.readFileSync(TASKS_FILE, "utf-8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(data);
      return;
    } catch {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("[]");
      return;
    }
  }

  if (req.url === "/api/tasks" && req.method === "PUT") {
    try {
      const body = await readBody(req);
      JSON.parse(body);
      fs.writeFileSync(TASKS_FILE, body, "utf-8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end('{"success":true}');
      return;
    } catch (error) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `Invalid JSON: ${error.message}` }));
      return;
    }
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`\n[server] BSS Task Calendar running at http://localhost:${PORT}`);
  console.log(`[server] LDAP Server: ${LDAP_SERVER}`);
  console.log(`[server] SMTP Host: ${SMTP_HOST}:${SMTP_PORT}`);
  console.log(`[server] Email From: ${EMAIL_FROM}`);
  console.log(`[server] App URL: ${APP_URL}`);
  console.log(`[server] Tasks stored in: ${TASKS_FILE}`);
  console.log(`[server] Role mapping: ${ROLE_MAPPING_FILE}`);
  console.log(`[server] Serving frontend from: ${DIST_DIR}\n`);
});
