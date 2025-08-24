# Cloudflare Pages 部署指南

## 自动部署（推荐）

### 通过 Cloudflare Pages Dashboard

1. **登录 Cloudflare Dashboard**
   - 访问 [Cloudflare Pages](https://pages.cloudflare.com/)
   - 登录你的 Cloudflare 账户

2. **创建新项目**
   - 点击 "Create a project"
   - 选择 "Connect to Git"
   - 连接你的 GitHub 仓库

3. **配置构建设置**
   - **项目名称**: `all-model-chat`
   - **生产分支**: `main`
   - **构建命令**: `cd all-model-chat && npm install && npm run build`
   - **构建输出目录**: `all-model-chat/dist`
   - **Node.js版本**: `18`

4. **配置环境变量**
   - 在项目设置中添加环境变量：
     - `GEMINI_API_KEY`: 你的 Gemini API 密钥

5. **部署**
   - 点击 "Save and Deploy"
   - Cloudflare 会自动构建并部署你的应用

### 通过 GitHub Actions（已配置）

项目已经配置了自动部署流程，你需要在 GitHub 仓库设置中添加以下 Secrets：

- `CLOUDFLARE_API_TOKEN`: Cloudflare API 令牌
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare 账户 ID  
- `GEMINI_API_KEY`: Gemini API 密钥

## 本地开发

1. **克隆仓库**
   ```bash
   git clone <your-repo-url>
   cd All-Model-Chat
   ```

2. **安装依赖**
   ```bash
   cd all-model-chat
   npm install
   ```

3. **配置环境变量**
   ```bash
   cp ../.env.example .env
   # 编辑 .env 文件，填入你的 API 密钥
   ```

4. **启动开发服务器**
   ```bash
   npm run dev
   ```

## 手动部署

### 使用 Wrangler CLI

1. **安装 Wrangler**
   ```bash
   npm install -g wrangler
   ```

2. **登录 Cloudflare**
   ```bash
   wrangler login
   ```

3. **构建项目**
   ```bash
   cd all-model-chat
   npm install
   npm run build
   ```

4. **部署到 Pages**
   ```bash
   cd ..
   wrangler pages deploy all-model-chat/dist --project-name=all-model-chat
   ```

## 注意事项

- 确保你的 Cloudflare 账户已启用 Pages 服务
- Gemini API 密钥需要在 Cloudflare Pages 的环境变量中设置
- 项目使用 SPA 路由，已配置重定向规则
- 构建产物位于 `all-model-chat/dist` 目录