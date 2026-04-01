require("dotenv").config();

const startBot = require("./whatsapp");
const getAIReply = require("./ai");

const TARGET_NUMBER = (process.env.TARGET_NUMBER || "").replace(/\D/g, "");
const TARGET_JID = TARGET_NUMBER ? `${TARGET_NUMBER}@s.whatsapp.net` : "";
const TARGET_LID_RAW = (process.env.TARGET_LID || "").trim();
const TARGET_LID = TARGET_LID_RAW
  ? TARGET_LID_RAW.includes("@lid")
    ? TARGET_LID_RAW
    : `${TARGET_LID_RAW}@lid`
  : "";
const DEBUG_MESSAGES = process.env.DEBUG_MESSAGES === "1";
const REPLY_DELAY_MS = Number(process.env.REPLY_DELAY_MS || 15000);

const lidToJid = new Map();
const SCHEDULED_MESSAGES = [
  { time: "12:00", text: "da evidya" },
  { time: "12:10", text: "da evidya" },
  { time: "13:30", text: "da evidya" },
  { time: "13:27", text: "da evidya koii" },

  { time: "21:30", text: "nee epo bangalore ano" },
];

function getSenderJid(msg) {
  const remote = msg?.key?.remoteJid || "";
  const participant = msg?.key?.participant || msg?.participant || "";

  if (remote.endsWith("@lid") && participant) return participant;
  if (remote.endsWith("@lid") && lidToJid.has(remote))
    return lidToJid.get(remote);
  return remote;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTargetChatId() {
  return TARGET_LID || TARGET_JID;
}

function startDailyScheduler(sock) {
  const lastSent = new Map();
  const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  setInterval(async () => {
    try {
      const now = new Date();
      const hhmm = timeFormatter.format(now); // "HH:MM" in Asia/Kolkata
      const today = dateFormatter.format(now); // "YYYY-MM-DD" in Asia/Kolkata

      const targetChatId = getTargetChatId();
      if (!targetChatId) return;

      for (const item of SCHEDULED_MESSAGES) {
        if (item.time !== hhmm) continue;

        const key = `${item.time}-${today}`;
        if (lastSent.get(item.time) === key) continue;

        await sock.sendMessage(targetChatId, { text: item.text });
        lastSent.set(item.time, key);

        if (DEBUG_MESSAGES) {
          console.log("Scheduled message sent:", item.time, item.text);
        }
      }
    } catch (err) {
      console.error("Scheduler error", err);
    }
  }, 20000); // check every 20 seconds
}

function extractText(message) {
  if (!message) return "";

  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text)
    return message.extendedTextMessage.text;
  if (message.imageMessage?.caption) return message.imageMessage.caption;
  if (message.videoMessage?.caption) return message.videoMessage.caption;

  const ephemeral = message.ephemeralMessage?.message;
  if (ephemeral) return extractText(ephemeral);

  return "";
}

async function run() {
  if (!TARGET_JID) {
    throw new Error("TARGET_NUMBER is missing. Set it in your .env file.");
  }

  console.log("Target JID:", TARGET_JID);
  if (TARGET_LID) {
    console.log("Target LID:", TARGET_LID);
  }

  const sock = await startBot();
  startDailyScheduler(sock);

  sock.ev.on("contacts.upsert", (contacts) => {
    for (const c of contacts || []) {
      if (c.lid && c.jid) {
        lidToJid.set(c.lid, c.jid);
      } else if (c.id?.endsWith("@lid") && c.jid) {
        lidToJid.set(c.id, c.jid);
      }
    }
  });

  sock.ev.on("messaging-history.set", ({ contacts }) => {
    for (const c of contacts || []) {
      if (c.lid && c.jid) {
        lidToJid.set(c.lid, c.jid);
      } else if (c.id?.endsWith("@lid") && c.jid) {
        lidToJid.set(c.id, c.jid);
      }
    }
  });

  sock.ev.on("chats.phoneNumberShare", ({ lid, jid }) => {
    if (lid && jid) {
      lidToJid.set(lid, jid);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const msg = messages?.[0];
      if (!msg?.message) return;
      if (msg.key.fromMe) return;

      const chatJid = msg.key.remoteJid || "";
      const senderJid = getSenderJid(msg);
      if (DEBUG_MESSAGES) {
        const preview = extractText(msg.message);
        console.log("Incoming message meta:", {
          chatJid,
          senderJid,
          participant: msg.key.participant || msg.participant || "",
          fromMe: msg.key.fromMe,
          hasMessage: !!msg.message,
          textPreview: preview,
          mappedJid: lidToJid.get(chatJid) || "",
        });
      }
      if (!chatJid || chatJid.endsWith("@g.us")) return;
      const isTarget =
        senderJid === TARGET_JID ||
        (TARGET_LID && (senderJid === TARGET_LID || chatJid === TARGET_LID)) ||
        (senderJid.endsWith("@lid") &&
          lidToJid.get(senderJid) === TARGET_JID) ||
        (chatJid.endsWith("@lid") && lidToJid.get(chatJid) === TARGET_JID);

      if (!isTarget) return;

      const text = extractText(msg.message);
      if (!text) return;

      console.log("Message from target:", text);

      if (REPLY_DELAY_MS > 0) {
        await sleep(REPLY_DELAY_MS);
      }

      const reply = await getAIReply(text);
      if (!reply) return;

      await sock.sendMessage(chatJid, { text: reply });
    } catch (err) {
      console.error("Failed to handle message", err);
    }
  });
}

run().catch((err) => console.error("Bot crashed", err));
