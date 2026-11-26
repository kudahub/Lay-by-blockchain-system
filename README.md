# Lay-by System

React/Vite frontend with a Node.js API, PostgreSQL persistence, and Fuji-only escrow contracts.

## Local setup

1. Install Node.js 20.19+ and PostgreSQL, or use the included PGlite local development server.
2. Copy `.env.example` to `.env`. Set a random `JWT_SECRET` of at least 32 characters and a local PostgreSQL `DATABASE_URL`.
3. Install dependencies with `npm install`.
4. For the embedded local database, start PGlite with `npm run db:dev`; its persistent files are stored in the git-ignored `.local-db` directory. Native PostgreSQL can also be used.
5. Create the database tables with `npm run db:migrate`.
6. Start the API and frontend together with `npm run dev`, then open `http://localhost:5173`.

The testnet contracts must be deployed separately. Compile with `npm run contracts:compile`, then set `FUJI_DEPLOYER_KEY` locally and run `npm run contracts:deploy:fuji`. Copy the printed addresses to both server and `VITE_` variables in `.env`, then restart the app. The deployment script refuses to run on any chain other than Avalanche Fuji.

To create an administrator, set `ADMIN_EMAIL`, `ADMIN_NAME`, and `ADMIN_PASSWORD` in `.env`, then run `npm run db:create-admin`. Admin accounts cannot be created through public registration.

## Reference architecture

The application separates two financial rails:

- **Retailer subscription rail:** Starter (R199/month), Business (R399/month), and Enterprise (R999/month) → Binance Pay merchant invoice → signed webhook verification → subscription activation/renewal. The subscriptions page includes an editable revenue mix and a local invoice preview; no Binance request or entitlement change is made. Customers never need a paid plan to use lay-by.
- **Customer agreement rail:** retailer creates version 1 → customer accepts → Fuji escrow records instalments → API reconciles confirmed contract events → cancellation or completion settles from the ledger. Customer-facing agreement details remain off-chain.

The architecture view also includes a deterministic hardship-schedule preview based on the selected active agreement, with separate customer and retailer demo approvals. It does not call an AI model or write a contract revision. Encrypted document storage/IPFS anchoring and zero-knowledge proofs are listed as extensions, not implemented services.

The agreement audit log is protected against updates and deletes in the database, and linked Fuji entries include transaction block heights. Fuji contract address, Binance Pay merchant credentials, signed production webhook verification, oracle relay, and on-chain dual-party agreement revisions must be configured or implemented before representing those paths as live. The walkthrough labels simulated and pending integrations explicitly.

## Testnet-only warning

The included `tUSDC` contract is a faucet token and is not USDC, a stablecoin, or redeemable for money. The USD/ZAR quote is informational and does not guarantee a token exchange rate. PGlite is provided for local development and is not a production database service. Do not use the test contracts or this scaffold to hold real customer funds. Production use requires independent smart-contract and application security reviews, regulatory/legal review, operational controls, and a production-grade price/oracle design.

Cancellation terms are attached to each agreement. Merchant approval pays the customer the agreed refund percentage and sends the remainder to the merchant; if the merchant does not respond within seven days, all escrowed test tokens are returned to the customer.
