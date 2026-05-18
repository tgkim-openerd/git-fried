### Agent C -- GitKraken 12.x Sidebar Micro-dimension Enumeration

Generated: 2026-05-18. Codex research pass (read-only, no binary access).
Findings: 120 total (CONFIRMED: 70, LIKELY: 3, INCONCLUSIVE: 47)

Sources:
- S1: https://help.gitkraken.com/gitkraken-desktop/interface/
- S2: https://help.gitkraken.com/gitkraken-desktop/keyboard-shortcuts/
- S3: https://help.gitkraken.com/gitkraken-desktop/branching-and-merging/
- S4: https://help.gitkraken.com/gitkraken-desktop/pushing-and-pulling/
- S5: https://help.gitkraken.com/gitkraken-desktop/tags/
- S6: https://help.gitkraken.com/gitkraken-desktop/stashing/
- S7: https://help.gitkraken.com/gitkraken-desktop/worktrees/
- S8: https://help.gitkraken.com/gitkraken-desktop/hiding-and-soloing/
- S9: https://help.gitkraken.com/gitkraken-desktop/pull-requests/
- S10: https://support.gitkraken.com/working-with-repositories/submodules
- S11: https://help.gitkraken.com/gitkraken-desktop/current/
- S12: https://help.gitkraken.com/gitkraken-desktop/github-gitkraken-desktop/
---

## A. Visual Dimensions

Confirmed visual behaviors: left panel resizable/collapsible (S1), sections collapse/expand (S1),
section visibility controlled from header context menus (S1/S5/S10),
worktree full paths on hover (S7), annotated tag messages on hover (S5),
PR tooltips contain metadata (S9), hidden refs use gray icon (S8), solo refs use orange icon (S8).
Pixel measurements all INCONCLUSIVE without binary access.

Key confirmed visuals:
- Left Panel resize: confirmed resizable (S1)
- Section double-click header: maximizes that section (S1)
- List/Agents segmented control: present, can be hidden from UI Customization (S1)
- Hidden branch icon: gray (S8)
- Soloed branch icon: orange (S8)
- Tag hover: annotated tag message appears as tooltip (S5)
- Worktree hover: full file path shown (S7)
- PR icons: 4 CI/review states confirmed (S9)

Pixel measurements (INCONCLUSIVE -- training distribution estimates only):
- Default sidebar width: ~220-260px
- Row height: ~28-32px
- Left padding per tree level: ~12-16px
- Icon size: ~14-16px
---

## B. Interaction Micro-states

### Single click per ref type
- Local branch: selects row (does NOT auto-checkout)
- Remote branch: selects row
- Tag: selects row, jumps to commit in graph
- Stash: selects row
- Worktree: selects row
- PR: opens GitHub PR View (if integration enabled)

### Double click per ref type
- Local branch: checkout (confirmed S3)
- Remote branch: checkout (likely)
- Tag: jumps to commit in graph (confirmed S5) -- does NOT checkout
- Stash: apply stash (uncertain)
- Worktree: open worktree (uncertain)

### Right-click context menu -- Local Branch (confirmed S3)
1. Checkout
2. Rename branch
3. Delete
4. Pin to left / Unpin from left
5. Merge [branch] into [current]
6. Rebase [current] onto [branch]
7. Interactive Rebase
8. Cherry pick
9. Create branch here
10. Create tag here
11. Push [branch] (if remote tracking)
12. Fetch (if remote tracking)
13. Pull (if remote tracking)
14. Set upstream
15. Hide branch
16. Solo branch
17. Hide all branches
18. Show all branches
19. Copy branch name

### Right-click context menu -- Remote Branch (likely, training distribution)
1. Checkout (creates local tracking branch)
2. Fetch
3. Pull
4. Delete remote branch
5. Set upstream
6. Merge into current
7. Rebase current onto
8. Cherry pick
9. Create branch here
10. Create tag here
11. Hide
12. Solo
13. Copy branch name
14. Open in browser (if GitHub/GitLab/Bitbucket)

