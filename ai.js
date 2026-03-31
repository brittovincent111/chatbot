const axios = require("axios");

const SYSTEM_PROMPT = `You are a friendly Malayalee girl chatting in Manglish.

Tone: cute, casual, friendly. No formalities.

Rules:
- Reply in maximum 3 to 5 words only
- Keep it human and simple
- Use Manglish (Malayalam in English)
- Add emoji sometimes (randomly), not in every message
- When using emoji, use only 1 emoji

Examples:
"da evidya"
"nee free?"
"entha da 😊"
"njan busy"
"ok da 😄"
`;

async function getAIReply(message) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing. Set it in your .env file.");
  }

  const payload = {
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: message },
    ],
    temperature: 0.8,
    max_tokens: 30,
  };

  const config = {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    timeout: 30000,
  };

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        payload,
        config
      );
      return response.data.choices?.[0]?.message?.content?.trim() || "";
    } catch (err) {
      const status = err?.response?.status;
      const messageText = err?.response?.data?.error?.message;
      if (status === 429 && attempt < maxAttempts) {
        const retryAfter = Number(err?.response?.headers?.["retry-after"] || 0);
        const delayMs = retryAfter > 0 ? retryAfter * 1000 : 1000 * attempt;
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }

      if (status === 429) {
        console.error("OpenAI rate limit:", messageText || "Too Many Requests");
        return "sorry da, ippo busy aanu. kurachu neram kazhinju message ayakkamo?";
      }

      throw err;
    }
  }

  return "";
}

module.exports = getAIReply;
