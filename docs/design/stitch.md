# Stitch mocks

Mocks of the MVP screens in light and dark, made with Stitch from
[`DESIGN.md`](DESIGN.md). They are a **reference, not the spec**: where a mock
and `DESIGN.md` disagree, `DESIGN.md` wins, and the list of known deviations
is at the end of this file. All data is synthetic: invented places (Aldria
`ALD`, Kessbury `KSB`, Pellavo `PVM`, Travenna `TRV`), an invented lodging
("Harbour Inn"), the booking reference `ABC123` and `example.com` addresses.
People are "you" and `{partner}`.

## Project

| What               | Value                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------- |
| Project            | "monki-trips mobile", `projects/16870313769948987802` (private)                              |
| Design system      | `assets/645f0c2eccff4a8b98eca1e51550d001` ("monki-trips", MOBILE, from `DESIGN.md`)          |
| `DESIGN.md` upload | screen instance `15970238228611904689`                                                       |
| Frame              | 390 wide, iOS safe areas; PNGs are the Stitch screenshots at 2× (780 wide, full page height) |

How it was made:

1. `create_project`, then `upload_design_md` with the base64 of `DESIGN.md`.
   The upload copy had the Markdown table padding collapsed (same content,
   33 KB instead of 44 KB); Stitch accepted every colour key, so nothing was
   stripped. The repository file is unchanged.
2. `create_design_system_from_design_md` (MOBILE) and `list_design_systems`
   for the asset id.
3. One `generate_screen_from_text` per screen (prompts below), with the
   design system set.
4. For Today and Quick expense, `generate_variants` (3, REFINE, LAYOUT); the
   variant closest to `DESIGN.md` was kept.
5. Every chosen screen was checked by eye and by a text scan of its HTML;
   each violation got one `edit_screens` fix, then was recorded below.
6. `edit_screens` with the dark-theme prompt for every chosen screen, then
   `get_screen` and `download_file` for the HTML and PNG of both themes.

The Kiko mascot cannot be drawn by Stitch: every screen that shows him has a
plain outlined square labelled "Kiko" at the slot's size (48 px on Today and
Ready to fly, 96 px on Sign in and the empty trip list).

## Screens

Files are `docs/design/mocks/<screen>-{light,dark}.{html,png}`. "Generated" is the first screen Stitch returned; "light" and "dark" are the screens the files were downloaded from. `edit_screens` returns a new screen id instead of changing the screen in place.

| Screen                 | Files               | Generated                          | Light                              | Dark                               | How the light one was chosen                           |
| ---------------------- | ------------------- | ---------------------------------- | ---------------------------------- | ---------------------------------- | ------------------------------------------------------ |
| Today                  | `today-*`           | `3bb0bf0083aa44c2a1c76c2bec25e466` | `63c8f016acc9468d897f6a9699224062` | `2a49ab7bfc4c4b37a0ecff57c636892e` | variant "Refined Compact" of 3 (REFINE, LAYOUT)        |
| Quick expense sheet    | `quick-expense-*`   | `4457e19f3db348c3b1db29cbb2be2e0a` | `b8c72d8ea20449dface2d5bf5a362993` | `a86cf8bd1d294fc5985f50f619c28b01` | variant "Refined Native Grid" of 3, then two fix edits |
| Trip list              | `trip-list-*`       | `4d2d314b0cbb4c05b0d3016e14291f13` | `acf702f942f5429d92cc3b0e833b90fb` | `20a3346f58b04be99fe1552aabe17219` | one fix edit                                           |
| Trip list, empty state | `trip-list-empty-*` | `2203ac144db4420891d524379a7692d0` | `b246fde5e8844bac850d40b55325703b` | `063bb48fc7c04708a1289871bf1e1c6e` | one fix edit                                           |
| Itinerary day          | `itinerary-day-*`   | `dc703036727f4e1599e7f6fe19334191` | `5b22a8bcb5684673b67ab375d075f2e3` | `1f9f8a42d00e414883cc6999f651ca70` | one fix edit                                           |
| Event detail sheet     | `event-detail-*`    | `d8d1705f50994fb1bc38a9ae115c90e3` | `416171a58ebd400a8df63e3fd35cfe58` | `d20a0934ece34f5784c67a5b3d65dc6d` | one fix edit                                           |
| Where we sleep         | `where-we-sleep-*`  | `1d6c23445e45405299f9ad4bc051cd3f` | `da85c0ce80f7407ea4e5107690915257` | `8e17d3ef86334eeba40d9504498f7101` | one fix edit                                           |
| Documents              | `documents-*`       | `b0c77963c6284604982b23ea1d855a1a` | `b0c77963c6284604982b23ea1d855a1a` | `d02cab5a71ec4f6698fe5de517a38bf1` | as generated                                           |
| Budget                 | `budget-*`          | `65235f157c484e61ad2aef38f3500b7e` | `79391d9259ce4019ab429e0abf101164` | `da1c83a47af24ad99e7eaf8a857d4188` | two fix edits                                          |
| Tasks by urgency       | `tasks-*`           | `932add9bbbd94ad8ae27df9769bdda6d` | `f886834f12e34eeb9e39fc1346716aab` | `fa121ad9a82745d4b244731a37de72bc` | one fix edit                                           |
| Ready to fly           | `ready-to-fly-*`    | `b642138f3e354e9a9284e9bdb32a91a7` | `b642138f3e354e9a9284e9bdb32a91a7` | `55c4156f2e414ab089e0c52fec17e30c` | as generated                                           |
| Sign in                | `sign-in-*`         | `c4c3f70090ae4160b79c925e4098211a` | `c4c3f70090ae4160b79c925e4098211a` | `7992221814d8407286da7213e647798a` | dark needed one fix edit                               |
| Settings               | `settings-*`        | `b369ab6ecb664b95a451918b9f8ce128` | `167809cad1e64b3bac74ebc979349613` | `4b80bf4eb6164626b756d997113ccbac` | one fix edit                                           |

