const mineflayer = require('mineflayer-protocol-774')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const http = require('http')
http.createServer((req, res) => res.end('Zay vivo')).listen(process.env.PORT || 3000)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

const config = {
  host: '23.230.3.155',
  port: 25501,
  username: 'tomastomashernandez202511@gmail.com',
  auth: 'microsoft',
  version: '1.21.11'
}

const SYSTEM_PROMPT =
  "Sos Zay, un pibe argentino menor de edad, re chill, que está en un servidor de Minecraft entre amigos. " +
  "Hablás relajado y argentino casual, usás 'we', 'dale', 'tranqui', 'joya', 're', 'piola', 'posta'. " +
  "Respondés cualquier pregunta de la vida como un amigo, corto y de onda. Máximo 2 oraciones. Nunca rompas el personaje."

// Prompt para interpretar intención de acción
const INTENT_PROMPT =
  "Sos el cerebro de Zay, un bot de Minecraft. Te paso un mensaje de un jugador. " +
  "Decidí qué quiere que haga Zay y respondé SOLO con una palabra de esta lista:\n" +
  "PERLA = quiere que tire/lance una perla de ender\n" +
  "BLOQUE = quiere que ponga/coloque un bloque o construya\n" +
  "CERCA = pregunta qué hay cerca, quién está cerca, qué ve\n" +
  "COMER = quiere que coma\n" +
  "TIRAR = quiere que tire/dropee el item de la mano\n" +
  "SEGUIR = quiere que lo siga\n" +
  "PARAR = quiere que pare de seguir / se quede quieto\n" +
  "CHAT = cualquier otra cosa (charla, preguntas, saludos)\n" +
  "Respondé SOLO la palabra, nada más."

let bot = null
let followTarget = null
let ready = false
const history = []

let chatQueue = []
let lastChat = 0
function sayChat(text) { chatQueue.push(text) }

function botReady() { return bot && ready && bot.entity && bot.entities }

function createBot() {
  bot = mineflayer.createBot(config)
  bot.loadPlugin(pathfinder)
  ready = false

  // Aceptar resource pack automáticamente (necesario en servers 1.21.11)
  bot.on('resourcePack', () => {
    try { bot.acceptResourcePack() } catch (e) {}
  })

  bot.once('spawn', () => {
    console.log('Zay conectado!')
    ready = true
    sayChat('ey we, Zay en línea 🤙')
    try {
      if (bot.pathfinder) {
        const m = new Movements(bot)
        m.allowSprinting = true
        m.allowParkour = true
        m.canDig = false
        bot.pathfinder.setMovements(m)
      }
    } catch (e) { console.log('Error movements:', e.message) }
    setTimeout(() => { if (botReady()) equipArmor() }, 3000)
  })

  bot.on('death', () => {
    console.log('Zay murió')
    sayChat('uh me morí we 💀 esperá que vuelvo')
    followTarget = null
  })

  bot.on('messagestr', async (message) => {
    if (!botReady()) return
    const msg = message.toLowerCase()
    if (!msg.includes('zay')) return
    if (bot.username && message.includes(bot.username)) return

    const sender = nearestPlayerName()
    const cleaned = message.replace(/.*?zay/i, '').trim()

    // Saludo rápido
    if (msg.includes('hola zay') || msg.includes('buenas zay') || msg.includes('ey zay')) {
      if (sender) sayChat(`hola ${sender}, todo piola? 🤙`)
      else sayChat('hola we!')
      return
    }

    if (!ANTHROPIC_API_KEY) return

    // Interpretar intención con IA
    const intent = await getIntent(cleaned)

    switch (intent) {
      case 'PERLA': throwPearl(); break
      case 'BLOQUE': placeBlock(); break
      case 'CERCA': tellNearby(); break
      case 'COMER': eatFood(); break
      case 'TIRAR': dropHand(); break
      case 'SEGUIR':
        if (sender) { followTarget = sender; sayChat(`dale ${sender}, te sigo we`) }
        break
      case 'PARAR':
        followTarget = null
        try { if (bot.pathfinder) bot.pathfinder.setGoal(null) } catch (e) {}
        sayChat('joya, me quedo acá')
        break
      default:
        const reply = await askClaude(cleaned)
        if (reply) sayChat(reply.slice(0, 250))
    }
  })

  bot.on('entityHurt', (entity) => {
    if (!botReady() || entity !== bot.entity) return
    const attacker = nearestPlayer()
    if (attacker) bot.lookAt(attacker.position.offset(0, attacker.height, 0)).catch(() => {})
  })

  bot.on('health', () => {
    if (botReady() && bot.food < 16) eatFood()
  })

  bot.on('playerCollect', (collector) => {
    if (botReady() && collector.username === bot.username) setTimeout(() => { if (botReady()) equipArmor() }, 1000)
  })

  bot.on('kicked', (reason) => { console.log('Kickeado:', JSON.stringify(reason)); ready = false; followTarget = null })
  bot.on('error', (err) => { console.log('Error:', err.message); ready = false })
  bot.on('end', () => {
    console.log('Desconectado, reconectando en 15s...')
    ready = false; followTarget = null; bot = null
    setTimeout(createBot, 15000)
  })
}

