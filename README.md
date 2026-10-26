# Trait Dough

Ephrata Middle School's Trait Dough tracker. It runs as a Google Apps Script web app on top of a
Google Sheet. It used to be a GitHub Pages page that saved to Supabase.

| Page | URL | Who uses it |
|---|---|---|
| Turn-in | `<web app URL>` | Students, on the guidance office computer, when they drop off dough. No password. |
| Staff dashboard | `<web app URL>?view=admin` | Office and admin. Password protected. |
| How it works | `<web app URL>?view=info` | Staff. Built from the **Info** tab. |

## What students enter

Name, **800 number**, grade, **team (M O U N T S)**, squad, and one card for each bill they're
turning in: the trait circled, who gave it to them, and what they did to earn it. The "what they
did" box isn't marked optional, but they can leave it blank. A stack of bills is one
submission, and each bill gets its own row on the **Submissions** tab. The page clears itself for the next
student after 20 seconds.

## Staff dashboard

- **Recent submissions**: filter by week, squad, or status, and search. Click a row's *What they did* to expand it.
  Use **Award** to make that bill a winner.
- **Weekly drawing**: draws a random bill from the week you pick. Each bill is one entry, so more dough
  means more chances. Students who already won that week are skipped (`DRAW_SKIP_PAST_WINNERS`).
- **Award**: type the points from the wheel. The bill is marked Winner, a row is added to the
  **Winners** tab (STUDENT / TEACHER / SQUAD / Grade first, the same layout as the old winners log),
  and the points are added to the Clash of Classes **events** tab when "Send to Clash" is ticked.
  Leave points blank to log the winner without sending points. **Undo** reverses an award. Undo
  doesn't take back points already sent to Clash; it tells you so.
- **Winners**: every award, with Undo.
- **Data**: bills by squad, trait (every trait is listed, including ones at 0), who is giving,
  team, grade, and the students with the most bills. Use it for the guidelines' "Equitable" check.
- **Download CSV** (the whole Submissions tab), **Download winners CSV**, and **CSV of this view**
  (only what the filters show).

The password starts as `togetherweclimb`, the same as the old app. To change it, use
**Trait Dough › Change dashboard password…** in the Sheet. A sign-in lasts 8 hours. After 6
wrong tries, that person is locked out for 10 minutes.

## The Sheet

| Tab | What it's for |
|---|---|
| Submissions | One row per bill. You can edit it by hand. |
| Winners | One row per award. |
| Info | The "How it works" page. Each row has a Section and Content. Lines that start with `- ` become bullets. Column D has links to all three pages. |
| Settings | Key / Value / Notes for everything: teams, squads and colors, the 800# rule, the confirmation message, Clash link, and more. |
| Traits | The 9 LRG traits and their pillar (Present / Personable / Productive). Untick Active to hide one. |
| Staff | Names suggested in the "Who gave it to you?" box. Students can still type any name. |

## Set up (once)

1. Make a new Google Sheet named **Trait Dough**.
2. Go to **Extensions › Apps Script**. Create these files and paste in the contents of
   `apps-script/`:
   `Code.gs`, `Kiosk.html`, `Admin.html`, `Info.html`, `Styles.html`, `Logo.html`.
   (**+ › HTML** makes an HTML file. Leave off the `.html` when you name it.)
3. Under **Project Settings**, tick *Show "appsscript.json"*, then paste `apps-script/appsscript.json` over it.
4. Pick `setup` in the function menu and click **Run**. Approve the permissions it asks for.
5. Click **Deploy › New deployment › Web app**. Set *Execute as*: **Me** and *Who has access*:
   **Anyone within EASD**. Copy the `/exec` URL.
6. Back in the Sheet, reload and run **Trait Dough › Set up / repair tabs** again. This writes the page
   links on the Info tab. Then run **Check Clash of Classes connection**.
7. Point **bit.ly/traitdough** at the new `/exec` URL. Bookmark the turn-in page on the guidance
   computer, and bookmark `?view=admin` for staff.

If students will sign in to the turn-in computer with accounts outside the EASD domain, set *Who has
access* to **Anyone** instead. The turn-in page shows no student data either way.

After any code change, paste the changed files, then use **Deploy › Manage deployments › Edit ›
Version: New version**. This keeps the same URL.

## Tests

```bash
node tests/trait-dough.test.js
```

`node tests/build-preview.js` serves all three pages on http://localhost:3031 with sample data. They
run against the real `Code.gs` and a pretend Sheet.

## Old version

The old page (photo scan, Supabase, and +1 squad point per bill) is in git history before the
`sheets-migration` branch. `index.html` now only says the app has moved. If you want the old
"+1 point per bill" behavior, set `POINTS_PER_BILL` on Settings.