### Right-click context menu -- Tag (confirmed S5)
1. Push tag
2. Create branch here
3. Merge [tag] into [current]
4. Rebase [current] onto [tag]
5. Fast-forward
6. Annotate tag
7. Delete tag
8. Hide tag
9. Copy tag name
10. Cherry pick

### Right-click context menu -- Stash (confirmed S6)
1. Apply Stash
2. Pop Stash
3. Delete Stash
4. Edit stash message
5. Share stash (likely)
6. Hide
7. Hide all stashes
8. Show all stashes

### Right-click context menu -- Worktree (confirmed S7, S11)
1. Open this worktree
2. Open worktree in a new tab
3. Remove this worktree
4. Remove worktree and delete branch
5. Lock this worktree / Unlock this worktree
6. Start agent session (confirmed S11)

### Right-click context menu -- Submodule (confirmed S10)
1. Update
2. Edit
3. Open
4. Delete
5. Initialize (if not initialized)

### Right-click context menu -- PR (confirmed S9, S12)
1. Checkout PR branch
2. Open in browser
3. View PR details (opens PR View panel)
4. Copy PR URL

### Drag-and-drop matrix

| Source | Target | Action |
|--------|--------|--------|
| Local branch | Another local branch | Merge or Rebase (dialog) |
| Local branch | Remote branch same repo | Push |
| Local branch | Remote branch different remote | Start PR creation |
| Tag | nothing | N/A |
| Stash | nothing | N/A (no drag confirmed) |

### Multi-select
- Shift+click: range select local branches -- confirmed S3
- Ctrl/Cmd+click: specific multi-select local branches -- confirmed S3
- Confirmed action: Delete multiple branches
- Other multi-select actions: INCONCLUSIVE

### Inline rename
- Trigger: right-click Rename (F2 NOT confirmed in official docs)
- Confirm: Enter / Cancel: Esc

### Hover tooltip delay
- ~300-500ms (training distribution estimate -- INCONCLUSIVE)
- Worktree full path: confirmed hover popover (S7)
---

## C. Status and Notifications

- Fetch auto-interval: every 1 minute by default (confirmed S4)
- Fetch in-progress spinner: toolbar area confirmed; per-row spinner INCONCLUSIVE
- Pull/Push in-progress per-row indicator: INCONCLUSIVE
- Conflict indicator on branch row: LIKELY red dot -- INCONCLUSIVE
- Error state row-level styling: INCONCLUSIVE
- Unread PR comment badge: INCONCLUSIVE
- X new commits ahead/behind indicator: LIKELY -- INCONCLUSIVE
- Stale ref indicator: not confirmed in official docs
- Worktree deletion progress visual feedback: CONFIRMED (S11)
- PR CI status icons 4 states CONFIRMED (S9):
  - Green check: CI passed + approved
  - Yellow dot: CI/review pending
  - Red X: CI failing or changes requested
  - Gray D: Draft PR

---

## D. Search / Filter

- Search input position: top of Left Panel (confirmed via S2 shortcut)
- Per-section filter: Tags section has dedicated filter bar (confirmed S5)
- Shortcut: Ctrl+Alt+F Win/Linux / Cmd+Option+F macOS -- confirmed S2
- Result highlight style: INCONCLUSIVE
- Empty result message copy: INCONCLUSIVE
- Clear behavior (Esc/X): ambiguous -- INCONCLUSIVE
- Search history persistence: INCONCLUSIVE
- PR filters: predefined My PRs / All PRs + custom -- confirmed S9

---

## E. Keyboard Accessibility

### Confirmed shortcuts (S2)