// ---- Loops ----

setInterval(() => {
  if (chatQueue.length === 0 || !botReady()) return
  const now = Date.now()
  if (now - lastChat < 2000) return
  const text = chatQueue.shift()
  try { bot.chat(text) } catch (e) {}
  lastChat = now
}, 600)

setInterval(() => {
  if (!botReady() || !followTarget) return
  const player = bot.players[followTarget]
  if (!player || !player.entity) return
  try { if (bot.pathfinder) bot.pathfinder.setGoal(new goals.GoalFollow(player.entity, 2), true) } catch (e) {}
}, 1000)

// Atacar mobs automático
setInterval(() => {
  if (!botReady()) return
  const mob = nearestHostile()
  if (mob) {
    bot.lookAt(mob.position.offset(0, mob.height, 0)).catch(() => {})
    try { bot.attack(mob) } catch (e) {}
  }
}, 800)

setInterval(() => {
  if (!botReady() || followTarget) return
  const player = nearestPlayer()
  if (player && Math.random() < 0.5) bot.lookAt(player.position.offset(0, player.height, 0)).catch(() => {})
}, 2000)

let greeted = {}
setInterval(() => {
  if (!botReady()) return
  const player = nearestPlayer()
  if (player) {
    if (!greeted[player.username]) {
      greeted[player.username] = true
      bot.lookAt(player.position.offset(0, player.height, 0)).catch(() => {})
      crouchGreet()
    }
  } else greeted = {}
}, 1500)

setInterval(() => {
  if (!botReady() || followTarget) return
  const r = Math.random()
  if (r < 0.45) {
    bot.setControlState('forward', true)
    setTimeout(() => { if (botReady()) bot.setControlState('forward', false) }, 600 + Math.random() * 1400)
  } else if (r < 0.7) {
    bot.look(Math.random() * Math.PI * 2, 0, true).catch(() => {})
  } else if (r < 0.85) {
    bot.setControlState('jump', true)
    setTimeout(() => { if (botReady()) bot.setControlState('jump', false) }, 200)
  } else {
    bot.setControlState('back', true)
    setTimeout(() => { if (botReady()) bot.setControlState('back', false) }, 500)
  }
}, 2500)

// ---- IA ----

async function getIntent(userMessage) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 10, system: INTENT_PROMPT, messages: [{ role: 'user', content: userMessage }] })
    })
    const data = await res.json()
    if (!data.content) return 'CHAT'
    return data.content[0].text.trim().toUpperCase()
  } catch (e) { return 'CHAT' }
}

async function askClaude(userMessage) {
  try {
    history.push({ role: 'user', content: userMessage })
    if (history.length > 10) history.splice(0, 2)
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 150, system: SYSTEM_PROMPT, messages: history })
    })
    const data = await res.json()
    if (!data.content) { console.log('Respuesta API:', JSON.stringify(data)); return null }
    const reply = data.content[0].text
    history.push({ role: 'assistant', content: reply })
    return reply
  } catch (e) { console.log('Error IA:', e.message); return null }
}

// ---- Acciones ----

function throwPearl() {
  if (!botReady()) return
  const pearl = bot.inventory.items().find(i => i.name.includes('ender_pearl'))
  if (!pearl) { sayChat('no tengo perlas we'); return }
  bot.equip(pearl, 'hand').then(() => {
    bot.look(bot.entity.yaw, -0.4, true).then(() => {
      bot.activateItem()
      sayChat('ahí va la perla 🔮')
    }).catch(() => {})
  }).catch(() => {})
}

