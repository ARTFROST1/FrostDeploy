#!/usr/bin/env bash
set -euo pipefail

# ─── Colors & helpers ────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_ok()   { echo -e " ${GREEN}✅${NC} $1"; }
log_err()  { echo -e " ${RED}❌${NC} $1"; exit 1; }
log_warn() { echo -e " ${YELLOW}⚠️${NC}  $1"; }
log_info() { echo -e " ${CYAN}ℹ${NC}  $1"; }

# ─── Constants ───────────────────────────────────────────────────────────────
INSTALL_DIR="/opt/frostdeploy"
DATA_DIR="/var/lib/frostdeploy"
BACKUP_DIR="${DATA_DIR}/backups"
ENV_FILE="${INSTALL_DIR}/.env"
REPO_URL="https://github.com/artfrost/frostdeploy.git"
BRANCH="main"
SERVICE_NAME="frostdeploy"
FD_USER="frostdeploy"
FD_PORT=9000
NODE_MAJOR=22
CADDYFILE="/etc/caddy/Caddyfile"

# ─── Banner ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   FrostDeploy Installer v0.1         ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""

# ─── 1. Check root ───────────────────────────────────────────────────────────
if [[ $(id -u) -ne 0 ]]; then
  log_err "This script must be run as root: sudo bash install.sh"
fi
log_ok "Running as root"

# ─── 2. Check OS ─────────────────────────────────────────────────────────────
if [[ ! -f /etc/os-release ]]; then
  log_err "Cannot detect OS — /etc/os-release not found"
fi

# shellcheck source=/dev/null
source /etc/os-release

SUPPORTED=false
case "${ID}" in
  ubuntu)
    MAJOR_VER="${VERSION_ID%%.*}"
    if [[ "${MAJOR_VER}" -ge 22 ]]; then
      SUPPORTED=true
    fi
    ;;
  debian)
    MAJOR_VER="${VERSION_ID%%.*}"
    if [[ "${MAJOR_VER}" -ge 12 ]]; then
      SUPPORTED=true
    fi
    ;;
esac

if [[ "${SUPPORTED}" != "true" ]]; then
  log_err "Unsupported OS: ${PRETTY_NAME}. FrostDeploy requires Ubuntu 22.04+ or Debian 12+"
fi
log_ok "OS: ${PRETTY_NAME}"

# ─── 3. Check / install Node.js 20+ ─────────────────────────────────────────
install_node() {
  log_info "Installing Node.js ${NODE_MAJOR}.x via NodeSource..."
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg > /dev/null 2>&1
  mkdir -p /etc/apt/keyrings
  curl -fsSL "https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key" \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg --yes
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -qq
  apt-get install -y -qq nodejs > /dev/null 2>&1
}

if command -v node &> /dev/null; then
  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [[ "${NODE_VER}" -ge 20 ]]; then
    log_ok "Node.js $(node -v) detected"
  else
    log_warn "Node.js $(node -v) is too old (need 20+). Upgrading..."
    install_node
    log_ok "Node.js $(node -v) installed"
  fi
else
  install_node
  log_ok "Node.js $(node -v) installed"
fi

# ─── 4. Install Caddy ───────────────────────────────────────────────────────
if command -v caddy &> /dev/null; then
  log_ok "Caddy $(caddy version | head -1) detected"
else
  log_info "Installing Caddy..."
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https > /dev/null 2>&1
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg --yes
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy > /dev/null 2>&1
  log_ok "Caddy $(caddy version | head -1) installed"
fi

# ─── 5. Install pnpm ────────────────────────────────────────────────────────
if command -v pnpm &> /dev/null; then
  log_ok "pnpm $(pnpm -v) detected"
else
  log_info "Installing pnpm via corepack..."
  corepack enable
  corepack prepare pnpm@latest --activate
  log_ok "pnpm $(pnpm -v) installed"
fi

# Also ensure git is available
if ! command -v git &> /dev/null; then
  log_info "Installing git..."
  apt-get install -y -qq git > /dev/null 2>&1
  log_ok "git installed"
fi

# ─── 6. Create user ─────────────────────────────────────────────────────────
if id "${FD_USER}" &> /dev/null; then
  log_ok "User '${FD_USER}' already exists"
else
  useradd --system --shell /usr/sbin/nologin --home-dir "${INSTALL_DIR}" "${FD_USER}"
  log_ok "User '${FD_USER}' created"
fi

# ─── 7. Clone / update repository ───────────────────────────────────────────
if [[ -d "${INSTALL_DIR}/.git" ]]; then
  log_info "Updating existing installation..."
  git -C "${INSTALL_DIR}" fetch origin "${BRANCH}" --quiet
  git -C "${INSTALL_DIR}" reset --hard "origin/${BRANCH}" --quiet
  log_ok "Repository updated to latest ${BRANCH}"
