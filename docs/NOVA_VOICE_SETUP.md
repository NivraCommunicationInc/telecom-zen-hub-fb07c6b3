# NOVA Voice Setup — ElevenLabs Conversational AI

This is the one-time setup to wire up the Jarvis-level voice for NOVA Digital Brain.

After setup, you'll be able to talk to NOVA in real time — interrupt it
mid-sentence, get sub-500ms latency, and have it execute real Nivra actions
(suspend account, credit customer, navigate the admin, etc.) by voice.

---

## Architecture

```
Browser  ──(WebSocket)──>  ElevenLabs Agent  ──(HTTPS)──>  nova-llm-openai-compat
   ↑                              │                                 │
   │                              │                                 ↓
   │                              │                           nova-brain
   │                              │                           (Claude Sonnet 4.7
   │                              │                            + 18 tools
   │                              │                            + memory + audit)
   │                              ↓
   └──── Streaming TTS (voice Charlotte FR) ◄── Reply text
```

The agent handles VOICE only (STT + TTS + VAD + interruptions).
The brain handles LOGIC (Claude Sonnet 4.7 + Nivra-specific tools).

---

## Step 1 — Pick a shared secret

Generate a strong random string (40+ chars). This protects the OpenAI-compat
endpoint so only your ElevenLabs agent can call NOVA's brain.

```bash
openssl rand -hex 32
# example: 9f3a8c... (paste into Lovable Secrets)
```

Add this as a Lovable Secret:

```
ELEVENLABS_AGENT_SECRET = <your-generated-secret>
```

---

## Step 2 — Create the agent in ElevenLabs

1. Go to https://elevenlabs.io/app/conversational-ai
2. Click **Create Agent**
3. Configure:
   - **Name**: `NOVA Digital Brain`
   - **Voice**: Charlotte (FR) — voice ID `XB0fDUnXU5powFXDhCwa`
   - **Language**: French (Canadian if available, else France French)
   - **First message**: `Bonjour ! Je suis NOVA. Comment puis-je t'aider ?`
   - **System prompt**: *(leave empty — we use the prompt baked into nova-brain)*

4. **LLM** → click **Custom LLM**:
   - **URL**:
     ```
     https://<your-project>.supabase.co/functions/v1/nova-llm-openai-compat
     ```
   - **Model ID**: `nova-brain` (any string works, just a label)
   - **API Key**: paste the same `ELEVENLABS_AGENT_SECRET` value from Step 1

5. **Advanced** → Tools: leave empty for now (tools are handled by Claude
   inside nova-brain, so ElevenLabs doesn't need to know about them).

6. **Voice settings**:
   - Stability: `0.5`
   - Similarity: `0.75`
   - Style: `0.35`
   - Speaker boost: ON
   - Speed: `1.0`

7. **Conversation behavior** (for the Jarvis feel):
   - Turn detection: **automatic VAD** (the default)
   - Interrupt sensitivity: **medium**
   - Max conversation duration: 10 min (auto-reconnects if longer)

8. Click **Save**. Copy the **Agent ID** (looks like `agent_abc123…`).

---

## Step 3 — Plug the agent into the frontend

Add to your `.env` (and Lovable Secrets):

```
VITE_NOVA_AGENT_ID = agent_abc123…
```

Then mount the component somewhere admin-only — e.g. add to `src/core-app/pages/CoreBrain.tsx`:

```tsx
import { NovaConversation } from "@/components/nova/NovaConversation";

<div className="container mx-auto py-8 max-w-3xl">
  <NovaConversation />
</div>
```

Optionally keep the text-only `NovaVoiceChat` next to it on the same page,
so admins can choose voice or text.

---

## Step 4 — Test

1. Open the page in your browser.
2. Click the big mic button.
3. Say: *"Quel est l'état du compte NIV-ACCT-000123 ?"*
4. NOVA should:
   - Hear you (visual ring animates)
   - Call `get_account_state` via tool use
   - Speak the result in Charlotte's voice

**Try interrupting**: while NOVA is talking, just speak — it should stop
within ~500ms and listen to your new input.

**Try a frontend action**: say *"ouvre le profil de Jean Tremblay"* — NOVA
calls `search_customers` then `ui_open_client_360`, the page navigates.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| 401 from `/nova-llm-openai-compat` | Wrong `ELEVENLABS_AGENT_SECRET` |
| "Aucun agent ID configuré" | `VITE_NOVA_AGENT_ID` env var missing |
| Mic permission popup never shows | HTTPS only — `localhost` works, `127.0.0.1` doesn't |
| NOVA replies with "configuration_error" | `ANTHROPIC_API_KEY` not set in Lovable Secrets |
| Voice playback fails | `ELEVENLABS_API_KEY` missing OR ElevenLabs free-tier credits exhausted |
| Tool calls don't pilot the UI | Browser blocked the navigate — check console |

---

## Cost estimate

- **ElevenLabs Conversational AI**: ~$0.10-0.15 / minute of conversation
  (Scribe STT + TTS + WebRTC).
- **Anthropic Claude Sonnet 4.7**: prompt caching makes follow-ups cheap;
  expect ~$0.005-0.02 per turn for typical queries.
- **Supabase edge function**: free up to 500K invocations/month.

Budget guideline: $10-30/day if NOVA is used 30-60 min/day for ops.
