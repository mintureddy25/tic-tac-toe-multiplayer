# Tic Tac Toe - Online Multiplayer

A real-time multiplayer Tic-Tac-Toe game with server-authoritative architecture, built with React and Nakama game server.

## Screenshots

| Login | Matchmaking | Gameplay |
|-------|-------------|----------|
| ![Login](screenshots/login.png) | ![Matchmaking](screenshots/matchmaking.png) | ![Gameplay](screenshots/gameplay.png) |

| Game Over | Leaderboard |
|-----------|-------------|
| ![Game Over](screenshots/gameover.png) | ![Leaderboard](screenshots/leaderboard.png) |

## Architecture

```
┌─────────────────┐       WebSocket        ┌──────────────────┐       ┌──────────────┐
│  React Client   │ ◄───────────────────► │  Nakama Server   │ ◄───► │  PostgreSQL  │
│  (TypeScript)   │      Port 7350        │  (TypeScript RT) │       │  (Storage)   │
└─────────────────┘                       └──────────────────┘       └──────────────┘
```

### Server-Authoritative Design

All game logic runs on the Nakama server. The client only sends move requests — the server validates every move, manages game state, detects wins/draws, and broadcasts results to both players. This prevents any form of client-side cheating or state manipulation.

### How Matchmaking Works

- **Random Match**: Server finds an open match with one player waiting, or creates a new one. Players are paired automatically.
- **Private Room**: Player creates a room and gets a code. The friend enters the code to join. Private room games are **unranked** — they don't affect the global leaderboard (prevents score manipulation between friends).

### Scoring System

| Outcome | Points |
|---------|--------|
| Win in 5 moves | +50 |
| Win in 6 moves | +45 |
| Win in 7 moves | +40 |
| Win in 8 moves | +35 |
| Win in 9 moves | +30 |
| Forfeit/Timeout win | +25 |
| Draw | +20 each |
| Loss | -20 (min 0) |

Faster wins are rewarded with more points. Scores are stored in Nakama Storage (source of truth) and synced to the leaderboard for ranking.

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Nakama 3.21.1 (TypeScript runtime)
- **Database**: PostgreSQL 12.2
- **Fonts**: Syne (UI) + Space Mono (scores/data)
- **Build**: Rollup (backend), Create React App (frontend)
- **Infrastructure**: Docker & Docker Compose

## Getting Started

### Prerequisites

- Node.js 16+
- Docker & Docker Compose

### Environment Setup

Both backend and frontend use `.env` files for configuration. These are **gitignored** — only `.env.example` templates are in the repo.

**Backend:**
```bash
cd backend
cp .env.example .env
```

Contains database and Nakama console credentials:
```env
POSTGRES_DB=nakama
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password
NAKAMA_CONSOLE_USERNAME=admin
NAKAMA_CONSOLE_PASSWORD=your_secure_password
```

**Frontend:**
```bash
cd frontend
cp .env.example .env
```

Contains Nakama server connection config:
```env
REACT_APP_NAKAMA_HOST=localhost
REACT_APP_NAKAMA_PORT=7350
REACT_APP_NAKAMA_SSL=false
```

For production, update `REACT_APP_NAKAMA_HOST` to your deployed server address and set `REACT_APP_NAKAMA_SSL=true`.

### Run Locally

**1. Start the backend:**

```bash
cd backend
cp .env.example .env
npm install
npm run build
docker compose up -d
```

Wait ~15 seconds for Nakama to initialize. Verify with `curl http://localhost:7350/healthcheck`.

**2. Start the frontend:**

```bash
cd frontend
cp .env.example .env
npm install
npm start
```

**3. Play:**

Open `http://localhost:3000` in two browser tabs. Enter different names, click "Find Match" in both, and play.

## Deployment

### Live URLs

| Service | URL |
|---------|-----|
| **Game (Frontend)** | Hosted on Vercel |
| **Nakama API** | `https://nakamaapi.saitejareddy.online` |
| **Admin Console** | `https://nakama.saitejareddy.online` |

### Cloud Deployment Guide (AWS EC2)

This is a step-by-step guide to deploy the full stack on an AWS EC2 instance.

#### 1. Provision an EC2 Instance

- **AMI**: Amazon Linux 2023
- **Instance type**: t2.micro or t3.small (minimum 1 vCPU, 1GB RAM)
- **Security Group inbound rules**:
  - SSH (22) — your IP
  - HTTP (80) — anywhere
  - HTTPS (443) — anywhere
  - Custom TCP (7350) — anywhere (Nakama API, optional if using nginx proxy)
  - Custom TCP (7351) — anywhere (Admin console, optional if using nginx proxy)
- **Key pair**: Download `.pem` file for SSH access

#### 2. SSH into the Server

```bash
ssh -i "your-key.pem" ec2-user@your-ec2-public-ip
```

#### 3. Install Required Software

```bash
# Update system
sudo yum update -y

# Install Node.js
sudo yum install -y nodejs npm

# Install Docker
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Nginx
sudo yum install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Install Certbot (for SSL)
sudo yum install -y certbot python3-certbot-nginx

# Install PM2 (optional, for process management)
sudo npm install -g pm2

# Apply docker group (re-login or use sg)
newgrp docker
```

#### 4. Clone and Build

