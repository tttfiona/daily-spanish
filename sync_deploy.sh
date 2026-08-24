#!/usr/bin/env bash
# 一键同步:Obsidian 里的 app 文件夹 → 部署仓库 → 推送到 GitHub Pages
set -e
SRC="/Users/vipt88/Documents/Fiona知识库/08-西语学习/app"
DST="$HOME/daily-spanish-app"

echo "▶ 重新生成 lessons.json ..."
cd "$SRC" && python3 export.py

echo "▶ 同步到部署仓库 ..."
rsync -av --delete \
  --exclude 'export.py' --exclude '.DS_Store' \
  --exclude '.git' --exclude 'sync_deploy.sh' \
  "$SRC/" "$DST/"

cd "$DST"
git add -A
if git diff --cached --quiet; then
  echo "ℹ 无更新,跳过提交"
else
  git -c user.name=vipt88 -c user.email=vipt88@qq.com commit -m "sync $(date +%Y-%m-%d)"
fi
echo "▶ 推送到 GitHub ..."
git push
echo "✅ 完成:https://vipt88.github.io/daily-spanish/"
