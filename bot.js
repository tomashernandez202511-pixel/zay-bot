const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')

const config = {
  host: '23.230.3.155',
  port: 25779,
  username: 'tomastomashernandez202511@outlook.de',
  password: 'Zuu28k98.',
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
  })

  bot.on('chat', (username, message) => {
    if (username === bot.username) return
    const msg = message.toLowerCase()

    // Seguir jugador
    if (msg.includes('zay seguime') || msg.includes('zay sígueme') || msg.includes('zay sigueme')) {
      const player = bot.players[username]
      if (player && player.entity) {
        followTarget = username
        bot.chat(`dale ${username}, te sigo we`)
      }
      return
    }

    // Dejar de seguir
    if (msg.includes('zay quedate') || msg.includes('zay para') || msg.includes('zay stop')) {
      followTarget = null
      bot.chat('joya, me quedo acá')
      return
    }

    // Venir acá
    if (msg.includes('zay ven') || msg.includes('zay venite') || msg.includes('zay veni')) {
      const player = bot.players[username]
      if (player && player.entity) {
        followTarget = username
        bot.chat(`ya voy we`)
      }
      return
    }
  })

  // Loop de seguimiento
  setInterval(() => {
    if (!followTarget) return
    const player = bot.players[followTarget]
    if (!player || !player.entity) return

    const { x, y, z } = player.entity.position
    const goal = new goals.GoalNear(x, y, z, 2)
    const movements = new Movements(bot)
    bot.pathfinder.setMovements(movements)
    bot.pathfinder.setGoal(goal, true)
  }, 1000)

  // Comer cuando tiene hambre
  bot.on('health', () => {
    if (bot.food < 16) {
      eatFood()
    }
  })

  // Equipar mejor armadura al spawnear
  bot.on('spawn', () => {
    setTimeout(equipArmor, 3000)
  })

  bot.on('playerCollect', (collector) => {
    if (collector.username === bot.username) {
      setTimeout(equipArmor, 1000)
    }
  })

  // Movimiento random para parecer vivo
  setInterval(() => {
    if (followTarget) return
    const r = Math.random()
    if (r < 0.3) {
      bot.setControlState('forward', true)
      setTimeout(() => bot.setControlState('forward', false), 800 + Math.random() * 1200)
    } else if (r < 0.5) {
      bot.look(Math.random() * Math.PI * 2, 0, true)
    } else if (r < 0.6) {
      bot.setControlState('jump', true)
      setTimeout(() => bot.setControlState('jump', false), 200)
    }
  }, 4000)

  bot.on('kicked', (reason) => {
    console.log('Kickeado:', reason)
    setTimeout(createBot, 5000)
  })

  bot.on('error', (err) => {
    console.log('Error:', err.message)
    setTimeout(createBot, 5000)
  })

  bot.on('end', () => {
    console.log('Desconectado, reconectando...')
    setTimeout(createBot, 5000)
  })
}

function eatFood() {
  const foodItems = bot.inventory.items().filter(item =>
    item.name.includes('bread') ||
    item.name.includes('cooked') ||
    item.name.includes('apple') ||
    item.name.includes('carrot') ||
    item.name.includes('potato') ||
    item.name.includes('beef') ||
    item.name.includes('pork') ||
    item.name.includes('chicken') ||
    item.name.includes('mutton') ||
    item.name.includes('rabbit') ||
    item.name.includes('salmon') ||
    item.name.includes('cod') ||
    item.name.includes('melon')
  )
  if (foodItems.length > 0) {
    bot.equip(foodItems[0], 'hand').then(() => {
      bot.consume().catch(() => {})
    }).catch(() => {})
  }
}

function equipArmor() {
  const armorSlots = {
    head: 'helmet',
    torso: 'chestplate',
    legs: 'leggings',
    feet: 'boots'
  }

  const armorOrder = ['netherite', 'diamond', 'iron', 'golden', 'chainmail', 'leather']

  for (const [dest, type] of Object.entries(armorSlots)) {
    let best = null
    let bestTier = 999

    for (const item of bot.inventory.items()) {
      if (item.name.includes(type)) {
        const tier = armorOrder.findIndex(t => item.name.includes(t))
        if (tier !== -1 && tier < bestTier) {
          best = item
          bestTier = tier
        }
      }
    }

    if (best) {
      bot.equip(best, dest).catch(() => {})
    }
  }
}

createBot()
