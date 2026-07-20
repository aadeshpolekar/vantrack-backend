# VanTrack Backend

Real backend for the VanTrack app: multi-tenant API, Postgres database,
JWT login, and a daily job that SMS's parents/owners before a payment lapses.

## 1. Local setup

```bash
npm install
cp .env.example .env
# edit .env with your own values
npm run migrate   # creates the tables
npm run dev        # starts the API on http://localhost:3000
```

## 2. Deploy on Railway (recommended — free tier is enough to start)

1. Create a free account at https://railway.app
2. New Project → **Deploy from GitHub repo** (push this folder to a GitHub repo first)
3. Add a **PostgreSQL** plugin from the Railway dashboard — it gives you a `DATABASE_URL` automatically
4. In your service's **Variables** tab, add: `JWT_SECRET`, `MSG91_AUTH_KEY`, `MSG91_SENDER_ID`, `MSG91_TEMPLATE_ID`, `REMINDER_DAYS_BEFORE`
5. Set the **Start Command** to `npm run migrate && npm start` for the first deploy (then switch back to `npm start` after)
6. Railway gives you a public URL like `https://vantrack-production.up.railway.app` — that's your API base URL

## 3. Set up SMS (MSG91)

1. Sign up at https://msg91.com and complete KYC (needed to send SMS in India)
2. Complete **DLT registration** — mandatory for transactional/promotional SMS to Indian numbers. MSG91 walks you through this.
3. Create a Sender ID (6 letters, e.g. `VNTRCK`) and an SMS template with two variables (student name, due date)
4. Copy your Auth Key, Sender ID, and Template ID into the backend's environment variables

Until you fill those in, the backend just logs what it *would have* sent —
so you can test everything else first.

## 4. Connect the app to this backend

The React app (`van-track.jsx`) currently saves data to browser storage for
demo purposes. To point it at this real backend instead, replace the
`window.storage` calls with `fetch` calls to these endpoints:

| Action | Endpoint |
|---|---|
| Sign up | `POST /api/auth/signup` `{ name, vanName, email, password }` |
| Log in | `POST /api/auth/login` `{ email, password }` |
| List schools | `GET /api/schools` |
| Add school | `POST /api/schools` `{ name }` |
| List students (with live status) | `GET /api/students` |
| Add student + first payment | `POST /api/students` `{ name, schoolId, parentPhone, cycleMonths, startDate, amount }` |
| Renew payment | `POST /api/students/:id/payments` `{ cycleMonths, startDate, amount }` |

Every request except signup/login needs `Authorization: Bearer <token>`
(the token you get back from login/signup).

## 5. Turning the web app into an installable Android/iOS app

The fastest route — no rewrite needed:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap init VanTrack com.yourcompany.vantrack
npx cap add android
npx cap add ios
npx cap sync
```

This wraps your existing React app in a native shell you can build and
submit to the Play Store / App Store. (iOS builds need a Mac + Apple
Developer account; Android needs Android Studio, both free.)

## 6. Selling it

A few practical things to decide once the product works end to end:
- Pricing per van owner (monthly subscription is standard for this kind of tool)
- A way to collect that payment from *them* (Razorpay is the standard choice in India)
- Terms of service + a privacy policy, since you're storing parents' phone numbers
