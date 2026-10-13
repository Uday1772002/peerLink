## authRouter

POST /signUp
POST /login
POST /logout

## ProfileRouter

GET /profile/view
PATCH /profile/edit
PATCH /profile/password // forgot Password api

## connection request Router

POST /request/send/interested
POST /request/send/ignored
POST /request/review/accepted
POST /request/review/rejected

## userRoute

GET /user/feed
GET /user/requests
GET /user/connections

## Membership and chat

POST /payment/create — create a Silver, Gold, or Platinum order
POST /payment/verify — verify checkout signature and captured payment for the logged-in user
GET /payment/verify — current membership, expiry, user, and daily usage
POST /payment/webhook — signed raw-body Razorpay payment.captured webhook
GET /chat/:targetUserId — chat history for an accepted connection

Socket events: joinChat, sendMessage, receiveMessage, errorMessage.
Sockets authenticate with the login cookie. sendMessage accepts an acknowledgement
and ignores client-provided sender identity. DAILY_LIMIT errors identify exhausted
free daily quotas; swipe APIs return HTTP 429 for the same condition.

## Notifications and unread messages

GET /notifications — signed-in user's latest notifications (unread first) and unread count
PATCH /notifications/read — mark owned notificationIds as read
GET /chat/unread — per-sender unread message counts and total
PATCH /chat/:targetUserId/read — mark displayed incoming messageIds as read

New socket events: typing ({ targetUserId, isTyping }), notification,
notificationUpdated, chatUpdated. Typing identity is derived from the session.
joinChat supports an acknowledgement so clients join before fetching history.
receiveMessage includes the saved message _id and timestamps for deduplication.
Personal notification rooms are assigned by the server from the authenticated user.

## Developer matching and showcases

GET /user/feed accepts skills (comma-separated, any matching skill), location,
experienceLevel (beginner/intermediate/experienced), and interest
(project-partner/mentor/mentee/cofounder). The filters combine with the existing
self/request exclusions. Values are validated, and regex characters are escaped.

PATCH /profile/edit also accepts location, experienceLevel, interests (array),
githubUrl, and projects (up to three { title, description, url } objects).
GitHub links must be HTTPS profile URLs on github.com. Project links must be HTTPS.
These optional fields are included in public feed, connection, and request data.