```bash
cd ~
git clone https://github.com/mintureddy25/tic-tac-toe-multiplayer.git
cd tic-tac-toe-multiplayer/backend

# Set up environment
cp .env.example .env
# Edit .env with secure passwords for production
nano .env

# Install dependencies and build
npm install
npm run build

# Start Nakama + PostgreSQL
docker-compose up -d
```

Wait ~15 seconds, then verify:

```bash
curl http://localhost:7350/healthcheck
# Should return: {}
```

#### 5. Domain Configuration

Add DNS A records pointing to your EC2 public IP:

| Type | Host | Value |
|------|------|-------|
| A Record | `nakamaapi` | `your-ec2-ip` |
| A Record | `nakama` | `your-ec2-ip` |

Wait for DNS propagation (1-5 minutes). Verify:

```bash
nslookup nakamaapi.yourdomain.com
nslookup nakama.yourdomain.com
```

#### 6. Nginx Configuration

Create the nginx config file:

```bash
sudo nano /etc/nginx/conf.d/nakama.conf
```

Add the following configuration:

```nginx
# Nakama Game API + WebSocket
server {
    server_name nakamaapi.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:7350;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    listen 80;
}

# Nakama Admin Console
server {
    server_name nakama.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:7351;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 80;
}
```

Test and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

#### 7. SSL Certificates (Let's Encrypt)

```bash
# API domain
sudo certbot --nginx -d nakamaapi.yourdomain.com \
  --non-interactive --agree-tos --email your-email@example.com

# Admin console domain
sudo certbot --nginx -d nakama.yourdomain.com \
  --non-interactive --agree-tos --email your-email@example.com
```

Certbot automatically updates the nginx config with SSL settings and sets up auto-renewal.

Verify HTTPS works:

```bash
curl https://nakamaapi.yourdomain.com/healthcheck
# Should return: {}
```

#### 8. Frontend Deployment (Vercel)

1. Push the repo to GitHub
2. Go to [vercel.com](https://vercel.com), import the repository
3. Set the root directory to `frontend`
4. Add environment variables in Vercel dashboard:

   ```
   REACT_APP_NAKAMA_HOST=nakamaapi.yourdomain.com
   REACT_APP_NAKAMA_PORT=443
   REACT_APP_NAKAMA_SSL=true
   ```

5. Deploy — Vercel builds and hosts the frontend automatically

#### 9. Verify Deployment

- **Frontend**: Open your Vercel URL in two browser tabs
- **API**: `curl https://nakamaapi.yourdomain.com/healthcheck`
- **Admin**: Open `https://nakama.yourdomain.com` in browser (login with credentials from `.env`)

## API Reference

### RPCs (via WebSocket)

| RPC | Payload | Description |
|-----|---------|-------------|
| `find_match` | `{ mode }` | Find or create a ranked match |
| `create_match` | `{ mode }` | Create a private unranked room |
| `get_leaderboard` | `{}` | Top 20 player rankings |
| `get_online_count` | `{}` | Current online player count |
| `health_check` | `{}` | Server health status |

### Match Communication (OpCodes)

| Code | Direction | Purpose |
|------|-----------|---------|
| 1 | Client → Server | Send move `{ position: 0-8 }` |
| 2 | Server → Client | Game state update |
| 3 | Server → Client | Game over (winner, reason, points) |
| 4 | Server → Client | Move rejected (reason) |

### Data Storage

| Collection | Key | Description |
|------------|-----|-------------|
| `player_stats` | `scores` | W/L/D, streak, total score per user |
| `match_history` | `{matchId}` | Game result, board state, opponent |
| `system` | `online_users` | Active player heartbeats |

## Admin Console

| Environment | URL |
|-------------|-----|
| **Local** | `http://localhost:7351` |
| **Production** | `https://nakama.saitejareddy.online` |

Login credentials are configured in `backend/.env` (`NAKAMA_CONSOLE_USERNAME` and `NAKAMA_CONSOLE_PASSWORD`).

The console provides access to accounts, storage data, leaderboard records, active matches, and server logs.

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── main.ts              # Module entry, registers RPCs & match handler
│   │   ├── match_handler.ts     # Game logic, move validation, scoring
│   │   ├── matchmaking.ts       # Match finding & room creation
│   │   ├── leaderboard.ts       # Leaderboard initialization & queries
│   │   └── rpc.ts               # Health check, online count
│   ├── types/                   # Nakama runtime type definitions
│   ├── docker-compose.yml       # Nakama + PostgreSQL (uses .env)
│   ├── .env.example             # Backend environment template
│   ├── local.yml                # Nakama runtime config
│   ├── rollup.config.js         # TypeScript → JS bundler
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── LoginScreen.tsx        # Player name entry + top players
│   │   │   ├── MatchmakingScreen.tsx  # Random/Join/Create match tabs
│   │   │   ├── GameBoard.tsx          # Live game with board & timer
│   │   │   ├── GameOverScreen.tsx     # Results, points, leaderboard
│   │   │   └── LeaderboardPage.tsx    # Full leaderboard view
│   │   ├── nakama.ts            # Nakama WebSocket client
│   │   ├── App.tsx              # Router & screen management
│   │   └── App.css              # Animations
│   ├── .env.example             # Frontend environment template
│   ├── public/index.html
│   ├── tailwind.config.js
│   └── package.json
└── README.md
```
