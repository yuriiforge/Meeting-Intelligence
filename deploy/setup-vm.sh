#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu VM (tested target: Oracle Cloud,
# Ubuntu 24.04 on VM.Standard.A1.Flex). Run as the default `ubuntu` user:
#   ./deploy/setup-vm.sh
set -euo pipefail

echo "==> Installing Docker Engine and the Compose plugin"
if ! command -v docker >/dev/null 2>&1; then
  # Docker's official install script for Ubuntu (adds Docker's apt repository).
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo usermod -aG docker "$USER"

echo "==> Opening ports 80 and 443 in the VM firewall"
# Oracle's Ubuntu images ship iptables rules that reject everything except
# SSH. Opening ports in the cloud console (security list) is not enough;
# they also have to be opened here, before the final REJECT rule.
for port in 80 443; do
  if ! sudo iptables -C INPUT -p tcp --dport "$port" -m state --state NEW -j ACCEPT 2>/dev/null; then
    reject_line=$(sudo iptables -L INPUT --line-numbers | awk '/REJECT/ {print $1; exit}')
    if [ -n "$reject_line" ]; then
      sudo iptables -I INPUT "$reject_line" -p tcp --dport "$port" -m state --state NEW -j ACCEPT
    else
      sudo iptables -A INPUT -p tcp --dport "$port" -m state --state NEW -j ACCEPT
    fi
  fi
done
if ! command -v netfilter-persistent >/dev/null 2>&1; then
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent
fi
sudo netfilter-persistent save # keep the rules after a reboot

echo
echo "Done. Log out and back in (so the docker group applies), then:"
echo "  cp deploy/.env.example deploy/.env && nano deploy/.env"
echo "  ./deploy/deploy.sh"
