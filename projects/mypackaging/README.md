# mypackaging

A React + Firebase shop system for small retail operations. Tracks products, inventory, purchases (stock-in), sales (stock-out), credits (hutang), payments, and stock adjustments.

## Quick start

1. Prereqs: Node 18+, npm 9+
2. Clone and install:
	- `git clone https://github.com/kownkotess/mypackaging.git`
	- `cd mypackaging`
	- `npm install`
3. Firebase web app config:
	- Create a project in Firebase console and a Web app
	- Enable Authentication (Email/Password) and Firestore
	- Copy config to `.env` (see `.env.sample`):
	  - `REACT_APP_FIREBASE_API_KEY=...`
	  - `REACT_APP_FIREBASE_AUTH_DOMAIN=...`
	  - `REACT_APP_FIREBASE_PROJECT_ID=...`
	  - `REACT_APP_FIREBASE_STORAGE_BUCKET=...`
	  - `REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...`
	  - `REACT_APP_FIREBASE_APP_ID=...`
4. Run locally:
	- `npm start`

## Project structure

- `src/context/AuthContext.js` — Firebase Auth state, `useAuth()`
- `src/components/ProtectedRoute.js` — Route guard
- `src/pages/*` — Placeholder pages (Dashboard, Products, Sales, Purchases, Hutang, Login)
- `src/firebase.js` — Firebase init (uses `.env`, falls back to inline dev config)

## Next milestones

- Firestore helpers and data model (products, sales, purchases, credits, payments, stock_adjustments)
- Products CRUD with stock tracking
- Sales/Purchases flows updating stock + adjustment logs
- Hutang and payment recording

## Safety and backups

- Commit and push after each work session.
- This README lists setup so you can restore quickly on any machine.