Variants not chosen: Today `67621ed5f89349cdbf57062b2d2fc4e6` ("Hairline Balanced", scrolls past one screen) and `5cfc6295732249c2bdb1d49a44f74e60` ("Single Screen Fit", type sizes below the scale); quick expense `939ba30055384b338ba4b755ae02b191` ("Hairline Partitioned", outlined keys) and `4c1a93ddc40e4b82bbd8003a3910d8cc` ("Ergonomic Touch Flow", boxed paid-by row, an extra category).

## Prompts

Each screen was generated with `generate_screen_from_text` (design system `assets/645f0c2eccff4a8b98eca1e51550d001`, device `MOBILE`) and this one-paragraph prompt.

### Today

```text
Today, the sacred screen of an offline-first travel app for people travelling together: it tells you what happens next and when to leave, calm under pressure. Top to bottom: (1) header title "Day 4 of 12 · Aldria" (24px semibold), under it one connection line with a wifi-off icon "Offline · everything saved" in grey ink, and at the right a small mascot placeholder, a plain 48 px square slot (no drawing, just an empty outlined square labelled "Kiko"); (2) eyebrow "NEXT" (mono uppercase, small, grey) then the ticket card, the only card on the screen: #FBFBF9 paper, 1px #80868E edge, 8px radius, no shadow; top part has title "Train to Kessbury", departure time "14:20 EEST" in IBM Plex Mono 24px, countdown "in 1 h 32 min" in grey with tabular figures, and a clock icon with "Leave at 13:40"; then a perforation: two 8 px half-circle notches cut into the left and right edges with a dashed hairline between them; the stub shows the route "ALD → KSB" in mono 24px (arrow in light grey), booking reference "ABC123" in small mono grey, and a secondary "Directions" button (outlined, navigation icon); (3) eyebrow "TODAY'S DOCUMENTS": a full-width edge-to-edge pale yellow #F4E2AE banner with a printer icon, bold "Bring this printed", second line "Rail pass · ALD → KSB", and an underlined dark link "I printed it"; below it two hairline-separated rows: "Rail pass" with a green circle-check icon and the word "Saved offline", and "Museum tickets" with an amber triangle-alert icon and the word "Not saved offline"; (4) eyebrow "TONIGHT": "Harbour Inn" (18px semibold), large copyable address "14 Quay Street, Kessbury" with a copy icon, the address in local script "Οδός Λιμανιού 14" in grey, "Check-in from 15:00", phone "+99 555 0142", and a "Directions" link; (5) a row with eyebrow "LEFT TODAY": hero number "€84" (40px semibold, tabular), below it "A$138 · 1 pending" in grey; to its right, separated by a vertical hairline, weather "18° Cloudy" with "updated 3 h ago"; (6) a floating 56 px square orange #B5470C add-expense button with a plus icon, 12px radius, 16 px above the tab bar at the right. Sections are separated by 1px #D7D8D3 hairlines and whitespace, never boxed. Style: page #F5F5F2, ink #111417 / #4A5058 / #626971; exactly one accent, runway orange #B5470C, used only for interaction (the FAB, links, the active tab); IBM Plex Sans for text and IBM Plex Mono with tabular figures for codes, times and countdowns; radii 4 / 8 / 12 only, no pills; Lucide icons at 1.75 stroke, one icon set; status always icon plus a word in ink; no gradients, no glass, no blur, no heavy shadows, no cards inside cards, no emoji. 390×844, iOS safe areas, bottom tab bar Today · Plan · Docs · Money · More (Today active in orange, others grey, 1px hairline on top), light theme.
```

### Quick expense sheet

```text
Quick expense bottom sheet of an offline-first travel app: add an expense in three taps (open, optional category, Save). The Today screen is dimmed behind a flat translucent dark scrim (no blur). The sheet rises from the bottom on #FBFBF9 with 16px top corners only, a 36×4 grey handle, title "Add expense" (18px semibold) and a 44 px close (x) button at the right. Top to bottom inside the sheet: the amount as the one hero number "€18.50" (40px semibold, tabular figures, ink) with a blinking caret, under it "≈ A$30.40" in grey; a row of currency chips "EUR" (selected: pale orange #F9EBE1 fill, orange #B5470C border and label) and "AUD" (outlined grey); a row of category chips with small Lucide icons: "Food" (selected, same orange-wash style), "Transport", "Lodging", "Tickets", "Other" (outlined, 4px radius, 32 px tall); a small line "Paid by you · split 50/50 with {partner}" with an edit link in orange; a 3×4 numeric keypad with large tabular digits 1–9, ".", 0 and a backspace icon, keys as flat #ECECE8 tiles with 8px radius, no shadows; and at the bottom, 16 px above the safe area, one full-width 48 px primary button "Save expense" in orange #B5470C with an off-white label, 8px radius. State: typing, the keypad has focus. Style: ink #111417 / #4A5058 / #626971, hairlines 1px #D7D8D3; exactly one accent, runway orange, used only for interaction (Save, selected chips, the edit link); IBM Plex Sans with tabular figures for every number; radii 4 / 8 / 12 / 16 only, no pills; Lucide icons at 1.75 stroke; no gradients, no glass, no blur, no emoji. 390×844, iOS safe areas, bottom tab bar Today · Plan · Docs · Money · More visible under the scrim, light theme.
```