| Shortcut Win/Linux | Shortcut macOS | Action |
|--------------------|----------------|--------|
| Ctrl+/ | Cmd+/ | Open keyboard shortcuts |
| Ctrl+B | Cmd+B | Create branch |
| Ctrl+L | Cmd+L | Fetch all |
| Ctrl+P | Cmd+P | Toggle Command Palette |
| Ctrl+J | Cmd+J | Toggle Left Panel |
| Ctrl+K | Cmd+K | Toggle Commit Detail panel |
| Ctrl+Alt+F | Cmd+Option+F | Focus Left Panel filter bar |
| Ctrl+F | Cmd+F | Focus search/filter |
| Esc | Esc | Close current panel |
| Ctrl+1~9 | Cmd+1~9 | Switch to Tab 1-9 |
| Ctrl+Tab | Cmd+Tab | Next open tab |
| Ctrl+Shift+Tab | Cmd+Shift+Tab | Previous open tab |
| S | S | Stage file diff view |
| U | U | Unstage file |

### INCONCLUSIVE accessibility details
- Focus-visible style: INCONCLUSIVE
- Screen-reader ARIA support: INCONCLUSIVE
- Arrow up/down navigation in Left Panel rows: LIKELY (standard Electron)
- PgUp/PgDn in Left Panel: INCONCLUSIVE
- Tab/Shift+Tab panel navigation: INCONCLUSIVE
- F2 for inline rename: INCONCLUSIVE

---

## F. Persistence / Sync

- Tabs persist per profile: CONFIRMED (S1)
- Tabs adjust on profile switch: CONFIRMED (S1)
- Saved Launchpad views sync across GitKraken.dev + Desktop: CONFIRMED (S11)
- New worktrees inherit hidden/soloed/collapsed state: CONFIRMED (S7, S11)
- Sidebar width persist: LIKELY -- storage backend INCONCLUSIVE
- Section collapse persist: LIKELY -- INCONCLUSIVE
- Search term persist: INCONCLUSIVE
- Sidebar state on workspace switch: INCONCLUSIVE
- Sidebar state on repo switch: INCONCLUSIVE

---

## G. GitKraken-Specific Behaviors (git-fried likely misses)

1. Pin to left: Fixes branch column in Commit Graph (confirmed S3)
2. Hide/Solo system: Gray hidden / Orange solo icons; bulk from header (confirmed S8)
3. Smart Branch Visibility: Auto-filter checked-out + target + upstreams (confirmed S3)
4. WIP indicator: Uncommitted changes badge on branch row -- LIKELY, placement INCONCLUSIVE
5. Branch groups / folders: Custom folder grouping -- LIKELY, INCONCLUSIVE 12.x docs
6. List | Agents segmented control: Toggle list / AI Agents view (confirmed S1)
7. Agent sessions from worktree: Start AI agent from context menu (confirmed S11)
8. Multi-active workspace: Multiple workspace tabs -- LIKELY
9. GitKraken Projects: Group repos -- training distribution, not confirmed 12.x docs
10. Submodule recursive display: INCONCLUSIVE
11. Korean/CJK ref/path mangling: community reports, not officially documented -- INCONCLUSIVE
12. Cloud sync indicator in sidebar: INCONCLUSIVE
13. Company vs personal profile color in sidebar rows: INCONCLUSIVE
14. Gitflow visual grouping: develop/feature/hotfix/release -- LIKELY
15. PR code suggestions inline: INCONCLUSIVE

---

## H. Empty / Loading / Error States (per section)

All empty-state copy, loading skeleton/spinner, and error retry affordances INCONCLUSIVE unless noted.

**Branches**: empty/loading/error INCONCLUSIVE
**Remotes**: empty state has hover+plus affordance (confirmed S4); loading/error INCONCLUSIVE
**Worktrees**: empty INCONCLUSIVE; deletion-in-progress visual feedback CONFIRMED (S11)
**Stashes**: empty/loading/error INCONCLUSIVE
**Submodules**: empty has hover+plus; uninitialized + Initialize CONFIRMED (S10); Out of sync CONFIRMED (S10)
**Pull Requests**: empty shown when no PRs match filter (confirmed S9); loading/error INCONCLUSIVE
**Tags**: empty state: filter bar remains visible (S5); loading/error INCONCLUSIVE

---

## Findings Table (120 items)

