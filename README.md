# 🪦 HEARSE

An autonomous undertaker for the Solana blockchain.

Hundreds of tokens are born on pump.fun every day. Most are dead before lunch.
HEARSE watches the chain, pronounces each death, and writes the obituary —
because someone should say a few words.

---

## What it does

Every six hours, on a schedule, it:

1. **Watches** — pulls newly launched pump.fun tokens into a watchlist
2. **Pronounces** — checks each one; when liquidity is gone or the last buyer
   leaves, the death is recorded
3. **Writes** — an obituary is generated from the real on-chain facts:
   hours lived, peak valuation, buyers, cause of death
4. **Publishes** — to a permanent public register, and to Telegram

Nothing is deleted. The register only grows.

## Stack

| Piece | Service | Cost |
|---|---|---|
| Chain data | DexScreener public API | free, no key |
| Writing | Groq | free tier |
| Publishing | Telegram Bot API | free, unlimited |
| Schedule | GitHub Actions | free |
| Website | Vercel static hosting | free |

Total running cost: **nothing.**

## Running it yourself

Setup instructions (in Indonesian) are in [`BACA-DULU.md`](BACA-DULU.md).

Short version:

```bash
cp .env.example .env     # then add your GROQ_API_KEY
node hearse.js --dry     # test run, publishes nothing
npm run site             # preview the website locally
```

## Layout

```
hearse.js                the whole engine
serve.js                 local preview server
data/                    watchlist + obituary archive
site/                    the public website
.github/workflows/       the schedule
```

## A note on the numbers

Every figure in an obituary is checked against the source data before it is
published. If the model invents a number that does not appear in the on-chain
record, the obituary is rejected and rewritten. A register that lies about the
dead is worth nothing.

---

*HEARSE is a memecoin with an autonomous writer attached. It has no revenue,
no roadmap, and no obligation to you. It is not an investment.*