### Trip list

```text
Trip list of an offline-first travel app for people travelling together, the first screen after sign-in. Top to bottom: title "Trips" (24px semibold) with a quiet "New trip" link in orange at the right; eyebrow "UPCOMING" (mono uppercase, small, grey); one trip row (56 px+, hairline below, no card): "Coast and islands" in 16px medium, under it the route chips "PVM → ALD → KSB" in IBM Plex Mono 13px on a transparent fill with 4px radius and a grey 1px outline, then "Wed 12 May – Sun 23 May · 12 days · 2 travellers" in small grey text, chevron at the right, and a status line with a grey dot "Starts in 18 days"; eyebrow "PAST"; one past trip row "Mountain weekend" with chips "KSB → TRV", "Fri 6 Mar – Mon 9 Mar · 4 days", chevron; below it, as the reward, a small row of two passport stamps (112 px circles with a 2px outer ring and 1px inner ring in deep blue #2F5C8A, place name in mono caps "TRAVENNA", code "TRV", date "06 MAR", each rotated a few degrees) and one dashed grey ring stamp "Not yet". Rows are separated by 1px #D7D8D3 hairlines, never boxed. Style: page #F5F5F2, ink #111417 / #4A5058 / #626971; exactly one accent, runway orange #B5470C, only for interaction (the New trip link, the active tab); IBM Plex Sans for text, IBM Plex Mono with tabular figures for codes and dates; radii 4 / 8 / 12 only, no pills; Lucide icons at 1.75 stroke; no gradients, no glass, no blur, no shadows, no cards inside cards, no emoji. 390×844, iOS safe areas, no trip tab bar on this screen (it is above the trip shell), light theme.
```

### Trip list, empty state

```text
Trip list empty state of an offline-first travel app, shown after the first sign-in when there are no trips yet. No tab bar. Top to bottom: title "Trips" (24px semibold); then, centred in the remaining space: a mascot placeholder, a plain 96 px outlined square slot labelled "Kiko" (no drawing); title "No trips yet" (18px semibold); one sentence in grey "Create a trip to plan the days, keep your documents offline and share the budget."; one orange primary button "Create your first trip" (48 px, 8px radius, off-white label); below, a single dashed grey ring passport stamp placeholder with "Not yet" in mono (112 px, slightly rotated). Nothing else: no fake data, no spinner, no second action. Style: page #F5F5F2, raised #FBFBF9, sunken #ECECE8; ink #111417 / #4A5058 / #626971; 1px #D7D8D3 hairlines, 1px #80868E for edges that must be seen; exactly one accent, runway orange #B5470C, used only for interaction (primary button, FAB, links, active tab, selected chip or segment); IBM Plex Sans for text and IBM Plex Mono with tabular figures for codes, times, dates and amounts; radii 4 / 8 / 12 (sheets 16) only, no pills; Lucide icons at 1.75 stroke, one icon set; status always an icon in the status colour plus a word in ink; no gradients, no glass, no blur, no heavy shadows, no cards inside cards, no emoji, no invented brand bar or logo above the title. 390×844, iOS safe areas, no tab bar, light theme.
```

### Itinerary day

```text
Itinerary day screen (Plan tab, Days segment) of an offline-first travel app for people travelling together. Top to bottom: a segmented control "Days | Where we sleep" (grey #ECECE8 track, 8px radius; "Days" selected with a #FBFBF9 thumb, 1px #80868E ring and orange label); a horizontal strip of day chips "Tue 11", "Wed 12" (selected), "Thu 13"; date heading "Wed 12 May" (24px semibold) with "Day 4 of 12" in grey beside it; the day's route chips "ALD → KSB" in IBM Plex Mono 13px on a transparent fill with a grey 1px outline and 4px radius (never orange); then event rows separated by hairlines, each with a 64 px mono time column (local time "08:30" over the zone "EEST" in grey), title, meta and an optional "Directions" link with a navigation icon: "08:30 Breakfast at the harbour market", "10:00 Check-out · Harbour Inn Aldria · Night 2 of 2" with a bed-double icon, "14:20 Train to Kessbury · Coach 5 · ABC123" with a Directions link, "18:00 Check-in · Harbour Inn Kessbury · Night 1 of 2" with a bed-double icon and a Directions link; a floating 56 px orange add-expense button with a plus icon (12px radius) 16 px above the tab bar at the right. Rows never boxed. Style: page #F5F5F2, raised #FBFBF9, sunken #ECECE8; ink #111417 / #4A5058 / #626971; 1px #D7D8D3 hairlines, 1px #80868E for edges that must be seen; exactly one accent, runway orange #B5470C, used only for interaction (primary button, FAB, links, active tab, selected chip or segment); IBM Plex Sans for text and IBM Plex Mono with tabular figures for codes, times, dates and amounts; radii 4 / 8 / 12 (sheets 16) only, no pills; Lucide icons at 1.75 stroke, one icon set; status always an icon in the status colour plus a word in ink; no gradients, no glass, no blur, no heavy shadows, no cards inside cards, no emoji, no invented brand bar or logo above the title. 390×844, iOS safe areas, bottom tab bar Today · Plan · Docs · Money · More (Plan active in orange, others grey, 1px hairline on top), light theme.
```

