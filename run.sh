#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"
SERVER_BIN="$SERVER_DIR/dist/index.js"
DEPLOY_SCRIPT="$SCRIPT_DIR/deploy.sh"
SERVICE_NAME="betterwriter"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
PID_FILE="/var/run/${SERVICE_NAME}.pid"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[信息]${NC} $1"; }
log_success() { echo -e "${GREEN}[成功]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[警告]${NC} $1"; }
log_error() { echo -e "${RED}[错误]${NC} $1"; }

check_root() {
  if [[ $EUID -ne 0 ]]; then
    log_error "此操作需要 root 权限"
    echo "请使用: sudo $0"
    read -p "按回车键返回菜单..."
    return 1
  fi
  return 0
}

check_built() {
  if [[ ! -f "$SERVER_BIN" ]]; then
    log_error "服务器未构建，请先执行「一键部署」"
    read -p "按回车键返回菜单..."
    return 1
  fi
  return 0
}

get_pid() {
  if [[ -f "$PID_FILE" ]]; then
    cat "$PID_FILE" 2>/dev/null || true
  fi
}

is_running() {
  local pid
  pid=$(get_pid)
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    return 0
  fi
  return 1
}

is_service_installed() {
  [[ -f "$SERVICE_FILE" ]]
}

is_service_active() {
  systemctl is-active "$SERVICE_NAME" &>/dev/null
}

show_url() {
  local lan_ip=""
  if command -v hostname >/dev/null 2>&1; then
    lan_ip="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  fi
  if [[ -z "$lan_ip" ]] && command -v ip >/dev/null 2>&1; then
    lan_ip="$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}' || true)"
  fi

  echo ""
  echo -e "${CYAN}  本地访问:   http://localhost:3001/${NC}"
  if [[ -n "$lan_ip" ]]; then
    echo -e "${CYAN}  局域网访问: http://${lan_ip}:3001/${NC}"
  fi
  echo ""
}

do_deploy() {
  echo ""
  echo -e "${BOLD}========== 一键部署 ==========${NC}"
  echo ""

  if [[ ! -f "$DEPLOY_SCRIPT" ]]; then
    log_error "未找到 deploy.sh 脚本"
    read -p "按回车键返回菜单..."
    return
  fi

  bash "$DEPLOY_SCRIPT" --no-start
  echo ""
  read -p "按回车键返回菜单..."
}

do_start() {
  echo ""
  echo -e "${BOLD}========== 启动服务 ==========${NC}"
  echo ""

  if ! check_built; then return; fi

  if is_running; then
    log_warn "服务器已在运行中 (PID: $(get_pid))"
    show_url
    read -p "按回车键返回菜单..."
    return
  fi

  log_info "正在启动 BetterWriter 服务器..."
  cd "$SERVER_DIR"
  nohup node dist/index.js >> "$SCRIPT_DIR/server.log" 2>&1 &
  echo $! > "$PID_FILE"
  sleep 1

  if is_running; then
    log_success "服务器已启动 (PID: $(get_pid))"
    show_url
  else
    log_error "服务器启动失败，请查看 server.log 日志"
    rm -f "$PID_FILE"
  fi

  read -p "按回车键返回菜单..."
}

do_stop() {
  echo ""
  echo -e "${BOLD}========== 停止服务 ==========${NC}"
  echo ""

  if ! is_running; then
    log_warn "服务器未在运行"
    rm -f "$PID_FILE"
    read -p "按回车键返回菜单..."
    return
  fi

  local pid
  pid=$(get_pid)
  log_info "正在停止服务器 (PID: $pid)..."
  kill "$pid" 2>/dev/null || true

  local count=0
  while kill -0 "$pid" 2>/dev/null && [[ $count -lt 10 ]]; do
    sleep 1
    ((count++))
  done

  if kill -0 "$pid" 2>/dev/null; then
    log_warn "强制终止服务器..."
    kill -9 "$pid" 2>/dev/null || true
  fi

  rm -f "$PID_FILE"
  log_success "服务器已停止"
  read -p "按回车键返回菜单..."
}

do_restart() {
  echo ""
  echo -e "${BOLD}========== 重启服务 ==========${NC}"
  echo ""

  if is_running; then
    do_stop_silent
    sleep 1
  fi
  do_start_silent
  read -p "按回车键返回菜单..."
}

