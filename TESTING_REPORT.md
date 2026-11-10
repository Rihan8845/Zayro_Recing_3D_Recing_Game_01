# ZAYRO RACING v6.0 — Testing report (honest)

Environment: headless Chromium via Playwright 1.63 with SOFTWARE WebGL (~5 fps), Node 22, local loopback network. No real GPU, no real phone, no internet deployment.

## Actually run and passing (re-run on the final files)
| Area | How | Result |
|---|---|---|
| JS syntax | `node --check` on all 24 JS files | pass |
| HTML / CSS | duplicate ids, tag balance, asset references, CSS brace balance | pass |
| Base files untouched | `cmp` vs original backup | game.js, style.css, finish/mobile/apex/cockpit/graphics/photo/realism/cars identical |
| Server | `npm test`: 23 two-player + 5 four-player tests (rooms, codes, ready, countdown, clamping, finish order, signatures, reconnect, rematch, DNF, malformed input) | 28/28 pass |
| Origin security | upgrade requests with allowed / evil / missing Origin | 101 / 403 / 403 |
| Two real browser sessions | A creates room, B joins by code, ready, start, both race (800 m sprint) | pass; positions streamed ±2 m; live ranking HUD; server-decided 1st/2nd |
| Reconnect | B's socket dropped mid-race, auto-resumed with token | pass (position continues) |
| DNF | crashed/eliminated online player | no certificate, no rewards |
| Certificates | 1st, 2nd, 3rd, 4th, 11th, 22nd generated + text extracted; 3rd rendered and viewed | correct "1ST…22ND PLACE", medal tiers |
| Single-player | full simulated race (1137 steps) → position vs 3 rivals → certificate "3RD PLACE · OF 4" → rewards | pass; also sprint + time-trial |
| Rewards | coin ordering 1st>2nd>3rd>4th for stages 1/3/5, duplicate claim blocked, pending/DNF rejected, car unlock appears in garage, reload persistence, export/import validity | pass |
| Mobile | touch-mode phone viewport drives (GO), seen by desktop opponent | pass |

## NOT tested / limitations
- Real GPU frame rate, real phones (touch steering wheel feel, vibration), real devices on a LAN.
- Deployment on a real host with TLS (`wss://`) and GitHub Pages → server over the internet. The wss path is code-reviewed, not exercised.
- 3–4 player races in browsers (server verified with 4 simulated clients; client UI supports 4 slots but only 2 real browsers were run).
- Socket.IO is NOT used (own WebSocket server instead).
- No car-to-car collision between online players. A determined cheater can still lie about their own car state; the server clamps impossible jumps/speeds and decides the order, but it is not a full physics-authoritative simulation.
- A visual screenshot test (`t_vis`) timed out under software rendering; screenshots from other tests were reviewed manually instead.

## Note on this session
Earlier-session edits to index.html, certificate, extra, legend and plus were overwritten by a file re-copy and were rebuilt from the earlier snapshot, then all tests above were re-run on the rebuilt files.


# v7.0 PRO PACK — testing (2026-11-08)
Run in headless Chromium (software WebGL) with simulated keyboard input; NO human playtest, real GPU or real phone.
| Area | Result |
|---|---|
| Load | no console/page errors; tuning shop, 3 daily challenges, FX layer and HUD present |
| Purchases | engine upgrade cost 600 CR exactly; turbo, gearbox, sport tyres bought; buying with too few credits is refused; state survives a page reload and is in the driver-save export list |
| Physics (40 s full-throttle sim) | classic 0-100 km/h 4.17 s / pro-realism 4.47 s (shift power loss) / fully tuned 3.42 s and 227 km/h vs 196 km/h; no NaN; garageUpgrades identical before and after every run; speed never above the 145 m/s cap |
| Weaving test | slip stays bounded (<=1.2); tyres overheat under constant sliding (as intended) |
| Daily challenges | 3 distinct challenges/day; reward paid once; duplicate result id and DNF pay nothing |
| FX / HUD | overlay switches on during a race, rain droplets drawn, HUD shows tyre temp / turbo / G; screenshot reviewed |
| Regression | single-player race -> 3RD PLACE certificate + rewards, time-trial, sprint, rewards suite, certificates, 2 real browsers online race, reconnect, DNF, mobile touch driver, origin check, 23 + 4-player server tests: all pass |
Not tested: how the new physics *feels* to a human (numbers were chosen conservatively; use the Classic Arcade switch if you dislike it), real GPU frame rate with FX on, phones with FX on, balance across all 8 cars/5 stages.


# Update 2026-11-08: offline certificates
Offline races no longer print a finishing position on the certificate (panel shows STAGE COMPLETED / TIME TRIAL · SOLO RUN). Re-tested: offline sprint (3rd of 4) certificate has no place; offline time trial OK; online 2-browser race still prints 1ST / 2ND PLACE; position PDFs (1st-22nd) still render. 

## v7.3 Manual gearbox
Automated (headless Chromium, software WebGL): t_manual passed — 0-100 km/h auto 4.47 s, manual good shifts 4.47 s, early shifts 5.13 s, stuck in gear 1 capped ~36 km/h, over-rev downshift blocked, Q/E keys, phone ▲▼ button. Regression (solo, pro, cert, rewards, multiplayer browser) passed, no console errors.
NOT tested: real human feel/balance, real GPU, real phone hardware.