### Event detail sheet

```text
Event detail bottom sheet of an offline-first travel app, opened from an itinerary row. The itinerary day is dimmed behind a flat translucent dark scrim (no blur). The sheet is #FBFBF9 with 16px top corners only, a 36×4 grey handle, title "Train to Kessbury" (18px semibold) and a 44 px close (x) button. Inside, top to bottom: eyebrow "WED 12 MAY · DAY 4 OF 12" (mono, small, grey uppercase); the route "ALD → KSB" in IBM Plex Mono 24px (arrow grey); two columns "Departs 14:20 EEST" and "Arrives 17:05 EEST" in mono with tabular figures; "Leave at 13:40" with a clock icon and the line "40 min before departure, 18 min walk" in grey; hairline; label/value rows: "Booking reference" ABC123 in mono with a copy icon, "Coach and seat" 5 · 42A in mono, "From" Aldria Central, Platform 3, "Notes" Bring the printed rail pass; hairline; a row "Rail pass" with a green circle-check icon and the word "Saved offline"; at the bottom, 16 px above the safe area, one full-width 48 px orange primary button "Directions" with a navigation icon and an off-white label, 8px radius, and a quiet orange "Edit event" link above it. Style: page #F5F5F2, raised #FBFBF9, sunken #ECECE8; ink #111417 / #4A5058 / #626971; 1px #D7D8D3 hairlines, 1px #80868E for edges that must be seen; exactly one accent, runway orange #B5470C, used only for interaction (primary button, FAB, links, active tab, selected chip or segment); IBM Plex Sans for text and IBM Plex Mono with tabular figures for codes, times, dates and amounts; radii 4 / 8 / 12 (sheets 16) only, no pills; Lucide icons at 1.75 stroke, one icon set; status always an icon in the status colour plus a word in ink; no gradients, no glass, no blur, no heavy shadows, no cards inside cards, no emoji, no invented brand bar or logo above the title. 390×844, iOS safe areas, bottom tab bar Today · Plan · Docs · Money · More (Plan active in orange, others grey, 1px hairline on top), light theme.
```

### Where we sleep

```text
Where we sleep screen (Plan tab, second segment) of an offline-first travel app for people travelling together. Top to bottom: segmented control "Days | Where we sleep" with "Where we sleep" selected (#FBFBF9 thumb, 1px #80868E ring, orange label; grey #ECECE8 track, 8px radius); a summary line "11 of 12 nights covered" with a small 4 px progress track in grey filled in near-black ink (never orange); one alert row for an uncovered night: an octagon-alert icon in rust #7E3418, the words "No lodging for Fri 14 May" in ink and "Night 6 of 12 · Kessbury" in grey, with a quiet orange "Add stay" link; then stay rows separated by hairlines, each with a bed-double icon, lodging name, "Mon 10 – Wed 12 May · 2 nights" in mono tabular figures, the city in grey and a chevron: "Harbour Inn Aldria", "Harbour Inn Kessbury" (Wed 12 – Fri 14 May), then a gap row "Fri 14 May · not covered" in grey italic-free text, then "Old Mill Rooms, Travenna" (Sat 15 – Sun 23 May · 8 nights); a floating 56 px orange add-expense button (12px radius) above the tab bar at the right. Rows never boxed. Style: page #F5F5F2, raised #FBFBF9, sunken #ECECE8; ink #111417 / #4A5058 / #626971; 1px #D7D8D3 hairlines, 1px #80868E for edges that must be seen; exactly one accent, runway orange #B5470C, used only for interaction (primary button, FAB, links, active tab, selected chip or segment); IBM Plex Sans for text and IBM Plex Mono with tabular figures for codes, times, dates and amounts; radii 4 / 8 / 12 (sheets 16) only, no pills; Lucide icons at 1.75 stroke, one icon set; status always an icon in the status colour plus a word in ink; no gradients, no glass, no blur, no heavy shadows, no cards inside cards, no emoji, no invented brand bar or logo above the title. 390×844, iOS safe areas, bottom tab bar Today · Plan · Docs · Money · More (Plan active in orange, others grey, 1px hairline on top), light theme.
```

### Documents

