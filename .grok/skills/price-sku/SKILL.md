---
name: price-sku
description: >
  Fishcrimes price check for one TF2 item. Use when the user names a hat,
  says price check, what is it worth, SKU, or /price-sku. Search the premium
  list, read each copy's history, then hand the dated rows to backpack-shift
  for validation. The backpack.tf book is not a price. Not a buy.
---

# Price a SKU

The user named one item. Search it, then have the dated rows checked. A missing tape starts the walk. It is not a reason to stop, and it is not a reason to quote backpack.tf.

## 1. Name it

One identity: name, quality, and effect. An unusual missing the name or the effect is a hold. Ask. Do not guess an effect. A different effect is a different price.

## 2. Search the premium list

Open the premium search for that name, quality, and effect, and read every page. A card counts only when it has a real item number. A blank number is not an id. 440 is the game id, not a hat. One owner, or the same Steam id twice, is a dead copy. Take the next one.

When the premium list has no item numbers, use a stats sell card or a suggestion `/item/` link. Do not open the pricelist. Do not treat a listing, a buy order, or the suggested price as a sale.

## 3. Read each copy

Open the item page for each moving copy, up to 80. The newest owner is listed first. The same Steam id twice is a rescan. A last-seen gap inside seven days can still be one trade, because snapshots often fill days later. A gap longer than a week stays undated. A span of about fifty days is the search window, not one sale.

Keep opening copies until five validated pure key sales inside 90 days are on the sheet, or the list ends. Checking those rows is `/backpack-shift`. This pack does not contain the bag walker.

## 4. Decide what each checked line was

You classify. The constructor only adds.

A `trade pure` line is a key sale. The key count is the sale. The date is the buyer snapshot day. `partial floor` stays on the sheet, and the report says the count may be low.

These are not the key price. Name them and leave them out of `sales`:

- `trade trade` is an item trade.
- `trade mixed` is keys and other items on one step.
- `trade hat` is the hat with no payment.
- A listing, a buy order, and the backpack.tf suggested number never go on the sheet.

A sale counts for 90 days. The constructor drops older rows. Say when it did.

## 5. Run the arithmetic

From this folder, once the sales sheet exists:

```text
node price-construct.mjs --file items/<slug>.sales.json
```

The slug is the name and effect, lowercase and hyphenated. Do not pass `--send`.

## 6. Say the number

Say the item. Then keys, low, high, and rounded. One kept sale is that number. Two that disagree are a range. Then name the rows you left out, and which key counts are floors.

No pure sale inside 90 days means there is no number. Say that. Do not fill the hole with the backpack.tf book, a listing, or a buy order.

This seat does not buy, post a listing, or send a trade.