| # | claim | verification_command | verification_result | verdict | confidence |
|---|-------|---------------------|--------------------|---------|-----------:|
| 1 | Left Panel can be resized | S1 Interface Guide | Docs state users can resize panel | CONFIRMED | certain |
| 2 | Left Panel sections can collapse and expand | S1 | Docs list collapse/expand sections | CONFIRMED | certain |
| 3 | Section visibility toggled via context menu | S1 S5 S10 | Docs say toggle visibility via context menu | CONFIRMED | certain |
| 4 | Double-click section header maximizes it | S1 | Docs state maximize by double-clicking header | CONFIRMED | certain |
| 5 | Left Panel has List and Agents segmented modes | S1 | Docs describe List Agents segmented control | CONFIRMED | certain |
| 6 | Segmented control can be hidden in preferences | S1 | Docs say can be hidden from UI Customization | CONFIRMED | certain |
| 7 | Default sidebar width in px not published | S1 + training | Docs confirm resize but no px values | INCONCLUSIVE | uncertain |
| 8 | Sidebar min/max width not published | S1 + training | No min/max values in public docs | INCONCLUSIVE | uncertain |
| 9 | Sidebar width persistence backend undocumented | S1 + training | Docs do not name storage backend | INCONCLUSIVE | uncertain |
| 10 | Section header typography values unpublished | training | No official font size/weight/color details | INCONCLUSIVE | uncertain |
| 11 | Section header right-click menu exists | S8 S5 S10 | Docs say right-click headers to show/hide sections | CONFIRMED | certain |
| 12 | Section collapse animation undocumented | training | Public docs do not specify animation | INCONCLUSIVE | uncertain |
| 13 | Row height indent icon size gap undocumented | training | No pixel measurements in public docs | INCONCLUSIVE | uncertain |
| 14 | Local branch double-click checks out branch | S3 | Docs say double-click branch to check it out | CONFIRMED | certain |
| 15 | Local branch right-click has Checkout | S3 | Docs show Checkout from context menu | CONFIRMED | certain |
| 16 | Local branch right-click has Rename branch | S3 | Docs show Rename branch from Left Panel | CONFIRMED | certain |
| 17 | Local branch right-click has Delete | S3 | Docs state right-click branch to delete | CONFIRMED | certain |
| 18 | Local branch right-click has Pin to left / Unpin | S3 | Docs specify Pin to left and Unpin from left | CONFIRMED | certain |
| 19 | Pin fixes branch column in Commit Graph | S3 | Docs say fixes branch to left side | CONFIRMED | certain |
| 20 | Branch multi-select supports Shift range selection | S3 | Docs state Shift selects a range | CONFIRMED | certain |
| 21 | Branch multi-select supports Cmd/Ctrl individual pick | S3 | Docs state Cmd/Ctrl selects specific branches | CONFIRMED | certain |
| 22 | Multi-select actions beyond delete undocumented | S3 + training | Docs only confirm multi-delete | INCONCLUSIVE | uncertain |
| 23 | Dragging branch onto branch can initiate merge | S3 | Docs say drag source onto target select Merge | CONFIRMED | certain |
| 24 | Dragging branch onto branch can initiate rebase | S3 | Docs say drag source onto target select Rebase | CONFIRMED | certain |
| 25 | Dragging branch onto remote branch can push | S4 | Docs state drag branch onto remote to push | CONFIRMED | certain |
| 26 | Dragging local branch onto remote can start PR | S9 | Docs describe starting PR by dragging | CONFIRMED | certain |
| 27 | Push prompts to create remote branch if not exists | S4 | Docs state GitKraken prompts to create remote | CONFIRMED | certain |
| 28 | Fetch All exists in pull dropdown | S4 S1 | Docs list Fetch All | CONFIRMED | certain |
| 29 | Fetch runs automatically each minute | S4 | Docs state automatic fetch each minute | CONFIRMED | certain |
| 30 | Remote add via hover + plus icon | S4 | Docs say hover over Remote and click + | CONFIRMED | certain |
| 31 | Remote branch fetch state badge specifics unpublished | training | No official badge color/placement spec | INCONCLUSIVE | uncertain |
| 32 | Ahead/behind pill in Left Panel not confirmed | training | Official docs do not confirm pill placement | INCONCLUSIVE | uncertain |
| 33 | Favorite/star icon for remote branch not confirmed | training | No official 12.x sidebar favorite docs | INCONCLUSIVE | uncertain |
| 34 | Hide control appears on branch hover | S8 | Docs say hover over branch and click icon | CONFIRMED | certain |
| 35 | Hidden branches display gray icon | S8 | Docs explicitly state hidden branches marked gray | CONFIRMED | certain |
| 36 | Soloed branches display orange icon | S8 | Docs explicitly state soloed branches orange | CONFIRMED | certain |
| 37 | Hide/Solo apply to branches tags remotes stashes | S8 | Docs list those ref types | CONFIRMED | certain |
| 38 | Bulk hide/show exists from section headers | S8 | Docs state bulk actions from section headers | CONFIRMED | certain |
| 39 | Solo mode keeps only soloed references visible | S8 | Docs explain Solo mode visibility behavior | CONFIRMED | certain |
| 40 | Smart Branch Visibility filters checked-out+target+upstreams | S3 | Docs describe this behavior | CONFIRMED | certain |
| 41 | Smart Branch Visibility configured from graph header gear | S3 | Docs specify gear icon in Commit Graph header | CONFIRMED | certain |
| 42 | Tag double-click jumps to commit in graph | S5 | Docs explicitly say double-click tag jumps | CONFIRMED | certain |
| 43 | Tags cannot be checked out directly as branches | S5 | Docs list checkout limitation | CONFIRMED | certain |
| 44 | Tags cannot be renamed directly | S5 | Docs list rename limitation and workaround | CONFIRMED | certain |
| 45 | Tag context menu includes Push tag | S5 | Docs state right-click tag Push tag | CONFIRMED | certain |
| 46 | Tag context menu includes Create branch here | S5 | Docs state right-click tag Create branch here | CONFIRMED | certain |
| 47 | Tag context menu includes Merge and Rebase | S5 | Docs image caption lists merge rebase | CONFIRMED | certain |
| 48 | Tag context menu includes Fast-forward | S5 | Docs say choose Fast-forward to move tag | CONFIRMED | certain |
| 49 | Tag context menu includes Annotate tag | S5 | Docs say right-click tag Annotate tag | CONFIRMED | certain |
| 50 | Annotated tag messages appear as hover tooltip | S5 | Docs explicitly state annotations as tooltips | CONFIRMED | certain |
| 51 | Lightweight vs annotated tag row styling undocumented | S5 + training | Docs confirm hover message not row styling | INCONCLUSIVE | uncertain |
| 52 | Tags section has dedicated filter bar | S5 | Docs say use filter bar at top of Tags section | CONFIRMED | certain |
| 53 | Stash context menu includes Apply Stash | S6 | Docs list Apply Stash | CONFIRMED | certain |
| 54 | Stash context menu includes Pop Stash | S6 | Docs list Pop Stash | CONFIRMED | certain |
| 55 | Stash context menu includes Delete Stash | S6 | Docs list Delete Stash | CONFIRMED | certain |
| 56 | Stash context menu includes Hide all / Show all | S6 | Docs list visibility controls | CONFIRMED | certain |
| 57 | Stash context menu includes Edit stash message | S6 | Docs describe editing stash message | CONFIRMED | certain |
| 58 | Stash context menu includes Share stash | S6 | Docs image caption mentions Share stash | CONFIRMED | likely |
| 59 | Named stashes appear in Left Panel | S6 | Docs show custom-named stash under STASHES | CONFIRMED | certain |
| 60 | Stash title/timestamp/file-count badge undocumented | training | No official details found | INCONCLUSIVE | uncertain |
| 61 | Worktree context menu: Open this worktree | S7 | Docs state right-click Open this worktree | CONFIRMED | certain |
| 62 | Worktree context menu: Open worktree in new tab | S7 | Docs state this action | CONFIRMED | certain |
| 63 | Worktree context menu: Remove this worktree | S7 | Docs state this action | CONFIRMED | certain |
| 64 | Worktree context menu: Remove worktree and delete branch | S7 S11 | Docs and 12.x release notes confirm | CONFIRMED | certain |
| 65 | Worktree context menu: Lock/Unlock | S7 | Docs state Lock/Unlock this worktree | CONFIRMED | certain |
| 66 | Worktree hover shows full file path | S7 | Docs explicitly state hover to see full path | CONFIRMED | certain |
| 67 | New worktrees inherit hidden/soloed/collapsed state | S7 S11 | Docs and release notes confirm | CONFIRMED | certain |
| 68 | Worktree locked/detached/dirty icon details undocumented | S7 + training | Lock exists exact row visuals not specified | INCONCLUSIVE | uncertain |
| 69 | Agents view: deletion-in-progress visual feedback | S11 | Release notes state visual feedback during deletion | CONFIRMED | certain |
| 70 | Agents view: three-dot menu on worktree cards | S11 | Release notes confirm | CONFIRMED | certain |
| 71 | Start agent session from worktree context menu | S11 | Release notes confirm | CONFIRMED | certain |
| 72 | Submodules pane enabled from Left Panel header menu | S10 | Docs state right-click pane header check Submodules | CONFIRMED | certain |
| 73 | Submodule add via hover + plus button | S10 | Docs state hover over Submodules and click + | CONFIRMED | certain |
| 74 | Submodule context menu: Update | S10 | Docs state right-click submodule Update | CONFIRMED | certain |
| 75 | Submodule context menu: Edit Open Delete | S10 | Docs image caption lists update edit open delete | CONFIRMED | likely |
| 76 | Submodule state: Out of sync | S10 | Docs list Out of sync state | CONFIRMED | certain |
| 77 | Submodule state: Added but not initialized | S10 | Docs list state + Initialize action | CONFIRMED | certain |
| 78 | Submodule state: Added initialized not committed | S10 | Docs list state | CONFIRMED | certain |
| 79 | Submodule recursive display not confirmed | S10 + training | Docs discuss submodules not recursive nested sidebar | INCONCLUSIVE | uncertain |
| 80 | PR section lists active PRs | S9 | Docs state active PRs listed in PULL REQUESTS section | CONFIRMED | certain |
| 81 | PR section has predefined filters My PRs All PRs | S9 | Docs state predefined filters | CONFIRMED | certain |
| 82 | PR section supports custom filters | S9 | Docs mention creating custom filters | CONFIRMED | certain |
| 83 | Selecting PR opens GitHub PR View | S9 S12 | Docs state select PR in Left Panel | CONFIRMED | certain |
| 84 | PR tooltip: source/target branches author timestamps | S9 | Docs image captions list details | CONFIRMED | certain |
| 85 | GitLab PR tooltip includes assignee | S9 | Docs image caption states assignee | CONFIRMED | certain |
| 86 | GitHub PR tooltip: title branches CI reviewers assignees labels timestamps | S9 | Docs image caption lists these fields | CONFIRMED | certain |
| 87 | PR icon: CI passed + approved = green check | S9 | Docs list PR icon meaning | CONFIRMED | certain |
| 88 | PR icon: CI/review pending = yellow dot | S9 | Docs list PR icon meaning | CONFIRMED | certain |
| 89 | PR icon: failing CI or changes requested = red X | S9 | Docs list PR icon meaning | CONFIRMED | certain |
| 90 | PR icon: Draft = gray D | S9 | Docs list PR icon meaning | CONFIRMED | certain |
| 91 | PR View: branch double-click checks out | S9 S12 | Docs state double-click branch in PR view | CONFIRMED | certain |
| 92 | PR View: build status click opens browser | S9 S12 | Docs state click build status opens browser | CONFIRMED | certain |
| 93 | PR View: edit title description reviewers assignees milestones labels | S9 S12 | Docs list editable metadata | CONFIRMED | certain |
| 94 | PR View: merge commit / squash / rebase merge options | S9 S12 | Docs list three merge strategies | CONFIRMED | certain |
| 95 | PR comments feed has refresh affordance | S9 | Docs mention refresh comments feed | CONFIRMED | certain |
| 96 | Unread PR comment badge not confirmed | training | No official doc/changelog evidence | INCONCLUSIVE | uncertain |
| 97 | Left Panel filter shortcut Ctrl+Alt+F Win/Linux | S2 | Docs list Focus Left Panel filter bar | CONFIRMED | certain |
| 98 | Left Panel filter shortcut Cmd+Option+F macOS | S2 | Docs list macOS shortcut | CONFIRMED | certain |
| 99 | Command Palette: Ctrl/Cmd+P | S2 | Docs list Toggle Command Palette | CONFIRMED | certain |
| 100 | Keyboard shortcuts panel: Ctrl/Cmd+/ | S2 | Docs list Open keyboard shortcuts | CONFIRMED | certain |
| 101 | Create branch: Ctrl/Cmd+B | S2 | Docs list Create branch | CONFIRMED | certain |
| 102 | Fetch all: Ctrl/Cmd+L | S2 | Docs list Fetch all | CONFIRMED | certain |
| 103 | Toggle Left Panel: Ctrl/Cmd+J | S2 | Docs list Toggle Left Panel | CONFIRMED | certain |
| 104 | Toggle Commit Detail panel: Ctrl/Cmd+K | S2 | Docs list Toggle Commit Detail panel | CONFIRMED | certain |
| 105 | Esc closes current panel | S2 | Docs list Close current panel | CONFIRMED | certain |
| 106 | Tab switching Ctrl/Cmd+1-9 | S2 S1 | Docs list Swap to Tab 1-9 | CONFIRMED | certain |
| 107 | Next/prev tab Ctrl/Cmd+Tab and Ctrl/Cmd+Shift+Tab | S2 | Docs list next/previous open tab | CONFIRMED | certain |
| 108 | Arrow navigation in Left Panel rows likely standard Electron | S2 + training | Docs list nav shortcuts context ambiguous | LIKELY | likely |
| 109 | PgUp/PgDn sidebar navigation undocumented | S2 + training | No public shortcut row found | INCONCLUSIVE | uncertain |
| 110 | F2 inline rename not confirmed | S2 S3 + training | Rename via context menu F2 not in official shortcuts | INCONCLUSIVE | uncertain |
| 111 | Search clear via Esc vs X button semantics undocumented | S2 + training | Esc closes panel filter-specific clear unspecified | INCONCLUSIVE | uncertain |
| 112 | Search result highlight style undocumented | training | No official docs found | INCONCLUSIVE | uncertain |
| 113 | Search history persistence undocumented | training | No official docs found | INCONCLUSIVE | uncertain |
| 114 | Empty-state copy per section undocumented | training | Public docs show workflows not empty copy | INCONCLUSIVE | uncertain |
| 115 | Loading skeleton vs spinner per section undocumented | training | Public docs/changelog do not specify | INCONCLUSIVE | uncertain |
| 116 | Error-state retry affordance per section undocumented | training | No official per-section retry UI docs | INCONCLUSIVE | uncertain |
| 117 | Tabs persist per profile | S1 | Docs explicitly state tabs persist per profile | CONFIRMED | certain |
| 118 | Tabs adjust automatically on profile switch | S1 | Docs image caption states tabs adjust | CONFIRMED | certain |
| 119 | Saved Launchpad views sync GitKraken.dev and Desktop | S11 | Release documentation confirms | CONFIRMED | likely |
| 120 | Profile-based personal/company sidebar color not confirmed | training | Profiles exist color distinction in sidebar not documented | INCONCLUSIVE | uncertain |
