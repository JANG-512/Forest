# 🌿 Forest Island

A browser-based 3D island life game built with **Three.js r128** — a fan-made homage to the life simulation genre.

**[▶ Play Now](https://jang-512.github.io/Forest)**

---

## ✨ Features

| Feature | Description |
|--------|-------------|
| 🌍 3D Isometric World | 48×48 tile island with day/night cycle & seasons |
| 🎣 Fishing & Bug Catching | Catch fish, bugs, and donate to the island museum |
| 🏡 Housing | Upgrade your home from a tent to a mansion |
| 🤝 Villager AI | NPCs with personality traits, memory, and learning dialogues |
| 📱 Mobile Support | Virtual joystick + touch buttons for full mobile play |
| 🌐 Multiplayer | Render WebSocket relay — visit friends' islands in real time |
| 🎵 Procedural BGM | Web Audio API synthesized music, no samples |

## 🎮 Controls

| Platform | Move | Interact | Camera |
|----------|------|----------|--------|
| **PC** | WASD / Arrow Keys | E | Q / [ ] |
| **Mobile** | Left joystick | E button | ◀ ▶ buttons |

## 🌍 Multiplayer

1. Click the **🌍 Multi** button in the toolbar
2. Host opens a server room
3. Share your **Island Code** with a friend
4. Friend enters your code → visits your island!

The GitHub Pages client expects a Render backend at:

```text
wss://poko-multiplayer-backend.onrender.com
```

See [backend/RENDER_DEPLOY.md](backend/RENDER_DEPLOY.md) to deploy the multiplayer server.

---

## ⚖️ Legal Disclaimer

This project is an **independent fan-made creation** and is **not affiliated with, endorsed by, or sponsored by Nintendo Co., Ltd.** in any way.

- All game mechanics, systems, and code are original implementations written from scratch
- The life-simulation genre gameplay (fishing, bug catching, island life) is a general game concept not owned by any single company
- Character designs are original generic animals
- No Nintendo assets, music, sound effects, or code are used

> *"Forest Island" is a parody/homage project created for educational and personal enjoyment purposes only. If you are a rights holder with concerns, please open an issue.*

## 🛠 Tech Stack

- [Three.js r128](https://threejs.org/) — 3D rendering
- FastAPI + WebSocket — multiplayer relay backend
- Web Audio API — procedural music & sound effects
- Vanilla JS / HTML5 Canvas — no framework, no build step

## 📦 Run Locally

```bash
npx serve .
# → open http://localhost:3000
```

---

Made with ❤️ as a fan tribute to the life-simulation genre.
