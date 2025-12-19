# O-RAN RPC 消息日志解析器

<div align="center">

![Python](https://img.shields.io/badge/Python-3.13+-blue.svg)
![React](https://img.shields.io/badge/React-18-61dafb.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

**专业的 O-RAN NETCONF/RPC 消息日志解析与分析 Web 应用**

</div>

---

## 🌟 功能特性

### 用户系统
- ✅ 只需输入用户名即可使用
- ✅ 自动创建新用户
- ✅ 用户数据完全隔离
- ✅ 相同用户名可访问历史数据

### 文件管理
- ✅ 支持上传多个日志文件
- ✅ 后台异步解析
- ✅ 实时显示解析状态
- ✅ 每个文件独立分析页面

### RPC 消息分析
- ✅ 无限滚动显示所有 RPC 消息
- ✅ **智能多行消息合并** - 自动识别跨行的大型 RPC 消息
- ✅ 关键字搜索 - 在 XML 内容中搜索任意关键字
- ✅ 可展开查看格式化的 XML 原始消息
- ✅ XML 语法高亮显示（标签、属性、值分色）
- ✅ 消息时间戳与会话 ID
- ✅ 消息方向 (DU→RU / RU→DU)
- ✅ 消息类型 (rpc / rpc-reply / notification)
- ✅ 操作类型 (get / edit-config 等)
- ✅ 关联的 YANG 模块
- ✅ 响应时间统计与请求/回复自动配对
- ✅ 多条件筛选（方向、类型）

### 错误与告警分析
- ✅ RPC 错误回复展示
- ✅ Fault 告警上报追踪
- ✅ 可展开查看格式化的 XML 原始消息
- ✅ 错误严重程度标签
- ✅ 告警状态 (活动/已清除)
- ✅ 按类型和严重程度筛选

### Carrier 跟踪
- ✅ Array Carriers 状态变化追踪
- ✅ Low-level Endpoints 事件监控
- ✅ Low-level Links 配置变更
- ✅ 时间线可视化展示
- ✅ 可展开查看格式化的 XML 详情
- ✅ 事件类型和状态筛选

---

## 🏗️ 系统架构

```
┌─────────────────┐         ┌─────────────────┐
│                 │  HTTP   │                 │
│   React 前端    │ ◄─────► │  FastAPI 后端   │
│   (TypeScript)  │         │   (Python)      │
│                 │         │                 │
└─────────────────┘         └────────┬────────┘
                                     │
                            ┌────────▼────────┐
                            │    SQLite DB    │
                            │   + 文件存储     │
                            └─────────────────┘
```

---

## 🚀 快速开始

### 环境要求

- Python 3.13+ (或 3.9+)
- Node.js 18+
- npm 或 yarn

### 一键启动（推荐）

#### Windows 用户（PowerShell）

```powershell
.\start.ps1
```

#### Linux/macOS 用户

```bash
chmod +x start.sh
./start.sh
```

#### Windows 用户（CMD）

```cmd
start.bat
```

应用将自动配置环境并启动，访问 http://localhost:8000

📖 **更多选项请查看 [启动脚本使用指南](STARTUP_GUIDE.md)**

### 手动启动

#### 1. 启动后端

```bash
cd backend
pip install -r requirements.txt
python run.py
```

后端运行在 http://localhost:8000

API 文档: http://localhost:8000/docs

#### 2. 启动前端

```bash
cd frontend
npm install
npm run build    # 生产构建
# 或
npm run dev      # 开发模式（热重载）
```

### 使用流程

1. **输入用户名**: 访问系统，输入您的用户名
2. **上传文件**: 在仪表盘上传 `.log` 日志文件
3. **等待解析**: 系统自动解析文件 (后台进行)
4. **查看结果**: 点击文件查看详情、RPC 列表、错误列表

> 💡 提示：输入相同的用户名可以访问之前上传的文件和分析结果

---

## 📁 项目结构

```
rpc-message-parser/
├── backend/                    # 后端 (FastAPI)
│   ├── app/
│   │   ├── main.py            # 应用入口
│   │   ├── config.py          # 配置
│   │   ├── database.py        # 数据库模型
│   │   ├── auth.py            # 认证
│   │   ├── schemas.py         # API 模式
│   │   ├── parser_service.py  # 解析服务
│   │   └── routes/            # API 路由
│   ├── requirements.txt
│   └── run.py
│
├── frontend/                   # 前端 (React)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api/               # API 客户端
│   │   ├── store/             # 状态管理
│   │   ├── pages/             # 页面组件
│   │   └── components/        # 通用组件
│   ├── package.json
│   └── vite.config.ts
│
├── docs/
│   └── DEVELOPMENT.md         # 完整开发文档
└── README.md
```

---

## 📊 API 概览

### 认证 API
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 用户登录 (只需用户名) |
| GET | `/api/auth/me` | 获取当前用户 |

### 文件 API
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/files/upload` | 上传文件 |
| GET | `/api/files` | 获取文件列表 |
| GET | `/api/files/{id}` | 获取文件详情 |
| DELETE | `/api/files/{id}` | 删除文件 |

### 消息 API
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/messages/{file_id}/rpc` | RPC 消息列表（支持关键字搜索） |
| GET | `/api/messages/{file_id}/rpc/{id}` | RPC 消息详情 |
| GET | `/api/messages/{file_id}/errors` | 错误消息列表 |
| GET | `/api/messages/{file_id}/errors/{id}` | 错误消息详情 |
| GET | `/api/messages/{file_id}/carriers` | Carrier 事件列表 |
| GET | `/api/messages/{file_id}/carriers/{id}` | Carrier 事件详情 |
| GET | `/api/messages/{file_id}/statistics` | 统计数据 |

---

## 🎨 界面预览

### 登录页面
- 现代化暗色主题设计
- 表单验证
- 错误提示

### 仪表盘
- 📁 文件列表卡片展示
- ⬆️ 拖拽上传 / 点击上传
- 📊 解析状态实时更新
- 🗑️ 文件删除管理

### 文件详情
- 📈 统计概览卡片（消息总数、错误数、响应时间）
- ⏱️ 响应时间分布分析
- 🔧 操作类型分布图
- ↔️ 消息方向分布图
- 🎯 快捷导航到各分析页面

### RPC 消息列表
- 🔄 无限滚动加载（性能优化）
- 🔍 关键字搜索（在 XML 内容中搜索）
- 📋 表格展示
- 🎨 可展开查看格式化 XML（语法高亮）
- 🎯 多条件筛选（方向、类型）
- 📊 实时显示搜索结果数量

### 错误与告警列表
- 🚨 错误类型分类
- 🏷️ 严重程度标签（Error/Warning）
- ✅ 告警状态显示（活动/已清除）
- 🎨 可展开查看格式化 XML

### Carrier 跟踪
- 📊 时间线可视化展示
- 🎯 事件类型标签（Create/Update/Delete）
- 📡 Carrier 类型分类
- 🎨 可展开查看格式化 XML
- 🔍 按类型和名称筛选

---

## 📖 开发文档

详细的开发文档请参阅 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)

包含:
- 完整系统架构设计
- 数据库模型详解
- API 接口文档
- 日志格式分析
- 部署指南
- 扩展开发指南

---

## 🛠️ 技术栈

### 后端
- **FastAPI** - 现代 Python Web 框架
- **SQLAlchemy** - 异步 ORM
- **SQLite** - 数据库
- **python-jose** - JWT 认证
- **xmltodict** - XML 解析

### 前端
- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Tailwind CSS** - 现代化样式框架
- **Zustand** - 轻量级状态管理
- **Axios** - HTTP 客户端
- **Vite** - 快速构建工具
- **Lucide React** - 图标库
- **date-fns** - 日期处理

---

## 🎯 性能优化

- ✅ **无限滚动** - RPC 消息列表采用无限滚动，提升大文件加载体验
- ✅ **异步解析** - 后台异步处理文件解析，不阻塞用户操作
- ✅ **日志优化** - 生产环境关闭详细日志，减少系统开销
- ✅ **前端轮询优化** - 只在必要时轮询，降低 API 请求频率
- ✅ **索引优化** - 数据库字段索引优化，提升查询速度

---

## 🔒 安全特性

- ✅ **用户隔离** - 每个用户的数据完全隔离
- ✅ **JWT 认证** - 基于 Token 的安全认证
- ✅ **文件验证** - 上传文件类型和大小验证
- ✅ **SQL 注入防护** - 使用 ORM 防止 SQL 注入
- ✅ **XSS 防护** - React 自动转义，防止跨站脚本攻击

---

## 📊 支持的日志格式

### O-RAN NETCONF 日志（标准格式）
```
2025-12-15T08:09:18.166Z Dbg: [172.22.0.2] Session 1: Sending message:<rpc message-id="1" xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <get>
    ...
  </get>
</rpc>
```

### RPC Reply
```
2025-12-15T08:09:18.456Z Dbg: [172.22.0.2] Session 1: Received message:<rpc-reply message-id="1" xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  ...
</rpc-reply>
```

### Notification
```
2025-12-15T08:09:18.789Z Dbg: [172.22.0.2] Session 1: Received message:<notification xmlns="urn:ietf:params:xml:ns:netconf:notification:1.0">
  ...
</notification>
```

### 多行消息支持 🆕
解析器智能支持大型 XML 消息跨越多行的情况：
```
2025-12-15T08:09:18.166Z Dbg: [172.22.0.2] Session 1: Sending message:<rpc message-id="143"><edit-config>...
2025-12-15T08:09:18.167Z Dbg: [172.22.0.2] Session 1: Sending message:...<config>...
2025-12-15T08:09:18.168Z Dbg: [172.22.0.2] Session 1: Sending message:...</config></edit-config></rpc>
```
✅ 自动合并为完整消息
✅ 正确配对请求和回复
✅ 准确计算响应时间

---

## 🚀 部署指南

### 本地开发
```bash
# 快速启动
./start.sh          # Linux/macOS
.\start.ps1         # Windows PowerShell

# 开发模式（前端热重载）
cd backend && python run.py        # 终端 1
cd frontend && npm run dev         # 终端 2
```

### 生产部署
```bash
# 后台运行模式
./start.sh --daemon

# 自定义端口
./start.sh --port=8080

# 清理重建
./start.sh --clean
```

更多部署选项请查看 [启动脚本使用指南](STARTUP_GUIDE.md)

---

## 📄 许可证

MIT License

---

<div align="center">

**O-RAN RPC Message Log Parser** - 让 O-RAN 日志分析更简单

Made with ❤️ for O-RAN Engineers

</div>