```text
Documents screen (Docs tab) of an offline-first travel app for people travelling together. Top to bottom: title "Documents" (24px semibold) with a quiet orange "Upload" link at the right; a row of filter chips "All" (selected: pale orange #F9EBE1 fill, orange border and label), "Transport", "Lodging", "Tickets", "Insurance" (outlined grey, 4px radius, 32 px tall); a full-width edge-to-edge pale yellow #F4E2AE banner with a printer icon, bold "Bring this printed", second line "Rail pass · ALD → KSB · Wed 12 May" and an underlined dark link "I printed it"; then eyebrow "THIS TRIP" and document rows separated by hairlines, each with a file-text or image icon, name, meta ("PDF · 240 KB · Transport") and an offline state at the right as icon plus word: "Rail pass" green circle-check "Saved offline", "Harbour Inn booking" green circle-check "Saved offline", "Museum tickets" amber triangle-alert "Not saved offline" with a quiet orange "Save offline" link, "Travel insurance" refresh icon "Saving 60%", "Ferry tickets" grey cloud icon "Online only"; a footer caption "4.2 MB of 120 MB used on this device". A floating 56 px orange add-expense button (12px radius) above the tab bar at the right. Rows never boxed. Style: page #F5F5F2, raised #FBFBF9, sunken #ECECE8; ink #111417 / #4A5058 / #626971; 1px #D7D8D3 hairlines, 1px #80868E for edges that must be seen; exactly one accent, runway orange #B5470C, used only for interaction (primary button, FAB, links, active tab, selected chip or segment); IBM Plex Sans for text and IBM Plex Mono with tabular figures for codes, times, dates and amounts; radii 4 / 8 / 12 (sheets 16) only, no pills; Lucide icons at 1.75 stroke, one icon set; status always an icon in the status colour plus a word in ink; no gradients, no glass, no blur, no heavy shadows, no cards inside cards, no emoji, no invented brand bar or logo above the title. 390×844, iOS safe areas, bottom tab bar Today · Plan · Docs · Money · More (Docs active in orange, others grey, 1px hairline on top), light theme.
```

### Budget

```text
Budget screen (Money tab) of an offline-first travel app for two people travelling together. Top to bottom: title "Money" (24px semibold); a row of three stat tiles separated by vertical hairlines, no boxes: eyebrow "LEFT" value "€1,240" sub-line "A$2,040 of €3,000", eyebrow "PER DAY" value "€155" sub-line "8 days left", eyebrow "TODAY" value "€84" sub-line "1 pending" (values in ink, tabular figures, never coloured); a segmented control "Chart | Table" (grey #ECECE8 track, "Chart" selected with a #FBFBF9 thumb, 1px #80868E ring and orange label); eyebrow "SPENT BY CATEGORY"; horizontal bar chart, single series in neutral grey #5D646B (never orange, never a rainbow): bars 12 px thick with 4px rounded data ends and square at the baseline, each row with the category name at the left and the amount at the right in tabular figures: Lodging €820, Transport €410, Food €360, Tickets €120, Other €50; one solid 1px baseline, no gridlines dashed, no legend; a caption "Tap Table for the exact values"; eyebrow "RECENT" and three expense rows separated by hairlines: "Lunch at the harbour" Food · you paid · €18.50 with a small grey dot and the word "pending", "Train ALD → KSB" Transport · {partner} paid · €46.00, "Museum" Tickets · you paid · €24.00; a floating 56 px orange add-expense button (12px radius) above the tab bar at the right. No donut, no pie, no red for spending. Style: page #F5F5F2, raised #FBFBF9, sunken #ECECE8; ink #111417 / #4A5058 / #626971; 1px #D7D8D3 hairlines, 1px #80868E for edges that must be seen; exactly one accent, runway orange #B5470C, used only for interaction (primary button, FAB, links, active tab, selected chip or segment); IBM Plex Sans for text and IBM Plex Mono with tabular figures for codes, times, dates and amounts; radii 4 / 8 / 12 (sheets 16) only, no pills; Lucide icons at 1.75 stroke, one icon set; status always an icon in the status colour plus a word in ink; no gradients, no glass, no blur, no heavy shadows, no cards inside cards, no emoji, no invented brand bar or logo above the title. 390×844, iOS safe areas, bottom tab bar Today · Plan · Docs · Money · More (Money active in orange, others grey, 1px hairline on top), light theme.
```

### Tasks by urgency

```text
Tasks screen (More tab, Tasks) of an offline-first travel app for people travelling together, grouped by urgency. Top to bottom: back chevron and title "Tasks" (24px semibold) with a quiet orange "Add task" link; a summary line "5 open · 2 due this week"; eyebrow "OVERDUE" with one row: an empty 20 px square checkbox (1px #80868E border, 4px radius), title "Buy travel insurance", meta "Due Mon 3 May · you" and at the right a circle-x icon in red #A01C1C with the word "Overdue" in ink; eyebrow "THIS WEEK" with rows "Print rail pass" (due Tue 11 May · {partner}), "Confirm late check-in" (due Wed 12 May · you); eyebrow "LATER" with rows "Book ferry to Travenna" (due Fri 14 May), "Exchange €200" (no date); eyebrow "DONE" with one row "Renew passport" checked (checkbox filled orange with an off-white tick, title struck through in grey). Rows separated by hairlines, 56 px, never boxed. A floating 56 px orange add-expense button (12px radius) above the tab bar at the right. Style: page #F5F5F2, raised #FBFBF9, sunken #ECECE8; ink #111417 / #4A5058 / #626971; 1px #D7D8D3 hairlines, 1px #80868E for edges that must be seen; exactly one accent, runway orange #B5470C, used only for interaction (primary button, FAB, links, active tab, selected chip or segment); IBM Plex Sans for text and IBM Plex Mono with tabular figures for codes, times, dates and amounts; radii 4 / 8 / 12 (sheets 16) only, no pills; Lucide icons at 1.75 stroke, one icon set; status always an icon in the status colour plus a word in ink; no gradients, no glass, no blur, no heavy shadows, no cards inside cards, no emoji, no invented brand bar or logo above the title. 390×844, iOS safe areas, bottom tab bar Today · Plan · Docs · Money · More (More active in orange, others grey, 1px hairline on top), light theme.
```

