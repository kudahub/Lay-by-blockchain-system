import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHmac } from "node:crypto";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Contract, Interface, JsonRpcProvider, getAddress, id, verifyMessage } from "ethers";
import { pool, requirePool } from "./db/pool.js";
import { escrowAbi } from "./src/lib/contractAbi.js";
import { getZarRate, zarCentsToTokenUnits } from "./src/lib/fx.js";

const scrypt = promisify(scryptCallback);
const app = express();
const port = Number(process.env.PORT || 5174);
const cookieName = "layby_session";
const tokenLifetimeSeconds = 12 * 60 * 60;
const escrowInterface = new Interface(escrowAbi);
const root = path.dirname(fileURLToPath(import.meta.url));

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "32kb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const installmentIntervalSeconds = 30 * 24 * 60 * 60;

function requireText(value, label, maxLength = 200) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw httpError(400, `${label} is required and must be at most ${maxLength} characters`);
  }
  return value.trim();
}

function requireInteger(value, label, min, max) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw httpError(400, `${label} must be an integer from ${min} to ${max}`);
  }
  return number;
}

function normalizeAddress(value, label) {
  const text = requireText(value, label, 42);
  try {
    return getAddress(text).toLowerCase();
  } catch {
    throw httpError(400, `${label} is not a valid EVM address.`);
  }
}

function cookieValue(request, name) {
  const prefix = `${name}=`;
  const item = (request.headers.cookie || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : "";
}

function encodeBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function signSession(userId) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw httpError(503, "Set JWT_SECRET to at least 32 characters before enabling account sessions.");
  }
  const now = Math.floor(Date.now() / 1000);
  const payload = encodeBase64Url(JSON.stringify({ sub: userId, iat: now, exp: now + tokenLifetimeSeconds }));
  const input = `v1.${payload}`;
  const signature = createHmac("sha256", process.env.JWT_SECRET).update(input).digest("base64url");
  return `${input}.${signature}`;
}

function verifySession(token) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) return null;
  const [version, payload, signature] = token.split(".");
  if (version !== "v1" || !payload || !signature) return null;
  const expected = createHmac("sha256", process.env.JWT_SECRET).update(`${version}.${payload}`).digest();
  let actual;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return claims.exp > Date.now() / 1000 ? claims : null;
  } catch {
    return null;
  }
}

function setSession(response, userId) {
  response.cookie(cookieName, signSession(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: tokenLifetimeSeconds * 1000,
    path: "/",
  });
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    wallet_address: user.wallet_address,
  };
}

async function authRequired(request, response, next) {
  try {
    const claims = verifySession(cookieValue(request, cookieName));
    if (!claims) throw httpError(401, "Please sign in to continue.");
    const database = requirePool();
    const result = await database.query(
      "SELECT id, email, full_name, role, wallet_address FROM users WHERE id = $1",
      [claims.sub],
    );
    if (!result.rowCount) throw httpError(401, "Account no longer exists.");
    request.user = result.rows[0];
    next();
  } catch (error) {
    next(error);
  }
}

function roleRequired(...roles) {
  return (request, _response, next) => {
    if (!roles.includes(request.user.role)) return next(httpError(403, "You do not have permission to do that."));
    next();
  };
}

