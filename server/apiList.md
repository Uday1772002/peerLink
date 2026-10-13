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