### Ready to fly

```text
Ready to fly checklist screen (More tab, Offline) of an offline-first travel app: it proves the app will work with no connection. Top to bottom: back chevron and title "Ready to fly" (24px semibold); a summary "5 of 7 ready" with a stepped progress bar of 7 equal segments with 2 px gaps, 5 filled in near-black ink and 2 in grey (never orange, never green); then checklist rows separated by hairlines, each with a status icon and a word: green circle-check "App installed", green circle-check "Latest version cached", green circle-check "Trip data from today 09:12", green circle-check "Both languages saved", green circle-check "Storage kept by the browser · 420 MB free", amber triangle-alert "2 documents not saved offline" with a quiet orange "Save them" link, amber triangle-alert "1 expense waiting to sync"; a hairline; a line "Tested offline on Mon 10 May" with a grey plane icon; at the bottom, 16 px above the tab bar, one full-width 48 px orange primary button "Download everything" with an off-white label and 8px radius, and a secondary outlined button "Test in airplane mode" above it; a small mascot placeholder, a plain 48 px outlined square labelled "Kiko", at the right of the title (no drawing). Style: page #F5F5F2, raised #FBFBF9, sunken #ECECE8; ink #111417 / #4A5058 / #626971; 1px #D7D8D3 hairlines, 1px #80868E for edges that must be seen; exactly one accent, runway orange #B5470C, used only for interaction (primary button, FAB, links, active tab, selected chip or segment); IBM Plex Sans for text and IBM Plex Mono with tabular figures for codes, times, dates and amounts; radii 4 / 8 / 12 (sheets 16) only, no pills; Lucide icons at 1.75 stroke, one icon set; status always an icon in the status colour plus a word in ink; no gradients, no glass, no blur, no heavy shadows, no cards inside cards, no emoji, no invented brand bar or logo above the title. 390×844, iOS safe areas, bottom tab bar Today · Plan · Docs · Money · More (More active in orange, others grey, 1px hairline on top), light theme.
```

### Sign in

```text
Sign-in screen of an offline-first travel app for people travelling together. No tab bar. Top to bottom: a mascot placeholder, a plain 96 px outlined square slot labelled "Kiko" (no drawing), left aligned; title "Sign in" (24px semibold); one sentence in grey "Your trips, documents and budget, even without a connection."; a field labelled "Email" above it (13px medium grey label), 48 px tall, #FBFBF9 fill, 1px #80868E border, 8px radius, value "traveller@example.com"; a field labelled "Password" with a show/hide eye icon; a quiet orange link "Forgot your password?"; one full-width 48 px orange primary button "Sign in" with an off-white label, 8px radius; a hairline; a line "Have an invitation? Open the link you received." in grey; at the bottom a small language switch "English · Español" with English selected in ink; footer links "Privacy · Terms" in grey. Style: page #F5F5F2, raised #FBFBF9, sunken #ECECE8; ink #111417 / #4A5058 / #626971; 1px #D7D8D3 hairlines, 1px #80868E for edges that must be seen; exactly one accent, runway orange #B5470C, used only for interaction (primary button, FAB, links, active tab, selected chip or segment); IBM Plex Sans for text and IBM Plex Mono with tabular figures for codes, times, dates and amounts; radii 4 / 8 / 12 (sheets 16) only, no pills; Lucide icons at 1.75 stroke, one icon set; status always an icon in the status colour plus a word in ink; no gradients, no glass, no blur, no heavy shadows, no cards inside cards, no emoji, no invented brand bar or logo above the title. 390×844, iOS safe areas, no tab bar, light theme.
```

### Settings

```text
Settings screen (More tab, Settings) of an offline-first travel app. Top to bottom: back chevron and title "Settings" (24px semibold); eyebrow "ACCOUNT" with rows "Name" Traveller one, "Email" traveller@example.com, "Home currency" AUD in mono; eyebrow "APPEARANCE" with a row "Language" and a segmented control "English | Español" (English selected: #FBFBF9 thumb, 1px #80868E ring, orange label; grey #ECECE8 track), and a row "Theme" with a segmented control "System | Light | Dark" (System selected); eyebrow "THIS DEVICE" with rows "Install the app" with a chevron, "Storage" 42 MB used · kept by the browser, "Download everything" with a chevron; eyebrow "TRIP" with rows "Members" 2 with a chevron, "Invite someone" with a chevron; eyebrow "DANGER ZONE" with a secondary outlined button whose label is red #A01C1C "Sign out" and a sentence in grey "1 expense has not synced yet. Signing out now would lose it." with a triangle-alert icon in amber; footer caption "Version 0.4.0" in grey. Rows 56 px, separated by hairlines, never boxed. No floating add-expense button on this screen. Style: page #F5F5F2, raised #FBFBF9, sunken #ECECE8; ink #111417 / #4A5058 / #626971; 1px #D7D8D3 hairlines, 1px #80868E for edges that must be seen; exactly one accent, runway orange #B5470C, used only for interaction (primary button, FAB, links, active tab, selected chip or segment); IBM Plex Sans for text and IBM Plex Mono with tabular figures for codes, times, dates and amounts; radii 4 / 8 / 12 (sheets 16) only, no pills; Lucide icons at 1.75 stroke, one icon set; status always an icon in the status colour plus a word in ink; no gradients, no glass, no blur, no heavy shadows, no cards inside cards, no emoji, no invented brand bar or logo above the title. 390×844, iOS safe areas, bottom tab bar Today · Plan · Docs · Money · More (More active in orange, others grey, 1px hairline on top), light theme.
```

