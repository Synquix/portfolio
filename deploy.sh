#!/usr/bin/env bash
set -e

cd /var/www/portfolio

npm install
sudo systemctl restart portfolio-kiosk
sudo systemctl status portfolio-kiosk --no-pager
