## Scope assessment

This request mixes **small, surgical fixes** (FIX 1, FIX 2, parts of FIX 3) with **full feature rebuilds** (most of FIX 4, FIX 5). I want explicit approval before doing the heavy ones, because some sections (Leaderboard, Calendar, Contests, Training, FAQ, Directory, Tickets management) are 100–500 line implementations each and would require ~3000+ lines of new code plus possibly new tables/columns.

Below is what I'll do per fix. **I will execute FIX 1, FIX 2, and the form-additions part of FIX 3 immediately on approval.** For FIX 4 and FIX 5 I list what already exists vs what's truly missing, and ask you to confirm scope before I start.

---

## FIX 1 — Date of birth placeholder (small, ~6 lines)

- `Account360ProfileEditDialog.tsx` line 251: replace `{form.date_of_birth || "—"}` → `{form.date_of_birth || "Non renseignée"}`.
- `Account360Sections.tsx` line 39: change `fmtDate(prof?.date_of_birth)` to `prof?.date_of_birth ? fmtDate(prof.date_of_birth) : "Non renseignée"` (helper currently returns "—" or "Date non disponible").

## FIX 2 — Field agent profile completeness (~150 lines added to FieldProfile.tsx)

Current query only selects `full_name, email, phone, avatar_url`. I'll extend to:
- Add `address_street, address_city, address_province, address_postal, date_of_birth, emergency_contact_name, emergency_contact_phone, payment_method` to the `profiles` select.
- Join `field_territories` for territory name (currently shows raw UUID).
- Add new editable section "Adresse domicile" (street/city/province/postal).
- Add new editable section "Contact d'urgence" (name/phone).
- Add read-only "Date de naissance" formatted `15 janvier 1990`, "Méthode de paiement", improved territory name.
- Replace all `"—"` placeholders with `"Non renseigné"`.
- Update mutation to persist new editable fields.

## FIX 3 — Core agent creation form additions

I'll read `CoreFieldAgentsPage.tsx` (2102 lines) and locate the existing creation dialog. I'll add the missing fields you listed (DOB, home address, emergency contact + relation, monthly target, payment method + interac/paypal email) into the existing form, organized as visual steps/sections (single dialog with grouped sections — not a wizard, to keep the change focused). On save: update profiles with all fields, upsert into `sales_targets` if monthly target > 0, upsert `field_territory_assignments` if territory selected, and invoke the existing invitation send (assuming one exists; otherwise I'll wire it via supabase admin invite).

**Note**: "stored encrypted" for DOB — `profiles.date_of_birth` is currently a plain `date` column. True encryption requires pgcrypto + key management which is out of scope here. I'll store it as-is in the existing column unless you want a separate migration.

## FIX 4 — Nivra Source sections (LARGE — needs your call)

Audit of current state:

| Section | File | State |
|---|---|---|
| Annonces | `HubAnnouncements.tsx` (62 lines) | Basic list, no pinned/badges/reactions/view count |
| Feed | `sections/HubFeed.tsx` (117 lines) | Basic list |
| Documents | `HubDocuments.tsx` | Has category filter, basic |
| Boutique | `sections/HubStore.tsx` | Already rebuilt ✅ |
| Leaderboard | `HubLeaderboard.tsx` | Need to inspect |
| Calendrier | `HubCalendar.tsx` | List view only — no monthly grid |
| Concours | `sections/HubContests.tsx` | Basic |
| Conseils | `sections/HubTips.tsx` | Basic |
| Forfaits & Prix | `sections/HubPricing.tsx` | Basic |
| Formulaires | `HubForms.tsx` | Need to inspect |
| Mes tickets | `sections/HubMyTickets.tsx` | Need to inspect |
| Formation | `sections/HubTraining.tsx` | Basic |
| FAQ | `sections/HubFaq.tsx` | Basic |
| Annuaire | `sections/HubDirectory.tsx` | Basic |

A full rebuild of all 13 sections to the level you described (monthly calendar grid, video player + quiz + certificates for training, voting on FAQ, real-time tickets, reaction system + view counter on every post, etc.) is **a multi-day, ~3000+ line undertaking** that likely needs new DB tables: `hub_post_reactions`, `hub_post_views`, `hub_faq_votes`, `hub_training_progress`, `hub_quiz_responses`, `hub_certificates`, `hub_bookmarks`.

**My recommendation — ship in phases:**
- **Phase 4A (this turn, ~400 lines)**: enrich Annonces (pinned + category badges + "Nouveau" badge), Feed (better media display + "Nouveau"), Documents ("Nouveau" badge), Calendar (add monthly grid view toggle), proper empty states everywhere. No new tables.
- **Phase 4B (next request)**: reactions + view_count system (1 new table, RLS, increments on open).
- **Phase 4C (later)**: training progress/quiz/certificates, FAQ voting, contest countdown, leaderboard tier-progress.

## FIX 5 — Core admin Hub management (LARGE — needs your call)

`CoreHubManagementPage.tsx` is 1763 lines. I need to inspect what's already there before estimating. The features you listed (rich text editor, drag-and-drop multi-image upload, bulk select, internal notes on tickets, assign to staff) are individually substantial. Once I read the file I'll report back what exists vs what's missing and propose a phased delivery.

---

## What I'll do right now on approval

1. **FIX 1** — 2 small edits, immediate.
2. **FIX 2** — extend `FieldProfile.tsx` query + UI + mutation.
3. **FIX 3** — add missing fields to existing creation dialog in `CoreFieldAgentsPage.tsx`.
4. **FIX 4 Phase 4A** — pinned/badges/"Nouveau"/empty states + Calendar monthly grid.
5. **FIX 5 audit** — read `CoreHubManagementPage.tsx` and report back with a concrete plan, no edits.

Then I'll run the proof commands you listed.

**Confirm** if this phased approach is OK, or tell me to do everything in one shot and I'll proceed (warning: that will be a very large diff with higher regression risk on the protected files' neighbors).