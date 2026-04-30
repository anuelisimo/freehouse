import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN !== "false";
const LIMIT = Number(process.env.LIMIT || 0);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secrets.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function getMovementDate(movement) {
  const rawDate = movement.date || movement.created_at;
  if (!rawDate) return null;
  return String(rawDate).slice(0, 10);
}

function getRateForDate(evolution, isoDate) {
  // Bluelytics evolution usually returns rows like:
  // { date: "2024-01-01", source: "Blue", value_avg: 1000, ... }
  const blueRows = evolution
    .filter((row) => {
      const source = String(row.source || row.type || row.name || "").toLowerCase();
      return source.includes("blue") && row.value_avg;
    })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  if (blueRows.length === 0) {
    throw new Error("No blue dollar rows found in Bluelytics evolution response.");
  }

  let selected = null;
  for (const row of blueRows) {
    const rowDate = String(row.date).slice(0, 10);
    if (rowDate <= isoDate) selected = row;
    if (rowDate > isoDate) break;
  }

  // If the movement predates the first available row, use the earliest available rate.
  if (!selected) selected = blueRows[0];

  const rate = Number(selected.value_avg);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Invalid rate for ${isoDate}`);
  }

  return {
    rate,
    rateDate: String(selected.date).slice(0, 10),
  };
}

async function fetchBluelyticsEvolution() {
  const response = await fetch("https://api.bluelytics.com.ar/v2/evolution.json", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Bluelytics error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Unexpected Bluelytics response: expected an array.");
  }

  return data;
}

async function getMovementsToBackfill() {
  let query = supabase
    .from("movements")
    .select("id, amount, date, created_at, currency, amount_ars, amount_usd, usd_exchange_rate")
    .or("amount_usd.is.null,amount_ars.is.null,usd_exchange_rate.is.null")
    .order("date", { ascending: true, nullsFirst: false });

  if (LIMIT > 0) query = query.limit(LIMIT);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function run() {
  console.log("Backfill historical USD started");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no updates)" : "LIVE UPDATE"}`);
  console.log(`Limit: ${LIMIT > 0 ? LIMIT : "all matching movements"}`);

  const evolution = await fetchBluelyticsEvolution();
  const movements = await getMovementsToBackfill();

  console.log(`Movements found: ${movements.length}`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const movement of movements) {
    try {
      const amount = Number(movement.amount);
      const isoDate = getMovementDate(movement);

      if (!Number.isFinite(amount) || amount <= 0 || !isoDate) {
        skipped += 1;
        console.log(`SKIP ${movement.id}: invalid amount or date`);
        continue;
      }

      const { rate, rateDate } = getRateForDate(evolution, isoDate);
      const amountArs = amount;
      const amountUsd = amount / rate;

      const payload = {
        currency: "ARS",
        amount_ars: amountArs,
        amount_usd: amountUsd,
        usd_exchange_rate: rate,
      };

      console.log(
        `${DRY_RUN ? "PREVIEW" : "UPDATE"} ${movement.id}: ARS ${amountArs.toFixed(2)} / ${rate.toFixed(2)} (${rateDate}) = USD ${amountUsd.toFixed(2)}`
      );

      if (!DRY_RUN) {
        const { error } = await supabase
          .from("movements")
          .update(payload)
          .eq("id", movement.id);

        if (error) throw error;
      }

      updated += 1;
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${movement.id}:`, error.message || error);
    }
  }

  console.log("Backfill finished");
  console.log({ processed: movements.length, updatedOrPreviewed: updated, skipped, failed });

  if (failed > 0) process.exit(1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
