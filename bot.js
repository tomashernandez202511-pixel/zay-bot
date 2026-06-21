const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const http = require('http')
http.createServer((req, res) => res.end('Zay vivo')).listen(process.env.PORT || 3000)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

const config = {
  host: '23.230.3.155',
  port: 25501,
  username: 'tomastomashernandez202511@outlook.de',
  auth: 'microsoft',
  version: '1.21.11'
}

const SYSTEM_PROMPT =
  "Sos Zay, un pibe chill que está en un servidor de Minecraft entre amigos. " +
  "Hablás relajado y argentino casual, usás 'we', 'dale', 'tranqui', 'joya', 're', 'piola'. " +
  "Respondés corto, de onda, nunca te estresás. Respondés preguntas de la vida como un amigo. " +
  "Máximo 2 oraciones. Nunca rompas el personaje."

let bot
let followTarget = null
const history = []

function createBot() {
  bot = mineflayer.createBot(config)
  bot.loadPlugin(pathfinder)

  bot.on('spawn', () => {
    console.log('Zay conectado!')
    bot.chat('ey we, Zay en línea 🤙')
    const m = new Movements(bot)
    m.allowSprinting = true
    m.allowParkour = true
    m.canDig = false
    bot.pathfinder.setMovements(m)
    setTimeout(equipArmor, 3000)
  })

  bot.on('messagestr', async (message) => {
    const msg = message.toLowerCase()
    if (!msg.includes('zay')) return
    const sender = nearestPlayerName()

    // Comandos de movimiento
    if (msg.includes('seguime') || msg.includes('sigueme') || msg.includes('sígueme') || msg.includes('veni') || msg.includes('vení') || msg.includes('ven ')) {
      if (sender) {
        followTarget = sender
        bot.chat(`dale ${sender}, te sigo we`)
      }
      return
    }

    if (msg.includes('quedate') || msg.includes('para') || msg.includes('stop') || msg.includes('frena')) {
      followTarget = null
      bot.pathfinder.setGoal(null)
      bot.chat('joya, me quedo acá')
      return
    }

    // Cualquier otra cosa → responde con IA
    const cleaned = message.replace(/.*?zay/i, '').trim()
    if (cleaned.length > 0 && ANTHROPIC_API_KEY) {
      const reply = await askClaude(cleaned)
      if (reply) bot.chat(reply.slice(0, 250))
    }
  })

  // Mira al jugador que lo golpea
  bot.on('entityHurt', (entity) => {
    if (entity !== bot.entity) return
    const attacker = nearestPlayer()
    if (attacker) bot.lookAt(attacker.position.offset(0, attacker.height, 0))
  })

  // Loop de seguimiento
  setInterval(() => {
    if (!followTarget || !bot.entity) return
    const player = bot.players[followTarget]
    if (!player || !player.entity) return
    const { x, y, z } = player.entity.position
    bot.pathfinder.setGoal(new goals.GoalFollow(player.entity, 2), true)
  }, 1000)

  // Atacar mobs hostiles cercanos
  setInterval(() => {
    if (!bot.entity || followTarget) return
    const mob = nearestHostile()
    if (mob) {
      bot.lookAt(mob.position.offset(0, mob.height, 0))
      bot.attack(mob)
    }
  }, 1000)

  // Mira al jugador más cercano
  setInterval(() => {
    if (followTarget || !bot.entity) return
    const player = nearestPlayer()
    if (player && Math.random() < 0.5) bot.lookAt(player.position.offset(0, player.height, 0))
  }, 2000)

  // Saludo al acercarse
  let greeted = {}
  setInterval(() => {
    if (!bot.entity) return
    const player = nearestPlayer()
    if (player) {
      if (!greeted[player.username]) {
        greeted[player.username] = true
        bot.lookAt(player.position.offset(0, player.height, 0))
        crouchGreet()
      }
    } else greeted = {}
  }, 1500)

  bot.on('health', () => {
    if (bot.food < 16) eatFood()
  })

  bot.on('playerCollect', (collector) => {
    if (collector.username === bot.username) setTimeout(equipArmor, 1000)
  })

  // Movimiento random
  setInterval(() => {
    if (followTarget || !bot.entity) return
    const r = Math.random()
    if (r < 0.45) {
      bot.setControlState('forward', true)
      setTimeout(() => bot.setControlState('forward', false), 600 + Math.random() * 1400)
    } else if (r < 0.7) {
      bot.look(Math.random() * Math.PI * 2, 0, true).catch(() => {})
    } else if (r < 0.85) {
      bot.setControlState('jump', true)
      setTimeout(() => bot.setControlState('jump', false), 200)
    } else {
      bot.setControlState('back', true)
      setTimeout(() => bot.setControlState('back', false), 500)
    }
  }, 2500)

  bot.on('kicked', (reason) => { console.log('Kickeado:', reason); followTarget = null; setTimeout(createBot, 8000) })
  bot.on('error', (err) => { console.log('Error:', err.message); followTarget = null; setTimeout(createBot, 8000) })
  bot.on('end', () => { console.log('Desconectado, reconectando...'); followTarget = null; setTimeout(createBot, 8000) })
}

async function askClaude(userMessage) {
  try {
    history.push({ role: 'user', content: userMessage })
    if (history.length > 10) history.splice(0, 2)

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 150,
        system: SYSTEM_PROMPT,
        messages: history
      })
    })
    const data = await res.json()
    const reply = data.content[0].text
    history.push({ role: 'assistant', content: reply })
    return reply
  } catch (e) {
    console.log('Error IA:', e.message)
    return null
  }
}

function crouchGreet() {
  let count = 0
  const interval = setInterval(() => {
    if (!bot.entity) { clearInterval(interval); return }
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
  let nearest = null, dist = maxDist || 8
  for (const e of Object.values(bot.entities)) {
    if (e.type === 'player' && e.username !== bot.username) {
      const d = bot.entity.position.distanceTo(e.position)
      if (d < dist) { dist = d; nearest = e }
    }
  }
  return nearest
}

function nearestHostile() {
  const hostiles = ['zombie', 'skeleton', 'spider', 'creeper', 'witch', 'enderman', 'husk', 'stray', 'drowned', 'pillager', 'zombified_piglin']
  let nearest = null, dist = 4
  for (const e of Object.values(bot.entities)) {
    if (e.type === 'mob' && e.name && hostiles.includes(e.name.toLowerCase())) {
      const d = bot.entity.position.distanceTo(e.position)
      if (d < dist) { dist = d; nearest = e }
    }
  }
  return nearest
}

function eatFood() {
  const foodItems = bot.inventory.items().filter(item =>
    ['bread','cooked','apple','carrot','potato','beef','pork','chicken','mutton','rabbit','salmon','cod','melon'].some(f => item.name.includes(f))
  )
  if (foodItems.length > 0) {
    bot.equip(foodItems[0], 'hand').then(() => bot.consume().catch(() => {})).catch(() => {})
  }
}

function equipArmor() {
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

