// ==UserScript==
// @name         Steam Auto Outbid 0.05% (compare myPrice vs highestPrice)
// @match        https://steamcommunity.com/market/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(async function () {
  "use strict";

  const INITIAL_WAIT_MS = 60_000;
  const BETWEEN_CLICKS_MS = 900;
  const BETWEEN_ROWS_DELAY_MS = 2_000;       // <<< NOVO
  const AFTER_LAST_OUTBID_DELAY_MS = 240_000;
  const RELOAD_DELAY_MS_NO_CLICKS = 1500;
  const MAX_CLICKS_PER_LOOP = 50;
  const ROW_Y_TOLERANCE_PX = 20;

  const SELECTORS = {
    orderRow: 'div[id^="mybuyorder_"].market_listing_row',
    highestPriceAny: 'div.highestOrderPrice',
    highestPriceNotHighest: 'div.highestOrderPrice.not_highest',
    myPriceCell: 'div.market_listing_my_price',
    buttonCandidates: 'button'
  };

  const log = (...a) => console.log("[AutoOutbid]", ...a);

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function parseBRL(text) {
    if (!text) return NaN;
    return Number(
      text.replace(/\s/g, "")
          .replace("R$", "")
          .replace(/\./g, "")
          .replace(",", ".")
    );
  }

  function firstBRLFromText(text) {
    const m = text?.match(/R\$\s*[\d.]+,\d{2}/);
    return m ? parseBRL(m[0]) : NaN;
  }

  function clickStrong(el) {
    el.scrollIntoView({ block: "center" });
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }

  function getMyPrice(row) {
    const cell = row.querySelector(SELECTORS.myPriceCell);
    if (!cell) return NaN;

    const clone = cell.cloneNode(true);
    clone.querySelectorAll(SELECTORS.highestPriceAny).forEach(n => n.remove());
    return firstBRLFromText(clone.textContent);
  }

  function getHighestPrice(row) {
    const el = row.querySelector(SELECTORS.highestPriceAny);
    return el ? firstBRLFromText(el.textContent) : NaN;
  }

  function needsOutbid(row) {
    if (!row.querySelector(SELECTORS.highestPriceNotHighest)) return false;
    const myPrice = getMyPrice(row);
    const highest = getHighestPrice(row);
    return Number.isFinite(myPrice) && Number.isFinite(highest) && highest > myPrice;
  }

  function getOutbid005Buttons() {
    return [...document.querySelectorAll(SELECTORS.buttonCandidates)]
      .filter(b => b.textContent.trim().toLowerCase() === "outbid by 0.05%");
  }

  function findOutbidButtonInSameRowBand(row, buttons) {
    const rr = row.getBoundingClientRect();
    const sameBand = buttons.filter(b => {
      const br = b.getBoundingClientRect();
      return br.top >= rr.top - ROW_Y_TOLERANCE_PX &&
             br.top <= rr.bottom + ROW_Y_TOLERANCE_PX;
    });

    sameBand.sort((a, b) =>
      b.getBoundingClientRect().left - a.getBoundingClientRect().left
    );

    return sameBand[0] || null;
  }

  log("started:", location.href);
  await sleep(INITIAL_WAIT_MS);

  const rows = [...document.querySelectorAll(SELECTORS.orderRow)];
  let clicks = 0;

  for (const row of rows) {
    if (clicks >= MAX_CLICKS_PER_LOOP) break;

    if (needsOutbid(row)) {
      const buttons = getOutbid005Buttons();
      const btn = findOutbidButtonInSameRowBand(row, buttons);

      if (btn) {
        clickStrong(btn);
        clicks++;
        await sleep(BETWEEN_CLICKS_MS);
      }
    }

    // <<< delay SEMPRE entre linhas
    await sleep(BETWEEN_ROWS_DELAY_MS);
  }

  if (clicks > 0) {
    await sleep(AFTER_LAST_OUTBID_DELAY_MS);
  } else {
    await sleep(RELOAD_DELAY_MS_NO_CLICKS);
  }

  location.reload();
})();
