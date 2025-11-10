@echo off
chcp 65001 >nul

echo 开始启动AI Chat服务器...
echo.

:: 检查Node.js版本
echo Node.js版本:
node --version
echo.

:: 检查npm版本
echo npm版本:
npm --version
echo.

:: 检查.env文件是否存在
if exist ".env" (
    echo .env文件存在
    echo 检查环境变量配置:
    findstr /R "JWT_SECRET\|SESSION_SECRET\|DIFY_" .env | powershell -Command "$input | ForEach-Object { $_ -replace '=.*','=***' }"
) else (
    echo 警告: .env文件不存在!
)
echo.

:: 检查必要的目录
if not exist "uploads" (
    echo 创建uploads目录...
    mkdir uploads
)

if not exist "services" (
    echo 警告: services目录不存在!
)

if not exist "middleware" (
    echo 警告: middleware目录不存在!
)

if not exist "public" (
    echo 警告: public目录不存在!
)

:: 检查必要文件
echo 检查文件完整性:
set files[0]=server.js
set files[1]=services\difyService.js
set files[2]=middleware\auth.js
set files[3]=public\index.html
set files[4]=public\app.js
set files[5]=public\styles.css

for /L %%i in (0,1,5) do (
    call set file=%%files[%%i]%%
    call set file=%%file%%
    if exist "!file!" (
        echo ✓ !file! 存在
    ) else (
        echo ✗ !file! 缺失!
    )
)
echo.

:: 安装依赖
echo 安装/更新依赖包...
npm install
echo.

:: 启动服务器
echo 启动服务器...
echo =========================================
npm start