else
  if [[ -d "${INSTALL_DIR}" ]]; then
    # Directory exists but is not a git repo — back up and re-clone
    mv "${INSTALL_DIR}" "${INSTALL_DIR}.bak.$(date +%s)"
    log_warn "Existing ${INSTALL_DIR} backed up"
  fi
  git clone --branch "${BRANCH}" --depth 1 "${REPO_URL}" "${INSTALL_DIR}" --quiet
  log_ok "Repository cloned into ${INSTALL_DIR}"
fi

# ─── 8. Install dependencies & build ────────────────────────────────────────
log_info "Installing dependencies..."
cd "${INSTALL_DIR}"
pnpm install --frozen-lockfile --prod=false 2>&1 | tail -1
log_ok "Dependencies installed"

log_info "Building project..."
pnpm build 2>&1 | tail -1
log_ok "Project built"

# ─── 9. Create data directories & .env ──────────────────────────────────────
mkdir -p "${DATA_DIR}"
mkdir -p "${BACKUP_DIR}"
chown -R "${FD_USER}:${FD_USER}" "${DATA_DIR}"

if [[ -f "${ENV_FILE}" ]]; then
  log_ok ".env file already exists — preserving"
else
  ENCRYPTION_KEY=$(openssl rand -hex 32)
  cat > "${ENV_FILE}" <<EOF
NODE_ENV=production
PORT=${FD_PORT}
DATABASE_PATH=${DATA_DIR}/data.db
BACKUP_DIR=${BACKUP_DIR}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
EOF
  chmod 600 "${ENV_FILE}"
  log_ok ".env file created with auto-generated ENCRYPTION_KEY"
fi

# Set ownership for the entire install directory
chown -R "${FD_USER}:${FD_USER}" "${INSTALL_DIR}"

# ─── 10. Install systemd unit ───────────────────────────────────────────────
UNIT_SOURCE="${INSTALL_DIR}/scripts/frostdeploy.service"
UNIT_DEST="/etc/systemd/system/${SERVICE_NAME}.service"

if [[ ! -f "${UNIT_SOURCE}" ]]; then
  log_err "Systemd unit file not found at ${UNIT_SOURCE}"
fi

cp "${UNIT_SOURCE}" "${UNIT_DEST}"
# Ensure data dir is writable by the service (patch ReadWritePaths if needed)
if ! grep -q "${DATA_DIR}" "${UNIT_DEST}"; then
  sed -i "s|^ReadWritePaths=.*|ReadWritePaths=${INSTALL_DIR}/data ${INSTALL_DIR}/.env ${DATA_DIR}|" "${UNIT_DEST}"
fi
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}" --quiet
log_ok "Systemd unit installed and enabled"

# ─── 11. Configure Caddy ────────────────────────────────────────────────────
if [[ -f "${CADDYFILE}" ]] && grep -q "FrostDeploy" "${CADDYFILE}" 2>/dev/null; then
  log_ok "Caddy already configured for FrostDeploy"
else
  cat > "${CADDYFILE}" <<'CADDYEOF'
{
	# FrostDeploy — Caddy base configuration
	# Routes are managed dynamically via the Caddy Admin API
	admin localhost:2019
}
CADDYEOF
  log_ok "Caddy base config written (admin API on localhost:2019)"
fi

systemctl enable caddy --quiet 2>/dev/null || true
systemctl restart caddy
log_ok "Caddy is running"

# ─── 12. Start FrostDeploy ──────────────────────────────────────────────────
systemctl restart "${SERVICE_NAME}"

# Wait a few seconds for the service to start
sleep 3

if systemctl is-active --quiet "${SERVICE_NAME}"; then
  log_ok "FrostDeploy service is running"
else
  log_err "FrostDeploy service failed to start. Check logs: journalctl -u ${SERVICE_NAME} -n 50"
fi

# ─── 13. Final output ───────────────────────────────────────────────────────
SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║           FrostDeploy is ready! 🚀                  ║${NC}"
echo -e "${BOLD}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}║${NC}                                                      ${BOLD}║${NC}"
echo -e "${BOLD}║${NC}  URL:    ${CYAN}http://${SERVER_IP}:${FD_PORT}${NC}                  ${BOLD}║${NC}"
echo -e "${BOLD}║${NC}                                                      ${BOLD}║${NC}"
echo -e "${BOLD}║${NC}  Open this URL in your browser to start the          ${BOLD}║${NC}"
echo -e "${BOLD}║${NC}  Setup Wizard and create your admin account.         ${BOLD}║${NC}"
echo -e "${BOLD}║${NC}                                                      ${BOLD}║${NC}"
echo -e "${BOLD}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}║${NC}  Useful commands:                                    ${BOLD}║${NC}"
echo -e "${BOLD}║${NC}    systemctl status ${SERVICE_NAME}               ${BOLD}║${NC}"
echo -e "${BOLD}║${NC}    journalctl -u ${SERVICE_NAME} -f              ${BOLD}║${NC}"
echo -e "${BOLD}║${NC}    systemctl restart ${SERVICE_NAME}              ${BOLD}║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
