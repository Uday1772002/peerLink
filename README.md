# DevTinder

> A lightweight matchmaking app for developers — React + Express + MongoDB.

## Repository layout

- `client/` — Vite + React frontend
- `server/` — Express backend (APIs, payments, socket/chat)

See the full server API list: [server/apiList.md](server/apiList.md)

## Quickstart (development)

Prerequisites:
- Node.js (v18+ recommended)
- MongoDB instance (local or cloud)
- Redis (optional — used by the server if available)

From the project root, open two terminals.

Start the server:

```bash
cd server
npm install
# create a .env with the environment variables listed below
npm run dev
```

Start the client:

```bash
cd client
npm install
npm run dev
```

The backend listens on port `3000` and the Vite dev server runs on `5173` by default.

## Environment variables (server)

Create a `.env` file in `server/` with at least the following variables:

```
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret

# AWS SES (used for sending emails)
AWS_SES_ACCESS_KEY_ID=your_aws_ses_access_key_id
AWS_SES_SECRET_ACCESS_KEY=your_aws_ses_secret_access_key

# Razorpay (payments)
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret
```

Notes:
- The server uses `dotenv` to load environment variables.
- Redis is created with default settings; if you need a remote Redis, update the connection code in `server/src/config/redis.js`.

## Scripts

- Server (in `server/`):
  - `npm run dev` — start with `nodemon` (development)
  - `npm start` — start with `node src/app.js` (production)

- Client (in `client/`):
  - `npm run dev` — start Vite dev server
  - `npm run build` — build production assets
  - `npm run preview` — preview the production build

## Deployment (brief)

1. Build the client: `cd client && npm run build`.
2. Serve the `client/dist` from a static host or integrate with the server (not included by default).
3. Ensure the server has `MONGODB_URI` and other secrets set in environment variables.

## Development notes

- Server port: `3000` (set in `server/src/app.js`).
- Frontend Vite port: `5173` (default from Vite).
- API list and endpoints: see [server/apiList.md](server/apiList.md).

## Contributing

Feel free to open issues or submit pull requests. For quick setup questions, start the server and check console logs for database/redis connection messages.

---
Made with ❤️ — reach out to the repo owner for access details or questions.

## Memberships

Free users can send 10 messages total across their connections and swipe 10 profiles
per day. Both interested and ignored swipes count. Limits reset at midnight UTC and
are stored in MongoDB, so Redis availability does not affect them.

All paid plans unlock unlimited messages, unlimited swipes, and a visible membership
badge: Silver costs ₹499 for 1 month, Gold ₹999 for 3 months, and Platinum ₹1,999 for
12 months. These are one-time payments with no automatic renewal. Expired memberships
return to the free limits. Messaging still requires an accepted connection.

After checkout, the server verifies the payment signature and captured payment with
Razorpay before activating membership and redirecting to `/premium/success`. Configure
Razorpay automatic capture and a `payment.captured` webhook at
`/payment/webhook` with `RAZORPAY_WEBHOOK_SECRET`. This webhook also activates membership
if the browser closes before verification. A processing payment can be checked again
from the premium page. Duplicate callbacks do not extend membership.

Run backend tests with `cd server && npm test`; build and lint the frontend with
`cd client && npm run build && npm run lint`.

## Chat and notifications

The navigation bar shows unread message and notification counts. Each connection
shows its own unread message count. The bell lists up to 30 notifications, showing
unread items first, for new requests, accepted connections, and incoming messages.
Notifications persist in MongoDB and can be marked as read individually or for the
items currently shown. Opening a notification does not clear the conversation's
unread messages.

Incoming messages become read only when their chat is visible and focused. Read
updates specify the displayed message IDs so new arrivals are not cleared by an
older read request. Existing messages without a read timestamp count as unread
until their recipient opens the conversation.

Typing indicators use authenticated Socket.IO rooms, require an accepted connection,
and do not consume the message quota. They clear after a pause, when sending or
leaving chat, or after a three-second timeout on the recipient's screen. Notifications
and unread counts refresh live and every 30 seconds; chat history also refreshes
on reconnect. See [Socket.IO rooms](https://socket.io/docs/v4/rooms/) for the room
routing used by the server. No new environment variables are required.

## Developer matching and showcases

Edit your profile to add a city/region, experience level (beginner, intermediate,
experienced), and goals (project partner, mentor others, find a mentor, cofounder).
Add a GitHub profile URL and up to three projects, each with a title, optional
summary, and HTTPS repository or live demo link. These appear in the live preview,
feed, connections, and request cards. Links are entered manually; no GitHub token
or OAuth setup is required, and account ownership is not verified.

Use the feed's filters to find developers by any selected skill, location text,
experience, and their goal. Skills match whole names without case sensitivity;
location matches text without case sensitivity. Different filter categories are
combined. Applied filters are saved in the URL and reused when loading the next
batch after swiping. Existing users can keep these optional fields empty; they
appear in an unfiltered feed and can add details later.