### Variants (`generate_variants`, 3, REFINE, LAYOUT)

- **today**: Refine the layout to match the design system exactly: remove the invented brand bar and the duplicate OFFLINE badge above the title, so the header is only "Day 4 of 12 · Aldria", the connection line and the 48 px Kiko placeholder; keep the ticket as the only card (no platform badge, no walking-time line), keep sections separated by hairlines, keep the Tonight Directions as a link with the Lucide navigation icon, and fit the content as close to one 390×844 screen above the FAB as possible with 8 px section padding. Accent orange only on the FAB, links and the active tab.
- **quick-expense**: Refine the layout to match the design system exactly: the sheet keeps the hero amount, currency chips, category chips, the paid-by line, a 3×4 keypad and one Save expense button; make the keypad keys at least 48 px tall with tabular digits, keep chips 32 px with 4px radius, keep 16 px gutters and 8 px rhythm, and keep the accent orange only on the selected chips, the edit link and the Save button.

### Dark theme (`edit_screens`, every chosen screen)

```text
Render this exact screen in the dark theme using the dark tokens; change nothing else. Dark tokens: page #0F1113, raised #17191C, sunken #202326; ink #ECEDEE / #B4B9BF / #8A9097; hairlines #2C3035, strong edges #6A7079; accent #F08A4B with #0F1113 labels on accent fills, accent wash #33200F; status good #7CC58B, warning #E2AA3A, serious #FFB89A, critical #F07070; print banner #4D3410 with #ECEDEE text; stamp ink #8DB3DD; scrim #000000A3; chart marks #A1A9B0.
```

The first sentence is the procedure's instruction; the token list after it was added because the design system Stitch built carries the light theme only.

### Fix edits (`edit_screens`, one attempt per violation)

