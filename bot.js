const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const http = require('http')
http.createServer((req, res) => res.end('Zay vivo')).listen(process.env.PORT || 3000)

const config = {
  host: '23.230.3.155',
  port: 25565,
  username: 'tomastomashernandez202511@outlook.de',
  auth: 'microsoft',
  version: '1.21.1'
}

let bot
let followTarget = null

function createBot() {
  bot = mineflayer.createBot(config)
  bot.loadPlugin(pathfinder)

  bot.on('spawn', () => {
    console.log('Zay conectado!')
    bot.chat('ey we, Zay en línea 🤙')
    setTimeout(equipArmor, 3000)
  })

  bot.on('chat', (username, message) => {
    if (username === bot.username) return
    const msg = message.toLowerCase()

    if (msg.includes('zay seguime') || msg.includes('zay sígueme') || msg.includes('zay sigueme')) {
      const player = bot.players[username]
      if (player && player.entity) {
        followTarget = username
        bot.chat(`dale ${username}, te sigo we`)
      }
      return
    }

    if (msg.includes('zay quedate') || msg.includes('zay para') || msg.includes('zay stop')) {
      followTarget = null
      bot.pathfinder.setGoal(null)
      bot.chat('joya, me quedo acá')
      return
    }

    if (msg.includes('zay ven') || msg.includes('zay venite') || msg.includes('zay veni')) {
      const player = bot.players[username]
      if (player && player.entity) {
        followTarget = username
        bot.chat('ya voy we')
      }
      return
    }
  })

  // Mira al jugador que lo golpea
  bot.on('entityHurt', (entity) => {
    if (entity !== bot.entity) return
    const attacker = nearestPlayer()
    if (attacker) {
      bot.lookAt(attacker.position.offset(0, attacker.height, 0))
    }
  })

  // Loop de seguimiento
  setInterval(() => {
    if (!followTarget || !bot.entity) return
    const player = bot.players[followTarget]
    if (!player || !player.entity) return
    const { x, y, z } = player.entity.position
    const movements = new Movements(bot)
    bot.pathfinder.setMovements(movements)
    bot.pathfinder.setGoal(new goals.GoalNear(x, y, z, 2), true)
  }, 1000)

  // Mira al jugador más cercano de vez en cuando
  setInterval(() => {
    if (followTarget || !bot.entity) return
    const player = nearestPlayer()
    if (player && Math.random() < 0.5) {
      bot.lookAt(player.position.offset(0, player.height, 0))
    }
  }, 2000)

  // Saluda agachándose cuando alguien se acerca
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
    } else {
      greeted = {}
    }
  }, 1500)

  bot.on('health', () => {
    if (bot.food < 16) eatFood()
  })

  bot.on('playerCollect', (collector) => {
    if (collector.username === bot.username) setTimeout(equipArmor, 1000)
  })

  // Movimiento random (más activo)
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

  bot.on('kicked', (reason) => {
    console.log('Kickeado:', reason)
    followTarget = null
    setTimeout(createBot, 5000)
  })

  bot.on('error', (err) => {
    console.log('Error:', err.message)
    followTarget = null
    setTimeout(createBot, 5000)
  })

  bot.on('end', () => {
    console.log('Desconectado, reconectando...')
    followTarget = null
    setTimeout(createBot, 5000)
  })
}

function crouchGreet() {
  let count = 0
  const interval = setInterval(() => {
    if (!bot.entity) { clearInterval(interval); return }
    bot.setControlState('sneak', count % 2 === 0)
    count++
    if (count >= 4) {
      clearInterval(interval)
      bot.setControlState('sneak', false)
    }
  }, 200)
}

function nearestPlayer() {
  let nearest = null, dist = 8
  for (const e of Object.values(bot.entities)) {
    if (e.type === 'player' && e.username !== bot.username) {
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
