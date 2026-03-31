# WhatsApp AI Bot (Baileys + OpenAI)

This project connects to WhatsApp via Baileys, listens to one specific number, and replies using OpenAI in Manglish (Malayalam written in English) with a friendly Malayalee girl tone.

## Setup

1. Install dependencies

```bash
npm install
```

2. Create your `.env` file

```bash
cp .env.example .env
```

3. Add your values in `.env`

- `TARGET_NUMBER` should include country code and digits only (example: `919562994337`)
- `OPENAI_API_KEY` should be your OpenAI API key

## Run

```bash
npm start
```

Scan the QR code with the WhatsApp account you want to use.

## Notes

- This is an unofficial WhatsApp integration. Use a secondary account and understand the ban risk.
- The bot ignores group chats and only responds to the configured target number.
- The bot only replies to text and captions (images/videos).

## Files

- `index.js` main bot loop
- `whatsapp.js` Baileys connection and QR handling
- `ai.js` OpenAI call and Manglish prompt
# chatbot
