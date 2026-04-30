import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.env.DRY_RUN === "true"

// 🔥 VALOR YTD FIJO (ajustable)
const USD_RATE = 1350

async function run() {
  console.log("Backfill USD (YTD average)")
  console.log("Mode:", DRY_RUN ? "DRY RUN" : "LIVE")
  console.log("Using rate:", USD_RATE)

  const { data: movements, error } = await supabase
    .from("movements")
    .select("*")
    .is("amount_usd", null)

  if (error) throw error

  console.log("Movements:", movements.length)

  let ok = 0
  let fail = 0

  for (const m of movements) {
    try {
      const ars = Number(m.amount)
      const usd = ars / USD_RATE

      if (!DRY_RUN) {
        await supabase
          .from("movements")
          .update({
            currency: "ARS",
            amount_ars: ars,
            amount_usd: usd,
            usd_exchange_rate: USD_RATE
          })
          .eq("id", m.id)
      }

      console.log(`OK ${m.id} → ${usd.toFixed(2)} USD`)
      ok++
    } catch (e) {
      console.log("FAIL", m.id)
      fail++
    }
  }

  console.log("DONE", { ok, fail })
}

run()
