# DeepSeek 聊天助手

一个基于 Vue.js 构建的现代化聊天应用，集成 DeepSeek API，支持流式对话、Markdown 渲染、Mermaid 图表等功能。

<<<<<<< HEAD
![Vue](https://img.shields.io/badge/Vue-2.6.14-4FC08D?style=flat-square&logo=vue.js)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

=======
>>>>>>> d1974d651e2a0878f544bd99d891fa5f9033f725
## ✨ 功能特性

- 💬 **流式对话** - 实时流式输出，提供流畅的对话体验
- 📝 **Markdown 支持** - 完整支持 Markdown 语法渲染
- 📊 **Mermaid 图表** - 支持 Mermaid 图表渲染，可切换代码/图表视图
- 💾 **对话历史** - 本地存储对话历史，支持多对话管理
- 🎨 **现代化 UI** - 美观的界面设计，响应式布局
- 🔄 **消息重生成** - 支持重新生成助手回复
- 📋 **代码复制** - 一键复制代码和消息内容
- 💾 **图表下载** - 支持下载 Mermaid 图表为 SVG 格式
- 🧠 **思考链显示** - 支持显示 AI 的思考过程（DeepSeek Reasoner 模型）

## 📸 项目截图
<<<<<<< HEAD

<!-- 
  如何插入图片？请查看 docs/IMAGE_GUIDE.md 了解详细说明
  
  快速开始：
  1. 创建 docs/images/ 文件夹
  2. 将截图放入该文件夹
  3. 取消下面的注释并修改路径
  
  示例：
  ![主界面](./docs/images/main.png)
  ![对话界面](./docs/images/chat.png)
  ![Mermaid图表](./docs/images/mermaid.png)
  
  详细说明请参考：docs/IMAGE_GUIDE.md
-->
=======
<img width="2512" height="1314" alt="13ee8602f43345cd11efa1bfe41af925" src="https://github.com/user-attachments/assets/7676e6bb-25cc-4715-906a-21693b05c5f9" />

>>>>>>> d1974d651e2a0878f544bd99d891fa5f9033f725

## 🚀 快速开始

### 环境要求

- Node.js >= 14.0.0
- npm >= 6.0.0

### 安装依赖

```bash
npm install
```

### 配置 API

1. 打开 `src/services/deepseekApi.js`
2. 修改以下配置：

```javascript
const DEEPSEEK_CONFIG = {
  apiUrl: 'https://api.deepseek.com/chat/completions',
  apiKey: '你的API密钥',  // 替换为你的实际 API 密钥
  model: 'deepseek-reasoner',  // 可选：deepseek-chat, deepseek-reasoner
  stream: true
}
```

> 💡 **获取 API 密钥**：访问 [DeepSeek 官网](https://www.deepseek.com/) 注册账号并获取 API 密钥

### 运行项目

```bash
# 开发模式
npm run serve

# 构建生产版本
npm run build

# 代码检查
npm run lint
```

运行后访问 `http://localhost:8080`

## 📖 使用说明

### 基本使用

1. **新建对话**：点击侧边栏的"新建对话"按钮
2. **发送消息**：在输入框中输入问题，按 Enter 发送（Shift+Enter 换行）
3. **切换对话**：在侧边栏点击任意对话项
4. **删除对话**：鼠标悬停在对话项上，点击删除按钮

### Mermaid 图表功能

- **切换视图**：点击图表上方的"显示代码"/"显示图表"按钮
- **复制代码**：点击"复制"按钮复制 Mermaid 代码
- **下载图表**：点击"下载"按钮将图表保存为 SVG 文件

### 消息操作

- **复制消息**：点击消息下方的"复制"按钮
- **重新生成**：点击助手消息的"重新生成"按钮

## 🛠️ 技术栈

- **前端框架**：Vue.js 2.6.14
- **路由**：Vue Router 3.5.1
- **状态管理**：Vuex 3.6.2
- **Markdown 解析**：marked 17.0.0
- **图表渲染**：mermaid 11.12.1
- **构建工具**：Vue CLI 5.0.0

## 📁 项目结构

```
chatw/
├── public/                 # 静态资源
│   ├── favicon.ico
│   └── index.html
├── src/
│   ├── assets/            # 资源文件
│   │   └── logo.png
│   ├── components/        # 组件
│   │   ├── ChatComponent.vue    # 聊天组件
│   │   ├── SideBar.vue          # 侧边栏组件
│   │   └── HelloWorld.vue
│   ├── router/           # 路由配置
│   │   └── index.js
│   ├── services/         # API 服务
│   │   └── deepseekApi.js       # DeepSeek API 封装
│   ├── store/           # Vuex 状态管理
│   │   └── index.js
│   ├── views/           # 页面视图
│   │   ├── HomeView.vue        # 主页
│   │   └── AboutView.vue
│   ├── App.vue          # 根组件
│   └── main.js         # 入口文件
├── babel.config.js     # Babel 配置
├── vue.config.js       # Vue CLI 配置
├── package.json        # 项目配置
└── README.md          # 项目文档
```

## 🔧 配置说明

### API 配置

在 `src/services/deepseekApi.js` 中可以配置：

- `apiUrl`: API 端点地址
- `apiKey`: API 密钥
- `model`: 使用的模型（deepseek-chat 或 deepseek-reasoner）
- `stream`: 是否启用流式输出

### 模型说明

- **deepseek-chat**：标准对话模型
- **deepseek-reasoner**：推理模型，支持思考链显示

## 📝 开发说明

### 添加新功能

1. 组件开发：在 `src/components/` 目录下创建新组件
2. API 调用：在 `src/services/` 目录下扩展 API 服务
3. 路由配置：在 `src/router/index.js` 中添加路由

### 代码规范

项目使用 ESLint 进行代码检查，运行 `npm run lint` 检查代码规范。

## 🐛 常见问题

### 1. API 调用失败

- 检查 API 密钥是否正确配置
- 确认网络连接正常
- 查看浏览器控制台错误信息

### 2. Mermaid 图表不显示

- 确保图表代码格式正确
- 检查浏览器控制台是否有错误
- 尝试切换代码/图表视图

### 3. 对话历史丢失

- 检查浏览器是否允许 localStorage
- 清除浏览器缓存可能导致历史丢失

## 📄 许可证

MIT License

## 🙏 致谢

- [DeepSeek](https://www.deepseek.com/) - 提供强大的 AI API
- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架
- [Mermaid](https://mermaid.js.org/) - 图表和流程图生成工具

## 📮 联系方式

如有问题或建议，欢迎提交 Issue 或 Pull Request。

---

**注意**：使用前请确保已配置有效的 DeepSeek API 密钥。
