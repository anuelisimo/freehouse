import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DRY_RUN = String(process.env.DRY_RUN ?? "true") === "true"
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : null

if (!SUPABASE_URL) throw new Error("Missing SUPABASE_URL")
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY")

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const rateCache = new Map()
let blueEvolutionRows = null

function normalizeDate(value) {
  return String(value).slice(0, 10)
}

function getMovementDate(movement) {
  return normalizeDate(
    movement.date ||
      movement.created_at ||
      movement.inserted_at ||
      new Date().toISOString()
  )
}

function getAmountARS(movement) {
  const amount = Number(movement.amount)
  if (!Number.isFinite(amount)) return null
  return amount
}

async function loadBlueEvolutionRows() {
  if (blueEvolutionRows) return blueEvolutionRows

  const res = await fetch("https://api.bluelytics.com.ar/v2/evolution.json")

  if (!res.ok) {
    throw new Error(`Bluelytics error: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()

  if (!Array.isArray(data)) {
    throw new Error("Bluelytics evolution response is not an array")
  }

  blueEvolutionRows = data
    .map((row) => {
      const date = row.date
      const source = row.source

      // Bluelytics puede venir en distintos formatos.
      // Soportamos ambos:
      // 1) { date, source: "Blue", value_avg }
      // 2) { date, blue: { value_avg } }
      const rate =
        Number(row.value_avg) ||
        Number(row.blue?.value_avg) ||
        null

      return {
        date,
        source,
        rate,
      }
    })
    .filter((row) => {
      const isBlue =
        String(row.source || "").toLowerCase().includes("blue") ||
        row.rate != null

      return row.date && row.rate && isBlue
    })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))

  if (blueEvolutionRows.length === 0) {
    console.log("Sample Bluelytics row:", JSON.stringify(data[0], null, 2))
    throw new Error("No blue dollar rows found in Bluelytics evolution response.")
  }

  console.log(`Bluelytics blue rows loaded: ${blueEvolutionRows.length}`)

  return blueEvolutionRows
}

async function getBlueRateByDate(date) {
  const key = normalizeDate(date)

  if (rateCache.has(key)) {
    return rateCache.get(key)
  }

  const rows = await loadBlueEvolutionRows()

  // Buscamos el valor exacto o el anterior más cercano.
  // Si el día no existe, usamos el último anterior disponible.
  let selected = null

  for (const row of rows) {
    const rowDate = normalizeDate(row.date)

    if (rowDate <= key) {
      selected = row
    } else {
      break
    }
  }

  // Si el movimiento es anterior al primer dato disponible,
  // usamos el primer dato disponible.
  if (!selected) {
    selected = rows[0]
  }

  if (!selected?.rate) {
    throw new Error(`No blue dollar rate found for ${key}`)
  }

  rateCache.set(key, selected.rate)

  return selected.rate
}

async function getMovementsToBackfill() {
  let query = supabase
    .from("movements")
    .select("*")
    .or("amount_usd.is.null,amount_ars.is.null,usd_exchange_rate.is.null")
    .order("date", { ascending: true })

  if (LIMIT && Number.isFinite(LIMIT)) {
    query = query.limit(LIMIT)
  }

  const { data, error } = await query

  if (error) throw error

  return data || []
}

async function updateMovement(movement, values) {
  if (DRY_RUN) return { error: null }

  return supabase
    .from("movements")
    .update(values)
    .eq("id", movement.id)
}

async function run() {
  console.log("Backfill historical USD started")
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no updates)" : "LIVE UPDATE"}`)
  console.log(`Limit: ${LIMIT || "all matching movements"}`)

  const movements = await getMovementsToBackfill()

  console.log(`Movements found: ${movements.length}`)

  let processed = 0
  let updatedOrPreviewed = 0
  let skipped = 0
  let failed = 0

  for (const movement of movements) {
    processed += 1

    try {
      const amountARS = getAmountARS(movement)

      if (!amountARS || amountARS === 0) {
        skipped += 1
        console.log(`SKIP ${movement.id}: invalid amount`)
        continue
      }

      const date = getMovementDate(movement)
      const rate = await getBlueRateByDate(date)
      const amountUSD = amountARS / rate

      const values = {
        currency: movement.currency || "ARS",
        amount_ars: amountARS,
        amount_usd: amountUSD,
        usd_exchange_rate: rate,
      }

      const { error } = await updateMovement(movement, values)

      if (error) throw error

      updatedOrPreviewed += 1

      console.log(
        `${DRY_RUN ? "PREVIEW" : "UPDATED"} ${movement.id}: ` +
          `${date} | ARS ${amountARS.toFixed(2)} | ` +
          `TC ${rate.toFixed(2)} | USD ${amountUSD.toFixed(2)}`
      )
    } catch (error) {
      failed += 1
      console.log(`FAIL ${movement.id}: ${error.message}`)
    }
  }

  console.log("Backfill finished")
  console.log({
    processed,
    updatedOrPreviewed,
    skipped,
    failed,
  })

  if (failed > 0) {
    process.exit(1)
  }
}

run()