- **quick-expense** (from `57c5f4a1fb0a43458817e77f15c2bbfd`): Fix three things and change nothing else: replace the person name "Maya" with the literal placeholder "{partner}" (the app never shows invented names); in the dimmed screen behind the scrim remove the invented "ROAM // SYNC" brand bar and make the "ITINERARY" eyebrow grey #626971 instead of orange, because orange is only for interactive controls.
- **itinerary-day** (from `dc703036727f4e1599e7f6fe19334191`): Fix two things and change nothing else: replace the subtitle "CYCLADES · SUMMER 24" next to the title with "COAST AND ISLANDS" (only invented places may appear), and remove the "ISLAND TRANSIT" label next to the route chip.
- **tasks** (from `932add9bbbd94ad8ae27df9769bdda6d`): Replace the person name "Maya" with the literal placeholder "{partner}" (the app never shows invented names); change nothing else.
- **budget** (from `65235f157c484e61ad2aef38f3500b7e`): Fix two things and change nothing else: the floating add-expense button must show a Lucide plus icon in off-white #F5F5F2 on the orange fill and must sit 16 px above the tab bar without covering the amounts of the recent rows (add bottom padding to the list); the row "Train ALD KSB" must read "Train ALD → KSB" with the arrow.
- **event-detail** (from `d8d1705f50994fb1bc38a9ae115c90e3`): Render this as a full-bleed 390 px wide mobile screen with no surrounding desktop canvas or device frame, and remove the invented "ROAM // SYNC" brand text behind the scrim; change nothing else.
- **trip-list-empty** (from `2203ac144db4420891d524379a7692d0`): Render this as a full-bleed 390 px wide mobile screen (390×844) filling the whole frame, with no surrounding desktop canvas or device frame; keep the same content at normal mobile sizes; change nothing else.
- **trip-list** (from `4d2d314b0cbb4c05b0d3016e14291f13`): Fix two things and change nothing else: remove the invented "LOCAL CACHE READY" and "v2.4.0" line above the title and the footer "ALL TRIPS STORED ON THIS DEVICE"; rotate each passport stamp a few degrees (−6°, +4°, −2°) as stamps are pressed by hand.
- **settings** (from `b369ab6ecb664b95a451918b9f8ce128`): Fix two things and change nothing else: the "DANGER ZONE" eyebrow must be grey #626971 like the other eyebrows (only the Sign out label is red); remove the invented "OFFLINE CACHE" badge next to the title.
- **where-we-sleep** (from `1d6c23445e45405299f9ad4bc051cd3f`): Fix three things and change nothing else: replace "CYCLADES · SUMMER 24" above the title with "COAST AND ISLANDS" (only invented places may appear); remove the invented footer "STORAGE: LOCAL DB (CACHED)" and "UUID: PL-CYC-24"; make the no-lodging alert an unboxed row separated by hairlines (no border box), keeping its octagon-alert icon, words and Add stay link.
- **quick-expense (2)** (from `271881d05cf44a8f8afe12123fecfa39`): In the screen behind the scrim, replace the lodging "Casa di Pietra, Room 302" with "Harbour Inn" and remove "Keybox 9924" (only the app's own synthetic sample data may appear); change nothing else.
- **budget (2)** (from `1731031591634b3eafabb52d69ca9589`): Replace the person name "Maya" with the literal placeholder "{partner}" everywhere (the app never shows invented names) and remove any "ROAM // SYNC" brand text; change nothing else.
- **sign-in dark (fix)** (from `9efef8ca1dd345f4a2e53164538df93f`): The title "Sign in" is invisible: set it in ink #ECEDEE (24px semibold); change nothing else.

## Deviations from DESIGN.md

Implementers follow `DESIGN.md`. Each item says what the mock shows and what
is right; "fixed" means the one `edit_screens` attempt worked and the files
show the fixed version.

**Design system (all screens)**

- Stitch re-derived the Material roles instead of keeping the uploaded ones:
  `primary` `#903400` (our accent `#B5470C` became `primary-container`),
  warm `outline` `#8B7168` / `outline-variant` `#DFC0B5` /
  `on-surface-variant` `#584239` instead of the cool `#80868E` / `#D7D8D3` /
  `#4A5058`, blue `secondary` / `tertiary`, `error` `#BA1A1A`, surfaces
  `#F9F9F6` / `#FFFFFF`. The semantic extras (`surface-0..2`, `ink-1..3`,
  `accent`, `status-*`, `stamp-ink`) were kept. The prompts restate the hex
  values, so the mocks mostly use the right ones.
- The radius scale was halved (`sm` 2, `DEFAULT` 4, `md` 6, `lg` 8, `xl` 12
  px). Right: 4 / 8 / 12, sheets 16.
- The design system has a light theme only; the dark mocks come from an edit
  that lists the dark tokens.
- **Icons**: most mocks use Material Symbols; Event detail uses Lucide;
  Documents, Where we sleep and Budget mix both. Right: Lucide only, 1.75 stroke, from the ui-kit sprite. Not edited:
  swapping icon sets on every screen would have broken the light/dark pairs,
  and the sprite enforces the set anyway.
- The HTML loads Tailwind and the fonts from public CDNs. Right: self-hosted
  woff2, no third-party requests (the app's architecture test forbids them).
- Several screens add a fake iOS status bar. Most frames are 884 px tall
  rather than 844 (Ready to fly 888, Settings 1205, which scrolls).
- On the dark mocks the icon on accent fills (FAB plus, primary labels) is
  sometimes light. Right: `accent-ink` `#0F1113` on `#F08A4B`.

**Per screen**

- **Today**: the first render added an invented brand bar, a duplicate
  offline badge, a platform badge and a walking-time line; the chosen variant
  drops them. "Directions" under Tonight is an orange link with the
  navigation icon (acceptable as a quiet link). Kiko is a labelled square.
- **Quick expense**: Stitch invented a partner's name in the split line and
  a different lodging and an invented brand bar behind the scrim, with an
  orange eyebrow (fixed in two edits). The screen behind the scrim is not the
  real Today. Category chips overflow to the right; "Other" is off-screen.
- **Trip list**: an invented cache/version line and footer (fixed); stamps
  were not rotated (fixed). It adds a "Collected stamps 02 / 12" eyebrow and
  an Aldria stamp although that trip is upcoming.
- **Trip list, empty**: first rendered as a desktop canvas with a small phone
  (fixed).
- **Itinerary day**: Stitch put a real place name in the subtitle (fixed)
  and an extra label beside the route chip (fixed). It still adds a map
  button, an invented confirmation code in a row and a sync time line instead
  of the connection status.
- **Event detail**: first rendered as a desktop canvas (fixed) with an
  invented brand bar behind the scrim (fixed). "Directions" is the sheet's
  one block primary button, which `DESIGN.md` allows.
- **Where we sleep**: a real place name above the title and an invented
  storage/id footer (fixed); the alert was boxed (fixed, now an unboxed row).
  It still adds a "91.6%" figure, a "GAP" tag and an "+ Add" button on the gap
  row that repeats the alert's "Add stay".
- **Documents**: "Save offline" is an underlined link; right: a quiet link
  without underline (the underline belongs to the print banner only).
- **Budget**: an invented partner's name in a recent row (fixed); the FAB
  still covers the amounts of the recent rows after one edit (right: list
  bottom padding so nothing hides under the FAB). Bars sit on a grey track
  (not in the spec) and the header adds "EUR // AUD".
- **Tasks**: an invented partner's name (fixed). It adds a "Synced" label in
  the header.
- **Ready to fly**: adds a "Status check" label. The stepped progress is in
  ink, as specified.
- **Sign in**: on the first dark render the title was invisible, dark on
  dark (fixed).
- **Settings**: the "Danger zone" eyebrow was red and an invented "Offline
  cache" badge sat beside the title (fixed).
