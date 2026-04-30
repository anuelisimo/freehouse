import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.env.DRY_RUN === "true"

const rateCache = new Map()
let historicalData = null

function normalizeDate(d) {
  return String(d).slice(0, 10)
}

async function loadHistorical() {
  if (historicalData) return historicalData

  const res = await fetch("https://api.bluelytics.com.ar/v2/historical.json")
  const data = await res.json()

  historicalData = data
    .map((d) => ({
      date: normalizeDate(d.date),
      rate: d.blue?.value_avg
    }))
    .filter((d) => d.rate)
    .sort((a, b) => a.date.localeCompare(b.date))

  console.log("Historical rows:", historicalData.length)

  return historicalData
}

async function getRate(date) {
  const key = normalizeDate(date)

  if (rateCache.has(key)) return rateCache.get(key)

  const rows = await loadHistorical()

  let selected = null

  for (const r of rows) {
    if (r.date <= key) {
      selected = r
    } else {
      break
    }
  }

  if (!selected) {
    selected = rows[0]
  }

  rateCache.set(key, selected.rate)
  return selected.rate
}

async function run() {
  console.log("Backfill historical USD started")
  console.log("Mode:", DRY_RUN ? "DRY RUN" : "LIVE")

  const { data: movements, error } = await supabase
    .from("movements")
    .select("*")
    .is("amount_usd", null)

  if (error) throw error

  console.log("Movements found:", movements.length)

  let ok = 0
  let fail = 0

  for (const m of movements) {
    try {
      const date = m.date || m.created_at
      const rate = await getRate(date)

      const ars = Number(m.amount)
      const usd = ars / rate

      if (!DRY_RUN) {
        await supabase
          .from("movements")
          .update({
            currency: "ARS",
            amount_ars: ars,
            amount_usd: usd,
            usd_exchange_rate: rate
          })
          .eq("id", m.id)
      }

      console.log(
        `OK ${m.id} → ARS ${ars} | USD ${usd.toFixed(2)} | TC ${rate}`
      )

      ok++
    } catch (e) {
      console.log("FAIL", m.id, e.message)
      fail++
    }
  }

  console.log("DONE", { ok, fail })
}

run()