do_stop_silent() {
  if ! is_running; then
    rm -f "$PID_FILE"
    return
  fi

  local pid
  pid=$(get_pid)
  kill "$pid" 2>/dev/null || true

  local count=0
  while kill -0 "$pid" 2>/dev/null && [[ $count -lt 10 ]]; do
    sleep 1
    ((count++))
  done

  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null || true
  fi

  rm -f "$PID_FILE"
}

do_start_silent() {
  if ! check_built; then return 1; fi

  if is_running; then
    return 0
  fi

  cd "$SERVER_DIR"
  nohup node dist/index.js >> "$SCRIPT_DIR/server.log" 2>&1 &
  echo $! > "$PID_FILE"
  sleep 1

  if is_running; then
    log_success "服务器已启动 (PID: $(get_pid))"
    show_url
  else
    log_error "服务器启动失败"
    rm -f "$PID_FILE"
    return 1
  fi
}

do_status() {
  echo ""
  echo -e "${BOLD}========== 服务状态 ==========${NC}"
  echo ""

  echo -e "直接运行:  $(is_running && echo -e "${GREEN}运行中${NC} (PID: $(get_pid))" || echo -e "${RED}已停止${NC}")"

  if is_service_installed; then
    local svc_status
    svc_status=$(systemctl is-active "$SERVICE_NAME" 2>/dev/null || echo "inactive")
    if [[ "$svc_status" == "active" ]]; then
      echo -e "守护进程:  ${GREEN}运行中${NC} (已启用)"
    else
      local enabled
      enabled=$(systemctl is-enabled "$SERVICE_NAME" 2>/dev/null || echo "disabled")
      echo -e "守护进程:  ${RED}未运行${NC} ($enabled)"
    fi
  else
    echo -e "守护进程:  ${YELLOW}未安装${NC}"
  fi

  if is_running || is_service_active; then
    show_url
  fi

  read -p "按回车键返回菜单..."
}

do_install_service() {
  echo ""
  echo -e "${BOLD}========== 安装守护进程 ==========${NC}"
  echo ""

  if ! check_root; then return; fi
  if ! check_built; then return; fi

  if is_service_installed; then
    log_warn "守护进程已安装"
    echo "使用「重启守护」更新服务，或「卸载守护」移除服务"
    read -p "按回车键返回菜单..."
    return
  fi

  local user="${SUDO_USER:-$USER}"
  local group
  group=$(id -gn "$user" 2>/dev/null || echo "$user")

  cat > "$SERVICE_FILE" << EOF
[Unit]
Description=BetterWriter Server
After=network.target

[Service]
Type=simple
User=${user}
Group=${group}
WorkingDirectory=${SERVER_DIR}
ExecStart=/usr/bin/node ${SERVER_DIR}/dist/index.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
PrivateTmp=true
ReadWritePaths=${SERVER_DIR}

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable "$SERVICE_NAME"

  log_success "守护进程安装成功"
  echo ""
  echo -e "${CYAN}可用命令:${NC}"
  echo "  sudo systemctl start ${SERVICE_NAME}    # 启动服务"
  echo "  sudo systemctl stop ${SERVICE_NAME}     # 停止服务"
  echo "  sudo systemctl status ${SERVICE_NAME}   # 查看状态"
  echo "  sudo journalctl -u ${SERVICE_NAME} -f   # 查看日志"
  echo ""

  read -p "是否立即启动服务? [Y/n] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    systemctl start "$SERVICE_NAME"
    sleep 1
    systemctl status "$SERVICE_NAME" --no-pager || true
    show_url
  fi

  read -p "按回车键返回菜单..."
}

do_uninstall_service() {
  echo ""
  echo -e "${BOLD}========== 卸载守护进程 ==========${NC}"
  echo ""

  if ! check_root; then return; fi

  if ! is_service_installed; then
    log_warn "守护进程未安装"
    read -p "按回车键返回菜单..."
    return
  fi

  systemctl stop "$SERVICE_NAME" 2>/dev/null || true
  systemctl disable "$SERVICE_NAME" 2>/dev/null || true
  rm -f "$SERVICE_FILE"
  systemctl daemon-reload

  log_success "守护进程已卸载"
  read -p "按回车键返回菜单..."
}

