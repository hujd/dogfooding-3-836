# Windows 容器兼容的 Dockerfile
FROM mcr.microsoft.com/windows/servercore:ltsc2022

WORKDIR /app/environment/repo

# 安装 Node.js
RUN powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.12.2/node-v20.12.2-x64.msi' -OutFile 'node-installer.msi'; Start-Process msiexec.exe -ArgumentList '/i', 'node-installer.msi', '/quiet', '/norestart' -Wait; Remove-Item 'node-installer.msi' -Force"

# 刷新环境变量
RUN setx /M PATH "%PATH%;C:\Program Files\nodejs"

# 复制依赖文件
COPY environment/frozen-requirements.txt /app/environment/repo/package.json

# 安装依赖
RUN npm install

# 复制应用代码
COPY environment/repo/ /app/environment/repo/

# 暴露端口
EXPOSE 5173

# 启动命令
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
