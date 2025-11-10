#!/bin/bash

echo "开始启动AI Chat服务器..."

# 检查Node.js版本
echo "Node.js版本:"
node --version

# 检查npm版本
echo "npm版本:"
npm --version

# 检查.env文件是否存在
if [ -f ".env" ]; then
    echo ".env文件存在"
    echo "检查环境变量配置:"
    grep -E "(JWT_SECRET|SESSION_SECRET|DIFY_)" .env | sed 's/=.*/=***/'
else
    echo "警告: .env文件不存在!"
fi

# 检查必要的目录
if [ ! -d "uploads" ]; then
    echo "创建uploads目录..."
    mkdir -p uploads
fi

if [ ! -d "services" ]; then
    echo "警告: services目录不存在!"
fi

if [ ! -d "middleware" ]; then
    echo "警告: middleware目录不存在!"
fi

if [ ! -d "public" ]; then
    echo "警告: public目录不存在!"
fi

# 检查必要文件
echo "检查文件完整性:"
files=("server.js" "services/difyService.js" "middleware/auth.js" "public/index.html" "public/app.js" "public/styles.css")

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file 存在"
    else
        echo "✗ $file 缺失!"
    fi
done

# 安装依赖
echo "安装/更新依赖包..."
npm install

# 启动服务器
echo "启动服务器..."
echo "========================================="
npm start