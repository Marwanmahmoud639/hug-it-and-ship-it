# AI Voice Caller Agent

Add an AI voice caller that dials Discovery leads, learns from objections, and can be started/paused per contact from Pipeline and Contacts.

## 1. Voice provider

Two free-tier options, wired behind one interface so we can swap without touching UI:

- **Web Speech API** (free, browser-native) — used for the in-app "Training Studio" (press-and-talk, agent speaks back). No account needed.
- **Twilio Voice + ElevenLabs TTS + OpenAI-compatible STT via Lovable AI** for real outbound calls. Twilio has a free trial ($15 credit) and is the standard free path for programmatic dialing. ElevenLabs already has a connector; we reuse it for multi-voice.

Voices: user picks per campaign/contact from the ElevenLabs voice list (Rachel, Adam, Bella, Antoni, Domi, …) plus a "Browser (Web Speech)" option for training.

If the user prefers a different provider (Vapi, Retell, Bland) I can swap — Twilio+ElevenLabs is the cheapest fully-free-to-start combo.

## 2. Database (new tables)

```text
voice_agents            id, team_id, name, voice_id, provider, system_prompt,
                        script_md, greeting, temperature, created_at
agent_knowledge         id, agent_id, team_id, kind (pdf|txt|md|url),
                        title, storage_path, extracted_text, tokens, created_at
agent_objections        id, agent_id, team_id, objection, best_response,
                        times_seen, last_seen_at, source (learned|manual)
call_runs               id, agent_id, contact_id, team_id, status
                        (queued|dialing|in_progress|completed|failed|paused),
                        started_at, ended_at, duration_sec, outcome
                        (booked|callback|not_interested|voicemail|no_answer|dnc),
                        recording_url, transcript, sentiment, cost_cents
call_events             id, call_id, ts, role (agent|lead|system), text, meta
training_sessions       id, agent_id, team_id, user_id, transcript, notes, created_at
```

Plus a `knowledge` Supabase Storage bucket (private) for uploaded PDFs/txt.

## 3. Server surface

TanStack server functions in `src/lib/voice-agent.functions.ts`:
- `listAgents`, `upsertAgent`, `deleteAgent`
- `uploadKnowledge` (accepts file → Storage → parse text server-side → row)
- `listObjections`, `upsertObjection`
- `startCall({ contactId, agentId })`, `pauseCall`, `resumeCall`, `stopCall`
- `listCalls`, `getCall(id)` (with events)
- `trainingTurn({ agentId, userText })` → agent reply text via Lovable AI, saved to `training_sessions`
- `learnFromCall(callId)` — post-call: extract objections + suggested rebuttals, upsert into `agent_objections`

Public route `src/routes/api/public/twilio-voice.ts` for Twilio's TwiML webhook (streams TTS chunks, sends caller audio to STT, loops until hangup). `TWILIO_*` secrets requested via `add_secret` when the user hits "Enable real calls".

## 4. New pages / UI

- `/_app.voice-agent` — top-level nav item "AI Caller":
  - **Agents** tab: list, create, edit (name, voice picker w/ preview, script textarea, greeting)
  - **Knowledge Base** tab: drag-drop PDF/TXT, list uploaded docs, delete
  - **Training Studio** tab: chat log + big mic button (press-and-hold to talk, agent replies out loud). Uses Web Speech API for STT/TTS in-browser.
  - **Objections** tab: table of learned objections and rebuttals, editable, sortable by frequency
  - **Calls** tab: history table (contact, outcome, duration, sentiment) with row → transcript drawer

- **Analytics/Intelligence**: new "AI Caller" section — totals (calls made, avg duration, booked %, top objections, cost).

- **Pipeline** card: small phone icon per lead → Start/Pause AI call button, live status badge.
- **Contacts** row + detail: same Start/Pause control, plus per-contact call history panel.

## 5. Objection learning loop

After each completed call:
1. `learnFromCall` sends the transcript to Lovable AI (`google/gemini-3-flash-preview`) with a structured-output prompt asking for `objections[]` (each: quote, category, suggested_rebuttal).
2. For each, upsert into `agent_objections` (increment `times_seen` if a fuzzy match exists).
3. Next call assembles the agent's system prompt as: `system_prompt` + top-N objections/rebuttals + knowledge summary — so the caller keeps getting better without user intervention.

## 6. Technical details

- Voice picker fetches ElevenLabs `/v1/voices` server-side and caches per team.
- Training Studio uses `window.SpeechRecognition` + `speechSynthesis` — zero cost, works offline-ish.
- Real calls: Twilio `<Stream>` bi-directional media WebSocket → our worker → ElevenLabs TTS stream + `openai/gpt-4o-mini-transcribe` STT → Lovable AI chat with rolling context.
- PDF parsing uses `document--parse_document` on upload; extracted text stored on the row so we can embed it into the system prompt (chunked).
- Pause/resume: `call_runs.status='paused'` short-circuits the worker loop; Twilio call is put `<Pause length="…">` or ended and re-queued.
- All new tables get GRANTs + RLS scoped by `team_id` following the project's existing pattern.

## 7. Rollout order

1. Migration + Storage bucket + GRANTs/RLS
2. Server functions + Voice Agent page (Agents / Knowledge / Objections / Calls)
3. Training Studio (Web Speech, no external deps) — this is fully usable immediately
4. Pipeline + Contacts Start/Pause buttons wired to `call_runs` (queued state)
5. Twilio + ElevenLabs webhook + secrets prompt (only step that needs user credentials)
6. Objection-learning post-call job + Intelligence widgets

Steps 1-4 give you a working trainable agent today. Step 5 turns on real phone calls once you add Twilio.
