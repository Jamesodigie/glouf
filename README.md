# Glouf website

Marketing site and merchant dashboard prototype for Glouf. Identify the original amid similarities. A technology by Blimp International Digital Services Limited (CAC RC 8037834).

## Website pages
- `index.html`: Home
- `about.html`: About us
- `authentication.html`, `commerce.html`, `payments.html`: Services
- `voucher.html`: Purchase a recharge voucher
- `manufacturers.html`, `how-it-works.html`: For merchants
- `verify.html`: Verify a product (also reads `?code=` from scanned Glouf QR codes)
- `blog.html`, `faq.html`, `contact.html`

## Merchant app (prototype)
- `signup.html`: create a merchant account, then go straight to the dashboard
- `login.html`: merchant log in, plus an admin access tab
- `dashboard.html`: overview, products, QR codes (generate, print, download), stores (Google Maps), scans and analytics (clicks, verified, flagged, locations), go live (document submission), settings, notifications
- `admin.html`: go-live review queue (approve or request changes), merchants, scans and flags

Flow: sign up → set up the dashboard and create products → click **Go live** and submit documents → admin reviews → merchant is alerted when the account is live and codes become active.

### Important
The dashboard is a **front-end prototype**. Accounts, products, codes and scans are saved in the visitor's browser (`assets/store.js`, localStorage), and admin access is open. Before real merchants use it, connect it to the Glouf backend: real authentication, a database, secure document storage, real scan data from the Glouf app, and the official Glouf QR code format. Replace the functions in `assets/store.js` with API calls.

QR codes are generated with [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT), bundled in `assets/qrcode.js`.

## Before going live
- Add the support phone number on `contact.html`
- Confirm the contact email (`hello@glouf.com`) used by the contact and voucher forms
- Confirm voucher amounts (₦1,000 to ₦50,000) and connect online voucher payment