function normalizeEmail(value) {
  const email = requireText(value, "Email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, "Enter a valid email address.");
  return email;
}

async function hashPassword(password) {
  if (typeof password !== "string" || password.length < 12 || password.length > 200) {
    throw httpError(400, "Password must be between 12 and 200 characters.");
  }
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${Buffer.from(hash).toString("hex")}`;
}

async function checkPassword(password, encoded) {
  const [scheme, saltHex, hashHex] = encoded.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = Buffer.from(await scrypt(password, Buffer.from(saltHex, "hex"), expected.length));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function withWalletProvider() {
  const rpcUrl = process.env.CHAIN_RPC_URL;
  if (!rpcUrl) throw httpError(503, "CHAIN_RPC_URL is not configured.");
  return new JsonRpcProvider(rpcUrl, Number(process.env.CHAIN_ID || 43113));
}

async function getVerifiedReceipt(txHash) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw httpError(400, "Invalid transaction hash.");
  const contractAddress = process.env.ESCROW_CONTRACT_ADDRESS;
  if (!contractAddress) throw httpError(503, "ESCROW_CONTRACT_ADDRESS is not configured.");
  const provider = withWalletProvider();
  const [network, receipt, transaction] = await Promise.all([
    provider.getNetwork(),
    provider.getTransactionReceipt(txHash),
    provider.getTransaction(txHash),
  ]);
  if (Number(network.chainId) !== 43113) throw httpError(503, "The configured RPC is not Avalanche Fuji.");
  const tokenAddress = process.env.TOKEN_CONTRACT_ADDRESS;
  if (!tokenAddress) throw httpError(503, "TOKEN_CONTRACT_ADDRESS is not configured.");
  const contract = new Contract(contractAddress, escrowAbi, provider);
  const [escrowCode, tokenCode, configuredToken, expectedToken] = await Promise.all([
    provider.getCode(contractAddress),
    provider.getCode(tokenAddress),
    contract.token(),
    Promise.resolve(getAddress(tokenAddress)),
  ]);
  if (escrowCode === "0x" || tokenCode === "0x" || getAddress(configuredToken) !== expectedToken) {
    throw httpError(503, "Configured Fuji escrow/token addresses do not match deployed contracts.");
  }
  if (!receipt || !transaction) throw httpError(409, "Transaction is not confirmed yet.");
  if (receipt.status !== 1) throw httpError(400, "The blockchain transaction failed.");
  return { receipt, transaction, contractAddress: getAddress(contractAddress), provider };
}

function findEvent(receipt, contractAddress, eventName) {
  const matching = [];
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== contractAddress.toLowerCase()) continue;
    try {
      const parsed = escrowInterface.parseLog(log);
      if (parsed?.name === eventName) matching.push({ parsed, log });
    } catch {
      continue;
    }
  }
  if (matching.length !== 1) throw httpError(400, `Expected one ${eventName} event from the configured escrow contract.`);
  return matching[0];
}

function canonicalTermsHash(terms) {
  const canonical = JSON.stringify(Object.fromEntries(Object.entries(terms).sort(([a], [b]) => a.localeCompare(b))));
  return { canonical, hash: id(canonical) };
}

function toTokenAmount(zarCents, rate) {
  return zarCentsToTokenUnits(zarCents, rate).toString();
}

function splitAmount(total, pieces) {
  const amount = BigInt(total);
  const count = BigInt(pieces);
  const base = amount / count;
  const remainder = amount % count;
  return Array.from({ length: pieces }, (_, index) => (base + (BigInt(index) < remainder ? 1n : 0n)).toString());
}

function agreementAccessSql(user, firstParameter = 1) {
  if (user.role === "admin") return { sql: "TRUE", params: [] };
  if (user.role === "merchant") return { sql: `merchant_id = $${firstParameter}`, params: [user.id] };
  const wallet = user.wallet_address?.toLowerCase() || "";
  return {
    sql: `(customer_id = $${firstParameter} OR lower(customer_email) = $${firstParameter + 1} OR lower(customer_wallet) = $${firstParameter + 2})`,
    params: [user.id, user.email.toLowerCase(), wallet],
  };
}

function txHash(value) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw httpError(400, "Invalid transaction hash.");
  return value;
}

app.get("/api/health", async (_request, response) => {
  if (!pool) return response.status(503).json({ ok: false, database: "not_configured" });
  try {
    await pool.query("SELECT 1");
    response.json({ ok: true, database: "connected", chainId: Number(process.env.CHAIN_ID || 43113) });
  } catch (error) {
    console.error("Database health check failed:", error.message);
    response.status(503).json({ ok: false, database: "unavailable" });
  }
});

app.post("/api/auth/register", authLimiter, async (request, response) => {
  const database = requirePool();
  const email = normalizeEmail(request.body.email);
  const fullName = requireText(request.body.full_name, "Full name", 120);
  const role = request.body.role;
  if (!["customer", "merchant"].includes(role)) throw httpError(400, "Role must be customer or merchant.");
  const passwordHash = await hashPassword(request.body.password);
  const userId = randomUUID();
  try {
    const result = await database.query(
      "INSERT INTO users (id, email, full_name, role, password_hash) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, full_name, role, wallet_address",
      [userId, email, fullName, role, passwordHash],
    );
    setSession(response, userId);
    response.status(201).json({ user: publicUser(result.rows[0]) });
  } catch (error) {
    if (error.code === "23505") throw httpError(409, "An account with that email already exists.");
    throw error;
  }
});

app.post("/api/auth/login", authLimiter, async (request, response) => {
  const email = normalizeEmail(request.body.email);
  const password = request.body.password;
  if (typeof password !== "string" || password.length > 200) throw httpError(400, "Invalid email or password.");
  const result = await requirePool().query(
    "SELECT id, email, full_name, role, wallet_address, password_hash FROM users WHERE email = $1",
    [email],
  );
  if (!result.rowCount || !(await checkPassword(password, result.rows[0].password_hash))) {
    throw httpError(401, "Invalid email or password.");
  }
  setSession(response, result.rows[0].id);
  response.json({ user: publicUser(result.rows[0]) });
});

app.post("/api/auth/logout", (_request, response) => {
  response.clearCookie(cookieName, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/" });
  response.status(204).end();
});

app.get("/api/auth/me", authRequired, (request, response) => {
  response.json({ user: publicUser(request.user) });
});

app.post("/api/wallet/challenge", authRequired, async (request, response) => {
  const address = getAddress(normalizeAddress(request.body.address, "Wallet address"));
  const nonce = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 5 * 60_000);
  await requirePool().query(
    "INSERT INTO wallet_challenges (user_id, nonce, expires_at) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET nonce = EXCLUDED.nonce, expires_at = EXCLUDED.expires_at",
    [request.user.id, nonce, expiresAt],
  );
  response.json({
    message: `Lay-by System wallet link\nAddress: ${address}\nNonce: ${nonce}\nExpires: ${expiresAt.toISOString()}`,
  });
});

app.post("/api/wallet/verify", authRequired, async (request, response) => {
  const address = getAddress(normalizeAddress(request.body.address, "Wallet address"));
  const signature = requireText(request.body.signature, "Signature", 200);
  const challenge = await requirePool().query(
    "SELECT nonce, expires_at FROM wallet_challenges WHERE user_id = $1",
    [request.user.id],
  );
  if (!challenge.rowCount || new Date(challenge.rows[0].expires_at).getTime() <= Date.now()) {
    throw httpError(400, "Wallet challenge expired. Request a new one.");
  }
  const expectedMessage = `Lay-by System wallet link\nAddress: ${address}\nNonce: ${challenge.rows[0].nonce}\nExpires: ${new Date(challenge.rows[0].expires_at).toISOString()}`;
  let signer;
  try {
    signer = getAddress(verifyMessage(expectedMessage, signature));
  } catch {
    throw httpError(400, "Wallet signature could not be verified.");
  }
  if (signer !== address) throw httpError(400, "Signature does not match the wallet address.");
  try {
    const result = await requirePool().query(
      "UPDATE users SET wallet_address = $1 WHERE id = $2 RETURNING id, email, full_name, role, wallet_address",
      [address.toLowerCase(), request.user.id],
    );
    await requirePool().query("DELETE FROM wallet_challenges WHERE user_id = $1", [request.user.id]);
    response.json({ user: publicUser(result.rows[0]) });
  } catch (error) {
    if (error.code === "23505") throw httpError(409, "That wallet is already linked to another account.");
    throw error;
  }
});

app.get("/api/fx/quote", async (request, response) => {
  const zarCents = requireInteger(request.query.zar_cents, "zar_cents", 100, 1_000_000_000_00);
  const quote = await getZarRate();
  response.json({
    settlement_asset: "TestUSDC",
    zar_per_usd: quote.rate,
    token_units: toTokenAmount(zarCents, quote.rate),
    observed_at: quote.observedAt.toISOString(),
    provider: quote.provider,
    warning: "Fuji TestUSDC is valueless testnet currency. This quote is indicative only.",
  });
});

app.post("/api/agreements", authRequired, roleRequired("merchant"), async (request, response) => {
  const database = requirePool();
  const customerEmail = normalizeEmail(request.body.customer_email);
  const customerWallet = normalizeAddress(request.body.customer_wallet, "Customer wallet");
  const item = requireText(request.body.item, "Item", 180);
  const totalZarCents = requireInteger(request.body.total_zar_cents, "total_zar_cents", 100, 1_000_000_000_00);
  const depositZarCents = requireInteger(request.body.deposit_zar_cents, "deposit_zar_cents", 1, totalZarCents - 1);
  const termMonths = requireInteger(request.body.term_months, "term_months", 1, 36);
  const cancellationRefundBps = requireInteger(request.body.cancellation_refund_bps, "cancellation_refund_bps", 0, 10_000);
  const cancellationTerms = `On merchant approval, ${cancellationRefundBps / 100}% of escrowed instalments are refunded to the customer and the remainder is paid to the merchant. If the merchant does not respond within 7 days, all escrowed instalments are automatically refunded to the customer.`;
  const quote = await getZarRate();
  const totalTokenUnits = toTokenAmount(totalZarCents, quote.rate);
  const depositTokenUnits = toTokenAmount(depositZarCents, quote.rate);
  if (BigInt(depositTokenUnits) <= 0n || BigInt(totalTokenUnits) <= BigInt(depositTokenUnits)) {
    throw httpError(400, "ZAR amounts are too small to convert to positive TestUSDC units.");
  }
  const matchingCustomer = await database.query("SELECT id FROM users WHERE lower(email) = $1", [customerEmail]);
  const agreementId = randomUUID();
  const externalRef = id(agreementId);
  const terms = {
    cancellationRefundBps,
    cancellationResponseSeconds: 7 * 24 * 60 * 60,
    customerEmail,
    customerWallet,
    depositZarCents,
    fxObservedAt: quote.observedAt.toISOString(),
    fxProvider: quote.provider,
    fxRateZarPerUsd: quote.rate,
    item,
    merchantId: request.user.id,
    termMonths,
    totalZarCents,
  };
  const { hash: termsHash } = canonicalTermsHash(terms);
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const agreement = await client.query(
      `INSERT INTO agreements (
        id, merchant_id, customer_id, customer_email, customer_wallet, item,
        total_zar_cents, deposit_zar_cents, total_token_units, deposit_token_units,
        fx_rate_zar_per_usd, fx_provider, fx_observed_at, term_months, cancellation_refund_bps,
        cancellation_terms, terms_hash, external_ref, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'draft')
      RETURNING *`,
      [
        agreementId,
        request.user.id,
        matchingCustomer.rows[0]?.id || null,
        customerEmail,
        customerWallet,
        item,
        totalZarCents,
        depositZarCents,
        totalTokenUnits,
        depositTokenUnits,
        quote.rate,
        quote.provider,
        quote.observedAt,
        termMonths,
        cancellationRefundBps,
        cancellationTerms,
        termsHash,
        externalRef,
      ],
    );

    const regularZar = splitAmount(totalZarCents - depositZarCents, termMonths);
    const regularTokens = splitAmount(BigInt(totalTokenUnits) - BigInt(depositTokenUnits), termMonths);
    const dueRows = [
      { sequence: 0, date: new Date(), zar: String(depositZarCents), token: depositTokenUnits },
      ...regularZar.map((zar, index) => ({
        sequence: index + 1,
        date: new Date(Date.now() + installmentIntervalSeconds * 1000 * (index + 1)),
        zar,
        token: regularTokens[index],
      })),
    ];
    for (const due of dueRows) {
      await client.query(
        "INSERT INTO instalments (id, agreement_id, sequence, due_at, amount_zar_cents, amount_token_units, status) VALUES ($1,$2,$3,$4,$5,$6,'due')",
        [randomUUID(), agreementId, due.sequence, due.date, due.zar, due.token],
      );
    }
    await client.query(
      "INSERT INTO audit_events (id, actor_id, agreement_id, event_type, details) VALUES ($1,$2,$3,'agreement_drafted',$4)",
      [randomUUID(), request.user.id, agreementId, JSON.stringify({ item, totalZarCents, cancellationRefundBps })],
    );
    await client.query("COMMIT");
    response.status(201).json({
      agreement: { ...agreement.rows[0], instalments: dueRows },
      chain: {
        externalRef,
        termsHash,
        totalZarCents: String(totalZarCents),
        fxRateE6: String(Math.round(quote.rate * 1_000_000)),
        totalTokenUnits,
        depositTokenUnits,
        monthlyInstallments: termMonths,
        intervalSeconds: String(installmentIntervalSeconds),
        cancellationRefundBps,
        customerWallet,
      },
      quote: { rate: quote.rate, observedAt: quote.observedAt.toISOString(), provider: quote.provider },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

app.get("/api/agreements", authRequired, async (request, response) => {
  const database = requirePool();
  const access = agreementAccessSql(request.user);
  const result = await database.query(
    `SELECT a.*, u.full_name AS merchant_name,
       COALESCE(json_agg(json_build_object(
         'id', i.id, 'sequence', i.sequence, 'due_at', i.due_at,
         'amount_zar_cents', i.amount_zar_cents, 'amount_token_units', i.amount_token_units,
         'status', i.status, 'tx_hash', i.tx_hash, 'paid_at', i.paid_at
       ) ORDER BY i.sequence) FILTER (WHERE i.id IS NOT NULL), '[]'::json) AS instalments
     FROM agreements a
     JOIN users u ON u.id = a.merchant_id
     LEFT JOIN instalments i ON i.agreement_id = a.id
     WHERE ${access.sql}
     GROUP BY a.id, u.full_name
     ORDER BY a.created_at DESC
     LIMIT 200`,
    access.params,
  );
  response.json({ agreements: result.rows });
});

async function loadAgreementForUser(agreementId, user) {
  const access = agreementAccessSql(user, 2);
  const result = await requirePool().query(
    `SELECT a.*, u.full_name AS merchant_name,
      COALESCE(json_agg(json_build_object(
        'id', i.id, 'sequence', i.sequence, 'due_at', i.due_at,
        'amount_zar_cents', i.amount_zar_cents, 'amount_token_units', i.amount_token_units,
        'status', i.status, 'tx_hash', i.tx_hash, 'paid_at', i.paid_at
      ) ORDER BY i.sequence) FILTER (WHERE i.id IS NOT NULL), '[]'::json) AS instalments
     FROM agreements a JOIN users u ON u.id = a.merchant_id
     LEFT JOIN instalments i ON i.agreement_id = a.id
     WHERE a.id = $1 AND ${access.sql}
     GROUP BY a.id, u.full_name`,
    [agreementId, ...access.params],
  );
  if (!result.rowCount) throw httpError(404, "Agreement not found.");
  return result.rows[0];
}

app.get("/api/agreements/:id", authRequired, async (request, response) => {
  response.json({ agreement: await loadAgreementForUser(request.params.id, request.user) });
});

app.post("/api/agreements/:id/confirm", authRequired, roleRequired("merchant"), async (request, response) => {
  const agreement = await loadAgreementForUser(request.params.id, request.user);
  if (agreement.status !== "draft") throw httpError(409, "Agreement has already been submitted on-chain.");
  const hash = txHash(request.body.tx_hash);
  const { receipt, transaction, contractAddress } = await getVerifiedReceipt(hash);
  const { parsed, log } = findEvent(receipt, contractAddress, "AgreementCreated");
  const event = parsed.args;
  const expectedRef = id(agreement.id);
  if (transaction.from.toLowerCase() !== request.user.wallet_address?.toLowerCase()
      || event.merchant.toLowerCase() !== request.user.wallet_address?.toLowerCase()
      || event.customer.toLowerCase() !== agreement.customer_wallet
      || event.externalRef.toLowerCase() !== expectedRef.toLowerCase()
      || event.termsHash.toLowerCase() !== agreement.terms_hash.toLowerCase()
      || event.totalZarCents.toString() !== String(agreement.total_zar_cents)
      || event.totalTokenAmount.toString() !== String(agreement.total_token_units)
      || event.depositTokenAmount.toString() !== String(agreement.deposit_token_units)
      || Number(event.fxRateE6) !== Math.round(Number(agreement.fx_rate_zar_per_usd) * 1_000_000)
      || Number(event.monthlyInstallments) !== Number(agreement.term_months)
      || Number(event.cancellationRefundBps) !== Number(agreement.cancellation_refund_bps)) {
    throw httpError(400, "Confirmed contract event does not match this agreement.");
  }
  const client = await requirePool().connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      "UPDATE agreements SET chain_agreement_id = $1, contract_address = $2, status = 'offered', updated_at = now() WHERE id = $3 AND status = 'draft' RETURNING id",
      [event.agreementId.toString(), contractAddress.toLowerCase(), agreement.id],
    );
    if (!updated.rowCount) throw httpError(409, "Agreement was already confirmed.");
    await client.query(
      "INSERT INTO chain_transactions (tx_hash, agreement_id, kind, block_number, log_index) VALUES ($1,$2,'created',$3,$4)",
      [hash, agreement.id, receipt.blockNumber, log.index],
    );
    await client.query(
      "INSERT INTO audit_events (id, actor_id, agreement_id, event_type, details) VALUES ($1,$2,$3,'agreement_created_on_chain',$4)",
      [randomUUID(), request.user.id, agreement.id, JSON.stringify({ txHash: hash, chainAgreementId: event.agreementId.toString() })],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  response.json({ agreement: await loadAgreementForUser(agreement.id, request.user) });
});

app.post("/api/agreements/:id/accept/verify", authRequired, async (request, response) => {
  const agreement = await loadAgreementForUser(request.params.id, request.user);
  if (request.user.role !== "customer" || request.user.wallet_address?.toLowerCase() !== agreement.customer_wallet) {
    throw httpError(403, "Only the linked customer may accept this agreement.");
  }
  const hash = txHash(request.body.tx_hash);
  const { receipt, transaction, contractAddress, provider } = await getVerifiedReceipt(hash);
  const { parsed, log } = findEvent(receipt, contractAddress, "AgreementAccepted");
  if (transaction.from.toLowerCase() !== agreement.customer_wallet || parsed.args.customer.toLowerCase() !== agreement.customer_wallet
      || parsed.args.agreementId.toString() !== String(agreement.chain_agreement_id)) {
    throw httpError(400, "Acceptance event does not match this agreement.");
  }
  const database = requirePool();
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const confirmedBlock = await provider.getBlock(receipt.blockNumber);
    if (!confirmedBlock) throw httpError(503, "Could not read the acceptance block timestamp.");
    const acceptedAt = new Date(Number(confirmedBlock.timestamp) * 1000);
    await client.query("UPDATE instalments SET due_at = $1 WHERE agreement_id = $2 AND sequence = 0", [acceptedAt, agreement.id]);
    for (let sequence = 1; sequence <= Number(agreement.term_months); sequence += 1) {
      await client.query(
        "UPDATE instalments SET due_at = $1 WHERE agreement_id = $2 AND sequence = $3",
        [new Date(acceptedAt.getTime() + installmentIntervalSeconds * 1000 * sequence), agreement.id, sequence],
      );
    }
    const updated = await client.query("UPDATE agreements SET status = 'active', updated_at = now() WHERE id = $1 AND status = 'offered' RETURNING id", [agreement.id]);
    if (!updated.rowCount) throw httpError(409, "Agreement is not awaiting acceptance.");
    await client.query(
      "INSERT INTO chain_transactions (tx_hash, agreement_id, kind, block_number, log_index) VALUES ($1,$2,'accepted',$3,$4)",
      [hash, agreement.id, receipt.blockNumber, log.index],
    );
    await client.query(
      "INSERT INTO audit_events (id, actor_id, agreement_id, event_type, details) VALUES ($1,$2,$3,'agreement_accepted',$4)",
      [randomUUID(), request.user.id, agreement.id, JSON.stringify({ txHash: hash })],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  response.json({ agreement: await loadAgreementForUser(agreement.id, request.user) });
});

app.post("/api/agreements/:id/payments/verify", authRequired, async (request, response) => {
  const agreement = await loadAgreementForUser(request.params.id, request.user);
  if (request.user.wallet_address?.toLowerCase() !== agreement.customer_wallet) throw httpError(403, "Only the linked customer may record an instalment.");
  const hash = txHash(request.body.tx_hash);
  const { receipt, transaction, contractAddress } = await getVerifiedReceipt(hash);
  const { parsed, log } = findEvent(receipt, contractAddress, "InstalmentPaid");
  if (transaction.from.toLowerCase() !== agreement.customer_wallet
      || parsed.args.customer.toLowerCase() !== agreement.customer_wallet
      || parsed.args.agreementId.toString() !== String(agreement.chain_agreement_id)) {
    throw httpError(400, "Instalment event does not match this agreement.");
  }
  const sequence = Number(parsed.args.sequence);
  const database = requirePool();
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const payment = await client.query(
      "UPDATE instalments SET status = 'paid', tx_hash = $1, paid_at = now() WHERE agreement_id = $2 AND sequence = $3 AND status = 'due' AND amount_token_units = $4 RETURNING id",
      [hash, agreement.id, sequence, parsed.args.amount.toString()],
    );
    if (!payment.rowCount) throw httpError(409, "This payment is already recorded or does not match a due instalment.");
    const paidBefore = await client.query(
      "SELECT COALESCE(sum(amount_token_units), 0)::text AS total FROM instalments WHERE agreement_id = $1 AND status = 'paid'",
      [agreement.id],
    );
    if (BigInt(paidBefore.rows[0].total) !== BigInt(parsed.args.totalPaid.toString())) {
      throw httpError(400, "The on-chain paid total does not match the instalment ledger.");
    }
    await client.query(
      "INSERT INTO chain_transactions (tx_hash, agreement_id, kind, block_number, log_index) VALUES ($1,$2,'payment',$3,$4)",
      [hash, agreement.id, receipt.blockNumber, log.index],
    );
    const unpaid = await client.query("SELECT count(*)::int AS count FROM instalments WHERE agreement_id = $1 AND status = 'due'", [agreement.id]);
    if (unpaid.rows[0].count === 0) {
      await client.query("UPDATE agreements SET status = 'completed', updated_at = now() WHERE id = $1", [agreement.id]);
    }
    await client.query(
      "INSERT INTO audit_events (id, actor_id, agreement_id, event_type, details) VALUES ($1,$2,$3,'instalment_verified',$4)",
      [randomUUID(), request.user.id, agreement.id, JSON.stringify({ txHash: hash, sequence, amount: parsed.args.amount.toString() })],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  response.json({ agreement: await loadAgreementForUser(agreement.id, request.user) });
});

app.post("/api/agreements/:id/cancellation/request/verify", authRequired, async (request, response) => {
  const agreement = await loadAgreementForUser(request.params.id, request.user);
  if (request.user.role !== "customer" || request.user.wallet_address?.toLowerCase() !== agreement.customer_wallet) {
    throw httpError(403, "Only the linked customer may request cancellation.");
  }
  const hash = txHash(request.body.tx_hash);
  const { receipt, transaction, contractAddress } = await getVerifiedReceipt(hash);
  const { parsed, log } = findEvent(receipt, contractAddress, "CancellationRequested");
  if (transaction.from.toLowerCase() !== agreement.customer_wallet || parsed.args.agreementId.toString() !== String(agreement.chain_agreement_id)) {
    throw httpError(400, "Cancellation request does not match this agreement.");
  }
  const client = await requirePool().connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      "UPDATE agreements SET status = 'cancellation_requested', cancellation_deadline = $2, updated_at = now() WHERE id = $1 AND status = 'active' RETURNING id",
      [agreement.id, new Date(Number(parsed.args.responseDeadline) * 1000)],
    );
    if (!updated.rowCount) throw httpError(409, "Agreement is not active.");
    await client.query(
      "INSERT INTO chain_transactions (tx_hash, agreement_id, kind, block_number, log_index) VALUES ($1,$2,'cancellation_requested',$3,$4)",
      [hash, agreement.id, receipt.blockNumber, log.index],
    );
    await client.query(
      "INSERT INTO audit_events (id, actor_id, agreement_id, event_type, details) VALUES ($1,$2,$3,'cancellation_requested',$4)",
      [randomUUID(), request.user.id, agreement.id, JSON.stringify({ txHash: hash, responseDeadline: Number(parsed.args.responseDeadline) })],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  response.json({ agreement: await loadAgreementForUser(agreement.id, request.user) });
});

app.post("/api/agreements/:id/cancellation/verify", authRequired, async (request, response) => {
  const agreement = await loadAgreementForUser(request.params.id, request.user);
  const hash = txHash(request.body.tx_hash);
  const { receipt, contractAddress } = await getVerifiedReceipt(hash);
  const { parsed, log } = findEvent(receipt, contractAddress, "AgreementCancelled");
  if (parsed.args.agreementId.toString() !== String(agreement.chain_agreement_id)
      || parsed.args.customer.toLowerCase() !== agreement.customer_wallet) {
    throw httpError(400, "Cancellation event does not match this agreement.");
  }
  const client = await requirePool().connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      "UPDATE agreements SET status = 'cancelled', refund_token_units = $2, merchant_settlement_token_units = $3, updated_at = now() WHERE id = $1 AND status = 'cancellation_requested' RETURNING id",
      [agreement.id, parsed.args.refundAmount.toString(), parsed.args.merchantAmount.toString()],
    );
    if (!updated.rowCount) throw httpError(409, "Agreement has no cancellation request.");
    await client.query("UPDATE instalments SET status = 'cancelled' WHERE agreement_id = $1 AND status = 'due'", [agreement.id]);
    await client.query(
      "INSERT INTO chain_transactions (tx_hash, agreement_id, kind, block_number, log_index) VALUES ($1,$2,'cancelled',$3,$4)",
      [hash, agreement.id, receipt.blockNumber, log.index],
    );
    await client.query(
      "INSERT INTO audit_events (id, actor_id, agreement_id, event_type, details) VALUES ($1,$2,$3,'agreement_cancelled',$4)",
      [randomUUID(), request.user.id, agreement.id, JSON.stringify({
        txHash: hash,
        refundTokenUnits: parsed.args.refundAmount.toString(),
        merchantSettlementTokenUnits: parsed.args.merchantAmount.toString(),
      })],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  response.json({ agreement: await loadAgreementForUser(agreement.id, request.user) });
});

app.get("/api/agreements/:id/audit", authRequired, async (request, response) => {
  const agreement = await loadAgreementForUser(request.params.id, request.user);
  const events = await requirePool().query(
    `SELECT a.event_type, a.details, a.created_at, c.tx_hash, c.block_number, c.log_index
     FROM audit_events a
     LEFT JOIN chain_transactions c
       ON c.agreement_id = a.agreement_id AND c.tx_hash = a.details->>'txHash'
     WHERE a.agreement_id = $1
     UNION ALL
     SELECT 'chain_' || c.kind AS event_type,
       jsonb_build_object('txHash', c.tx_hash) AS details,
       c.created_at, c.tx_hash, c.block_number, c.log_index
     FROM chain_transactions c
     WHERE c.agreement_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM audit_events a
         WHERE a.agreement_id = c.agreement_id AND a.details->>'txHash' = c.tx_hash
       )
     ORDER BY created_at ASC`,
    [agreement.id],
  );
  response.json({ events: events.rows });
});

app.use("/api", (_request, _response, next) => next(httpError(404, "API route not found.")));

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(root, "dist")));
  app.get(/.*/, (_request, response) => response.sendFile(path.join(root, "dist", "index.html")));
}

app.use((error, _request, response, _next) => {
  if (response.headersSent) return;
  const status = Number(error.status) || 500;
  if (status >= 500) console.error(error);
  response.status(status).json({ error: status === 500 ? "Unexpected server error." : error.message });
});

const server = app.listen(port, process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1", () => {
  console.log(`Lay-by API listening on http://127.0.0.1:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(async () => {
    await pool?.end();
    process.exit(0);
  }));
}
