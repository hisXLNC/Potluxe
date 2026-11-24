# Tableside

Private dinner invites. A host sets up a dinner in a guided flow, shares one link, and guests
reply, choose their food (with options like doneness and extras), claim dishes to bring and see
their share of the bill. The host gets a live kitchen ticket that can be printed.

It is a plain static site (no build step) that installs to the home screen on Android and iOS.

## Run it locally

```bash
python3 -m http.server 8765
```

Open http://localhost:8765. Until Firebase is connected the app runs in preview mode: dinners are
stored in that browser only.

## Go live (free)

1. **Database** – at https://console.firebase.google.com create a project (no Analytics needed).
   - Build → Firestore Database → Create database (production mode).
   - Firestore → Rules: paste the contents of `firestore.rules` and publish.
   - Build → Authentication → Sign-in method → enable **Anonymous**.
   - Project settings → Your apps → Web app (`</>`) → copy the config into `js/firebase-config.js`.
2. **Hosting** – push this folder to a GitHub repository and enable Settings → Pages → Deploy from
   branch (`main`, root). Add the Pages domain under Firebase Authentication → Settings →
   Authorized domains.

Both are within free tiers for this kind of use (Firestore Spark: 50k reads / 20k writes a day).

## How privacy works

- Each dinner has a random 8-character code. The database refuses to list dinners, so an invite can
  only be opened by someone who has the code or link.
- The host holds a secret host key (the "private host link"). Only holders can edit or delete the
  dinner, lock orders, or edit other guests.
- Guests are signed in anonymously per device and can only change their own reply and order.

## Layout

- `js/app.js` router and home · `js/wizard.js` guided setup/editing · `js/event.js` invite, order,
  bring board, guests · `js/kitchen.js` kitchen ticket · `js/calc.js` prices and totals ·
  `js/store.js` Firebase / preview data layer · `js/templates.js` starter menus and themes