do_restart_service() {
  echo ""
  echo -e "${BOLD}========== 重启守护进程 ==========${NC}"
  echo ""

  if ! check_root; then return; fi

  if ! is_service_installed; then
    log_error "守护进程未安装"
    read -p "按回车键返回菜单..."
    return
  fi

  log_info "正在重启服务..."
  systemctl restart "$SERVICE_NAME"
  sleep 1
  systemctl status "$SERVICE_NAME" --no-pager || true
  show_url

  read -p "按回车键返回菜单..."
}

do_view_logs() {
  echo ""
  echo -e "${BOLD}========== 查看日志 ==========${NC}"
  echo ""

  if is_service_installed; then
    echo "显示 systemd 日志 (Ctrl+C 退出)..."
    journalctl -u "$SERVICE_NAME" -f --no-pager -n 50
  elif [[ -f "$SCRIPT_DIR/server.log" ]]; then
    echo "显示 server.log (Ctrl+C 退出)..."
    tail -f "$SCRIPT_DIR/server.log"
  else
    log_error "暂无日志"
    read -p "按回车键返回菜单..."
  fi
}

show_menu() {
  clear
  echo ""
  echo -e "${BOLD}╔══════════════════════════════════════╗${NC}"
  echo -e "${BOLD}║       BetterWriter 控制面板          ║${NC}"
  echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"
  echo ""

  local status
  if is_running; then
    status="\e[32m● 运行中\e[0m (PID: $(get_pid))"
  else
    status="\e[31m○ 已停止\e[0m"
  fi
  echo -e "  状态: $status"

  if is_service_installed; then
    local svc_status
    svc_status=$(systemctl is-active "$SERVICE_NAME" 2>/dev/null || echo "inactive")
    if [[ "$svc_status" == "active" ]]; then
      echo -e "  守护进程: \e[32m● 运行中\e[0m"
    else
      echo -e "  守护进程: \e[33m○ 已安装 (未运行)\e[0m"
    fi
  fi

  echo ""
  echo -e "${BOLD}  ─────────── 快捷操作 ───────────${NC}"
  echo ""
  echo "  1) 一键部署        安装依赖并构建项目"
  echo "  2) 启动服务        后台启动服务器"
  echo "  3) 停止服务        停止运行中的服务器"
  echo "  4) 重启服务        重启服务器"
  echo "  5) 查看状态        查看详细状态信息"
  echo ""
  echo -e "${BOLD}  ───────── 系统守护进程 ───────────${NC}"
  echo ""
  echo "  6) 安装守护        添加到 systemd (开机自启)"
  echo "  7) 卸载守护        移除 systemd 服务"
  echo "  8) 重启守护        重启 systemd 服务"
  echo ""
  echo -e "${BOLD}  ────────────── 其他 ───────────────${NC}"
  echo ""
  echo "  9) 查看日志        显示服务器日志"
  echo "  0) 退出"
  echo ""
  echo -n "  请选择 [0-9]: "
}

main() {
  if [[ "${1:-}" != "" ]]; then
    case "$1" in
      start) do_start_silent ;;
      stop) do_stop_silent ;;
      restart) do_stop_silent; sleep 1; do_start_silent ;;
      status) do_status ;;
      install) do_install_service ;;
      uninstall) do_uninstall_service ;;
      logs) do_view_logs ;;
      help|-h|--help)
        cat << 'EOF'
BetterWriter 服务器控制脚本

用法:
  ./run.sh [命令]

命令:
  start       启动服务器
  stop        停止服务器
  restart     重启服务器
  status      查看状态
  install     安装 systemd 守护进程 (需 sudo)
  uninstall   卸载 systemd 守护进程 (需 sudo)
  logs        查看日志

不带参数运行将进入交互式菜单。
EOF
        exit 0
        ;;
      *)
        echo "未知命令: $1"
        echo "运行 './run.sh help' 查看用法"
        exit 1
        ;;
    esac
    exit 0
  fi

  while true; do
    show_menu
    read -n 1 -r choice
    echo ""

    case "$choice" in
      1) do_deploy ;;
      2) do_start ;;
      3) do_stop ;;
      4) do_restart ;;
      5) do_status ;;
      6) do_install_service ;;
      7) do_uninstall_service ;;
      8) do_restart_service ;;
      9) do_view_logs ;;
      0|q|Q)
        echo ""
        log_info "再见!"
        exit 0
        ;;
      *)
        log_warn "无效选项，请重新选择..."
        read
        ;;
    esac
  done
}

main "$@"
