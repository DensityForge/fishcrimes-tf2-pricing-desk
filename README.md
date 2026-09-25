# Fishcrimes TF2 Pricing System

This is a local page for pricing one Team Fortress 2 item at a time. You type the sales. The page does the arithmetic.

The pricing method is fishcrimes'. YouTube: https://www.youtube.com/@fishcrimes. Discord: @fishcrimes (Fishcrimes#1509).

The desk was built by donkeybrains. Contact: densityforge@gmail.com.

The code and the notes in this folder are [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). Credit fishcrimes for the method and donkeybrains for the desk if you share a copy. See `LICENSE` and `NOTICE.md`.

## Run it

You need Node 22 or newer. Nothing else to install.

Unzip this folder, open a terminal inside it, and run:

```text
node desk/server.mjs
```

The process prints an address like `http://127.0.0.1:6217`. Open that address in a browser on the same computer. The page does not listen on the network. Ctrl+C stops it.

Save writes `items/<slug>.sales.json` next to the `desk` folder. The slug is lowercase letters, digits, and hyphens. Delete asks once. Leaving an item you have changed asks once.

The name box can suggest items from a backpack.tf catalogue file named `catalogue_bptf_EVERY_SINGLE_ITEM.json`. Put that file next to `desk`, or set `FISHCRIMES_CATALOGUE` to its path. Without it, the page still runs and you type the name yourself. A suggestion that ends with an effect fills the name, the effect, and Unusual.

This copy prices the sales you type. It does not download backpack.tf histories.

A hosted page of the same arithmetic is at https://bunker.tf/pricing-test/. That page can search backpack.tf for copies and owner history. This downloadable pack does not include that search.

## The same number from the command line

```text
node price-construct.mjs --file sample.sales.json
```

The sample sheet has three lines:

- a pure key sale at 3.54 keys
- a cash sale of 8 dollars on a day when a key cost 2 dollars, which is 4 keys
- a marketplace row of 20 dollars that did not sell, so it is dropped

The two real sales are a range. The page shows **3.54–4** in large type. The median, 3.77, sits on the line under it.

| Field | Value |
|--|--|
| keys | 3.77 |
| low | 3.54 |
| high | 4 |
| rounded | 3.77 |
| dropped | the marketplace row, because it was a listing and not a sale |
| scan | OK |

Change the pure sale from 3.54 keys to 3 and run the file again. Keys, low, and rounded become 3.5, 3, and 3.5. The high stays 4. The marketplace row is still dropped.

```text
node price-construct.mjs --scan --file sample.sales.json
```

prints the scan word and the flags behind it. `--send` and `--write` are refused. This tool does not post a backpack.tf suggestion and does not write a result file.

A sheet you saved from the page uses the same command:

```text
node price-construct.mjs --file items/abstract.sales.json
```

The page and the command must agree on keys, low, high, rounded, what was dropped, and the scan word.