function placeBlock() {
  if (!botReady()) return
  const block = bot.inventory.items().find(i =>
    i.name.includes('stone') || i.name.includes('dirt') || i.name.includes('plank') ||
    i.name.includes('cobble') || i.name.includes('wool') || i.name.includes('concrete')
  )
  if (!block) { sayChat('no tengo bloques para poner we'); return }
  const ref = bot.blockAt(bot.entity.position.offset(0, -1, 0))
  if (!ref) { sayChat('no encuentro dónde poner'); return }
  bot.equip(block, 'hand').then(() => {
    bot.placeBlock(ref, { x: 0, y: 1, z: 0 }).then(() => sayChat('listo, bloque puesto 🧱')).catch(() => sayChat('no pude poner el bloque acá'))
  }).catch(() => {})
}

function tellNearby() {
  if (!botReady()) return
  const players = [], mobs = []
  for (const e of Object.values(bot.entities)) {
    if (!e || !e.position) continue
    const d = bot.entity.position.distanceTo(e.position)
    if (d > 16) continue
    if (e.type === 'player' && e.username !== bot.username) players.push(e.username)
    else if (e.type === 'mob' && e.name) mobs.push(e.name)
  }
  let parts = []
  if (players.length) parts.push(`jugadores: ${players.join(', ')}`)
  if (mobs.length) parts.push(`mobs: ${mobs.slice(0, 5).join(', ')}`)
  sayChat(parts.length ? `tengo cerca → ${parts.join(' | ')}` : 'no hay nada cerca we, todo tranqui')
}

function crouchGreet() {
  let count = 0
  const interval = setInterval(() => {
    if (!botReady()) { clearInterval(interval); return }
    bot.setControlState('sneak', count % 2 === 0)
    count++
    if (count >= 4) { clearInterval(interval); bot.setControlState('sneak', false) }
  }, 200)
}

function nearestPlayerName() {
  const e = nearestPlayer(16)
  return e ? e.username : null
}

function nearestPlayer(maxDist) {
  if (!botReady()) return null
  let nearest = null, dist = maxDist || 8
  for (const e of Object.values(bot.entities)) {
    if (e && e.type === 'player' && e.username !== bot.username) {
      const d = bot.entity.position.distanceTo(e.position)
      if (d < dist) { dist = d; nearest = e }
    }
  }
  return nearest
}

function nearestHostile() {
  if (!botReady()) return null
  const hostiles = ['zombie', 'skeleton', 'spider', 'creeper', 'witch', 'enderman', 'husk', 'stray', 'drowned', 'pillager', 'zombified_piglin', 'cave_spider', 'silverfish', 'slime', 'phantom', 'vindicator']
  let nearest = null, dist = 5
  for (const e of Object.values(bot.entities)) {
    if (e && e.type === 'mob' && e.name && hostiles.includes(e.name.toLowerCase())) {
      const d = bot.entity.position.distanceTo(e.position)
      if (d < dist) { dist = d; nearest = e }
    }
  }
  return nearest
}

function eatFood() {
  if (!botReady()) return
  const foodItems = bot.inventory.items().filter(item =>
    ['bread','cooked','apple','carrot','potato','beef','pork','chicken','mutton','rabbit','salmon','cod','melon'].some(f => item.name.includes(f))
  )
  if (foodItems.length > 0) {
    bot.equip(foodItems[0], 'hand').then(() => bot.consume().catch(() => {})).catch(() => {})
  } else sayChat('no tengo nada para comer we')
}

function dropHand() {
  if (!botReady()) return
  const item = bot.heldItem
  if (item) { bot.tossStack(item).catch(() => {}); sayChat('ahí lo tiré') }
  else sayChat('no tengo nada en la mano')
}

function equipArmor() {
  if (!botReady()) return
  const slots = { head: 'helmet', torso: 'chestplate', legs: 'leggings', feet: 'boots' }
  const tiers = ['netherite', 'diamond', 'iron', 'golden', 'chainmail', 'leather']
  for (const [dest, type] of Object.entries(slots)) {
    let best = null, bestTier = 999
    for (const item of bot.inventory.items()) {
      if (item.name.includes(type)) {
        const tier = tiers.findIndex(t => item.name.includes(t))
        if (tier !== -1 && tier < bestTier) { best = item; bestTier = tier }
      }
    }
    if (best) bot.equip(best, dest).catch(() => {})
  }
}

createBot()
