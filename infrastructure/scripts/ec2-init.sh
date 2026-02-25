#!/bin/bash
# =============================================================================
# EC2 Initial Setup Script (run once after terraform apply)
# Usage: Copy this script to EC2 and run it
# =============================================================================
set -e

echo "🚀 AI Agent EC2 Initial Setup"
echo "=============================="

# --- 1. Install system dependencies ---
echo "📦 Installing system dependencies..."
sudo apt-get update -y
sudo apt-get install -y python3.12-venv python3-pip git

# --- 2. Clone repository ---
echo "📥 Cloning repository..."
cd /home/ubuntu
if [ -d "nba-games-with-friends" ]; then
    echo "  Repository already exists, pulling latest..."
    cd nba-games-with-friends && git pull
else
    git clone https://github.com/liuyang19900520/nba-games-with-friends.git
    cd nba-games-with-friends
fi

# --- 3. Setup Python virtual environment ---
echo "🐍 Setting up Python virtual environment..."
cd /home/ubuntu/nba-games-with-friends/services/ai-agent
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# --- 4. Create .env file (EDIT THIS!) ---
echo "📝 Creating .env template..."
if [ ! -f .env ]; then
    cat > .env << 'ENVEOF'
# ⚠️ EDIT THIS FILE with your actual keys!
N8N_HOST=57.182.161.64.nip.io
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=XlNWxvwSrZNYklyw
TIMEZONE=Asia/Tokyo
SUPABASE_URL=https://cihryhmlyihjvonkhrpp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_key_here
SUPABASE_ANON_KEY=your_key_here
LINE_CHANNEL_TOKEN=your_token_here
OPENAI_API_KEY=your_key_here
DEEPSEEK_API_KEY=your_key_here
LANGCHAIN_TRACING_V2=true
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com
LANGCHAIN_PROJECT=nba-agent-dev
LANGCHAIN_API_KEY=your_key_here
TAVILY_API_KEY=your_key_here
HUGGINGFACE_API_KEY=your_key_here
ENVEOF
    echo "  ⚠️  Please edit .env with your actual keys: nano .env"
else
    echo "  .env already exists, skipping..."
fi

# --- 5. Create systemd service ---
echo "⚙️  Creating systemd service..."
sudo tee /etc/systemd/system/ai-agent.service > /dev/null << 'SERVICEEOF'
[Unit]
Description=NBA AI Agent (FastAPI)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/nba-games-with-friends/services/ai-agent
Environment=PYTHONPATH=/home/ubuntu/nba-games-with-friends/services/ai-agent/src
EnvironmentFile=/home/ubuntu/nba-games-with-friends/services/ai-agent/.env
ExecStart=/home/ubuntu/nba-games-with-friends/services/ai-agent/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8000 --workers 1
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICEEOF

sudo systemctl daemon-reload
sudo systemctl enable ai-agent
sudo systemctl start ai-agent

# --- 6. Verify ---
echo ""
echo "✅ Setup complete!"
echo "=============================="
echo "Service status:"
sudo systemctl status ai-agent --no-pager
echo ""
echo "Useful commands:"
echo "  sudo systemctl status ai-agent    # Check status"
echo "  sudo systemctl restart ai-agent   # Restart"
echo "  sudo journalctl -u ai-agent -f    # View logs"
echo ""
echo "Test: curl http://localhost:8000/health"
