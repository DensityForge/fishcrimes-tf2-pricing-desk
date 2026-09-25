---
name: backpack-shift
description: >
  Check the dated owner changes from a TF2 item search by pairing backpack.tf
  snapshot days. Record key sales and item-for-item trades. Use when
  classifying a history, pairing two backpacks, or the user says shift,
  validate, item-for-item, key sale, pairAcross, or /backpack-shift.
  Not a price. Not a buy. Not a swarm of agents.
---

# Backpack shift

This seat checks results. The search already named the copies and the owner changes inside seven days. You open the bags and say what actually crossed. A last-seen pair is not the sale until the hat id leaves one bag and arrives in the other.

One pass at a time. One browser tab. The tape is the output.

An identity is finished when every moving copy that the search kept has been checked, or five validated pure key sales inside 90 days are already on the sheet. A key sale on one id is a row on that tape. It does not close the other copies.

This pack does not contain the bag walker.

The summary line is the class. `trade pure` is a key sale. `trade trade` is an item trade. `trade mixed` is keys and items on one step. `trade hat` is the hat alone. Each later line is one crossed id: direction, original id, name, effect, defindex. Refined, reclaimed, and scrap are one count. Keys are `keys in` (buyer to seller) or `keys out` (with the hat). A `trade` line marked `partial floor` is confirmed and the key count is a floor. A `partial` line with no kind is one bag of a truncated page and is not a cross. `unknown` means the bag is truncated and the hat id is absent. `not_a_snapshot` means the two inventories are identical. `no_cross` means both bags were real and nothing paired. `unread` is a snapshot pair this run did not open.

## What you were given

The search row is a candidate when the two last-seen times are inside seven days. A 31-hour gap is still one candidate. A gap longer than a week was not dated. Do not throw a row out for being over 24 hours. Do not call a span of about fifty days one sale. That span is the stretch you search inside.

## Windows

Snapshot days are the seller compare dropdown only. Values are divisible by 86400. Walk consecutive pairs from the seller's last-seen through the snapshot that covers the buyer's last-seen. Keep the snapshot on the calendar day before the seller's last-seen. When the archive is daily, the first pair is often empty and the next pair is the trade.

Open the buyer on that same unix. The buyer's dropdown can omit the day and the compare still renders.

The next snapshot is the next archived day. That gap can be days, because the archive skips days. A page that says the two inventories are identical is a bad window. Take the next seller pair.

On a long gap, the first and last snapshot are the bounds, not the sale. When the hop does not confirm, write each skipped pair as `unread` and leave those pairs closed.

## What crossed

An id counts when it leaves one bag and arrives in the other on that same unix pair. Record the direction. Payment moves buyer to seller. The hat moves seller to buyer.

| What left one bag and arrived in the other | Record |
|--|--|
| Key ids with the hat, no other item | Key sale (`pure`). The count is those ids, in either direction. |
| Other item ids with the hat, no keys | Item trade (`trade`). Name, original id, effect, defindex, direction. |
| Keys and other items, with the hat | One mixed row. |
| The hat alone | Hat move (`hat`). Keep the row. Check the next hop. |
| Ids that cross while the hat stays | Another trade on that snapshot. |
| One bag only | Noise. |

A removed count at or above 1024 means the tail is missing. The hat id still in the parsed rows is a partial cross. On a confirmed row that partial mark means the key count is a floor. The hat id absent from that bag is unknown.

## Done

Report each checked hop: seller, buyer, unix pair, class, key count, ids that crossed, partial floor, and unread pairs. A price from that tape is `/price-sku`. This seat does not edit the desk, restart it, commit, or launch a team of agents.
