# How a price is built

The method below is fishcrimes'. YouTube: https://www.youtube.com/@fishcrimes. Discord: @fishcrimes (Fishcrimes#1509).

The desk that runs it was built by donkeybrains (densityforge@gmail.com). Credit fishcrimes for the method and donkeybrains for the desk if you share it. The license is CC BY-NC 4.0. See `NOTICE.md`.

You read the item and decide what each history line was. The script only does the arithmetic. It does not download histories, and it does not post a suggestion. When someone types a suggestion on backpack.tf, that site's own rounding page is what backpack.tf uses. This desk does not submit one.

## The seven steps

1. **Name the item first.** Quality, effect, and the rest of the name are one price. A different effect is a different item. The run holds, and shows no number, when identity is null, when the identity says it is unknown or on hold or not known, or when the sheet is flagged `no_identity`. Leaving identity off the sheet does not hold. An empty name still produces a number. On this desk, an unusual with no name or no effect shows Hold and does not show a price.

2. **Do not price unbox week.** If the pricing day is before `unboxUntil`, the whole run refuses and no row is scored. A release, unbox, or event inside 30 days of the pricing day does the same. The only way out of that 30-day hold is to mark the item as no longer dropping. Checking "still dropping" does not force a hold by itself.

3. **Use sales that are in date.** A sale counts for 90 days. A strange unusual may be older. A row that only has one last-seen time is not a sale. Two last-seen times inside seven days can still be one trade, because the snapshot archive often fills days later. A gap longer than a week is not dated as that trade. A span of about fifty days is the stretch you search, not one sale. A sale dated before the item existed is out. A marketplace row that is simply old is out of the window. It is not treated as "never sold."

4. **Say what each line is. A listing is not a sale.** Keep a pure key sale, a cash sale, a marketplace sale that was marked sold, and a chain that ends in real amounts. Drop a listing, a withdrawn line, an unreadable bulk, a dupe, every other line from that same owner, an unboxer account, an untraceable line, a named outlier, and a bot dump that has no later check. A later check does not itself drop the row. It only stops the bot-dump drop. Dupes are judged across the whole sheet, so the order of the rows does not change who is tainted.

5. **Convert using the price on the sale day.** Dollars divide by that day's key price in dollars. Refined metal divides by that day's key price in refined. The dollar map is not the metal map. The pricing day is not a key price. If a row has dollars, dollars win over a key amount on that row. Nothing is rounded in this step. Buyer-paid is the default. Seller-net takes the fee off dollars on cash and marketplace rows only. The default fee is 10 percent. Refined metal is not fee-adjusted.

6. **Price a chain one piece at a time, then add.** Each leg is keys, or dollars, or refined, on its own. A leg with no amount is incomplete. The script does not guess a number for it. A chain nested inside a chain adds the same way.

7. **Round last.** Only the chosen point is rounded, and only when a number exists. If every kept line is a pure sale, a cash sale, or a sold marketplace row, and this is not a hat sale, the rounded figure is the point itself. Otherwise a hat sale rounds to the nearest 10. A point of 1000 or more rounds to the nearest 50. A point above 10 rounds to the nearest 1. Anything else rounds to the nearest 0.05.

## The number inside the range

Median is the default. Range ends is the low and the high averaged. The sales in between are ignored for that choice. Both numbers are shown whenever the run has a price. One kept sale is one print, and that print is the large figure. When the kept sales disagree, the large figure is the low and the high. The midpoint stays on the line under it, labeled median.

Two kept sales that disagree are a range. They are not a single final number.

## When to look harder

After the seven steps, a listing at or above 1.5 times the kept high is a reason to dig. It is not a new price. A buy order at or above the chosen point is the same kind of flag. The scan word is the strongest of dig, refuse, hold, and ok. The page shows that word.

A plain applied skin refuses only when the listing is above 2 keys and the book is empty, or the 90-day volume is an explicit zero. A missing volume does not refuse.

## What this pack does not do

No history download, no catalogue crawl, no browser session, no trade, and no site keys. The sheet is the input. The number is the output.
