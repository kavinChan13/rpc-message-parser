# O-RAN RPC Message Log Parser

<div align="center">

![Python](https://img.shields.io/badge/Python-3.13+-blue.svg)
![React](https://img.shields.io/badge/React-18-61dafb.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

**Professional O-RAN NETCONF/RPC Message Log Analysis Web Application**

</div>

---

## 🌟 Features

### User System
- ✅ Simple username-only authentication
- ✅ Automatic user creation
- ✅ Complete data isolation per user
- ✅ Access historical data with same username

### File Management
- ✅ Multiple log file upload support
- ✅ Background asynchronous parsing
- ✅ Real-time parsing status display
- ✅ Independent analysis page for each file

### RPC Message Analysis
- ✅ Infinite scrolling for all RPC messages
- ✅ **Smart Multi-line Message Merging** - Auto-detect and merge large RPC messages spanning multiple lines
- ✅ Keyword Search - Search any keyword in XML content
- ✅ Expandable formatted XML view
- ✅ XML Syntax Highlighting (tags, attributes, values)
- ✅ Message timestamp and session ID
- ✅ Message direction (DU→RU / RU→DU)
- ✅ Message type (rpc / rpc-reply / notification)
- ✅ Operation type (get / edit-config, etc.)
- ✅ Associated YANG modules
- ✅ Response time statistics with auto request/reply pairing
- ✅ Multi-condition filtering (direction, type)

### Error and Alarm Analysis
- ✅ RPC error reply display
- ✅ Fault alarm tracking
- ✅ Expandable formatted XML view
- ✅ Error severity labels
- ✅ Alarm status (active/cleared)
- ✅ Filter by type and severity

### Carrier Tracking
- ✅ Array Carriers state change tracking
- ✅ Low-level Endpoints event monitoring
- ✅ Low-level Links configuration changes
- ✅ Timeline visualization
- ✅ Expandable formatted XML details
- ✅ Event type and status filtering

---

## 🏗️ System Architecture

```
┌─────────────────┐         ┌─────────────────┐
│                 │  HTTP   │                 │
│  React Frontend │ ◄─────► │  FastAPI Backend│
│   (TypeScript)  │         │    (Python)     │
│                 │         │                 │
└─────────────────┘         └────────┬────────┘
                                     │
                            ┌────────▼────────┐
                            │    SQLite DB    │
                            │  + File Storage │
                            └─────────────────┘
```

---

## 🚀 Quick Start

### Requirements

- Python 3.13+ (or 3.9+)
- Node.js 18+
- npm or yarn

### One-Click Start (Recommended)

#### Windows Users (PowerShell)

```powershell
.\start.ps1
```

#### Linux/macOS Users

```bash
chmod +x start.sh
./start.sh
```

#### Windows Users (CMD)

```cmd
start.bat
```

The application will automatically configure the environment and start. Visit http://localhost:8000

### Manual Start

#### 1. Start Backend

```bash
cd backend
pip install -r requirements.txt
python run.py
```

Backend runs at http://localhost:8000

API Documentation: http://localhost:8000/docs

#### 2. Start Frontend

```bash
cd frontend
npm install
npm run build    # Production build
# or
npm run dev      # Development mode (hot reload)
```

### Usage Workflow

1. **Enter Username**: Access the system and enter your username
2. **Upload Files**: Upload `.log` files on the dashboard
3. **Wait for Parsing**: System automatically parses files in background
4. **View Results**: Click files to view details, RPC list, error list

> 💡 Tip: Use the same username to access previously uploaded files and analysis results

---

## 📁 Project Structure

```
rpc-message-parser/
├── backend/                    # Backend (FastAPI)
│   ├── app/
│   │   ├── main.py            # Application entry
│   │   ├── config.py          # Configuration
│   │   ├── database.py        # Database models
│   │   ├── auth.py            # Authentication
│   │   ├── schemas.py         # API schemas
│   │   ├── parser_service.py  # Parsing service
│   │   └── routes/            # API routes
│   ├── requirements.txt
│   └── run.py
│
├── frontend/                   # Frontend (React)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api/               # API client
│   │   ├── store/             # State management
│   │   ├── pages/             # Page components
│   │   └── components/        # Common components
│   ├── package.json
│   └── vite.config.ts
│
├── docs/
│   └── DEVELOPMENT.md         # Complete development documentation
└── README.md
```

---

## 📊 API Overview

### Authentication API
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | User login (username only) |
| GET | `/api/auth/me` | Get current user |

### File API
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/files/upload` | Upload file |
| GET | `/api/files` | Get file list |
| GET | `/api/files/{id}` | Get file details |
| DELETE | `/api/files/{id}` | Delete file |

### Message API
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/messages/{file_id}/rpc` | RPC message list (supports keyword search) |
| GET | `/api/messages/{file_id}/rpc/{id}` | RPC message details |
| GET | `/api/messages/{file_id}/errors` | Error message list |
| GET | `/api/messages/{file_id}/errors/{id}` | Error message details |
| GET | `/api/messages/{file_id}/carriers` | Carrier event list |
| GET | `/api/messages/{file_id}/carriers/{id}` | Carrier event details |
| GET | `/api/messages/{file_id}/statistics` | Statistics data |

---

## 🎨 UI Features

### Login Page
- Modern dark theme design
- Form validation
- Error notifications

### Dashboard
- 📁 File list card display
- ⬆️ Drag & drop / click to upload
- 📊 Real-time parsing status updates
- 🗑️ File deletion management

### File Details
- 📈 Statistics overview cards (total messages, errors, response time)
- ⏱️ Response time distribution analysis
- 🔧 Operation type distribution chart
- ↔️ Message direction distribution chart
- 🎯 Quick navigation to analysis pages

### RPC Message List
- 🔄 Infinite scroll loading (performance optimized)
- 🔍 Keyword search (in XML content)
- 📋 Table display
- 🎨 Expandable formatted XML view (syntax highlighted)
- 🎯 Multi-condition filtering (direction, type)
- 📊 Real-time search result count

### Error and Alarm List
- 🚨 Error type classification
- 🏷️ Severity labels (Error/Warning)
- ✅ Alarm status display (active/cleared)
- 🎨 Expandable formatted XML view

### Carrier Tracking
- 📊 Timeline visualization
- 🎯 Event type labels (Create/Update/Delete)
- 📡 Carrier type classification
- 🎨 Expandable formatted XML view
- 🔍 Filter by type and name

---

## 📖 Development Documentation

Detailed development documentation available at [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)

Includes:
- Complete system architecture design
- Database model details
- API interface documentation
- Log format analysis
- Deployment guide
- Extension development guide

---

## 🛠️ Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - Async ORM
- **SQLite** - Database
- **python-jose** - JWT authentication
- **xmltodict** - XML parsing

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Modern styling framework
- **Zustand** - Lightweight state management
- **Axios** - HTTP client
- **Vite** - Fast build tool
- **Lucide React** - Icon library
- **date-fns** - Date handling

---

## 🎯 Performance Optimization

- ✅ **Infinite Scrolling** - RPC message list uses infinite scroll for better large file loading experience
- ✅ **Async Parsing** - Background async file parsing, non-blocking user operations
- ✅ **Log Optimization** - Detailed logging disabled in production to reduce system overhead
- ✅ **Frontend Polling Optimization** - Poll only when necessary, reducing API request frequency
- ✅ **Index Optimization** - Database field index optimization for improved query speed

---

## 🔒 Security Features

- ✅ **User Isolation** - Complete data isolation for each user
- ✅ **JWT Authentication** - Token-based secure authentication
- ✅ **File Validation** - Upload file type and size validation
- ✅ **SQL Injection Protection** - Using ORM to prevent SQL injection
- ✅ **XSS Protection** - React auto-escaping to prevent cross-site scripting attacks
- ✅ **Rate Limiting** - API 请求限流，防止 DDoS 攻击
- ✅ **Security Headers** - 安全响应头（X-Frame-Options, X-XSS-Protection 等）
- ✅ **CORS Protection** - 严格的跨域访问控制
- ✅ **Trusted Host** - Host 头验证，防止 Host 头攻击

---

## 📊 Supported Log Formats

### O-RAN NETCONF Log (Standard Format)
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

### Multi-line Message Support 🆕
Parser intelligently supports large XML messages spanning multiple lines:
```
2025-12-15T08:09:18.166Z Dbg: [172.22.0.2] Session 1: Sending message:<rpc message-id="143"><edit-config>...
2025-12-15T08:09:18.167Z Dbg: [172.22.0.2] Session 1: Sending message:...<config>...
2025-12-15T08:09:18.168Z Dbg: [172.22.0.2] Session 1: Sending message:...</config></edit-config></rpc>
```
✅ Auto-merge into complete message
✅ Correctly pair requests and replies
✅ Accurately calculate response time

---

## 🚀 Deployment Guide

### Local Development
```bash
# Quick start
./start.sh          # Linux/macOS
.\start.ps1         # Windows PowerShell

# Development mode (frontend hot reload)
cd backend && python run.py        # Terminal 1
cd frontend && npm run dev         # Terminal 2
```

### Production Deployment
```bash
# Background mode
./start.sh --daemon

# Custom port
./start.sh --port=8080

# Clean rebuild
./start.sh --clean
```

### 反向代理部署 (Reverse Proxy)

如果需要部署在子路径下（如 `https://server.com/rpc-parser/`）：

#### 1. 设置环境变量

**前端** - 创建 `frontend/.env.local`:
```bash
VITE_BASE_PATH=/rpc-parser/
```

**后端** - 创建 `backend/.env`:
```bash
BASE_PATH=/rpc-parser
ALLOWED_ORIGINS=["https://your-server.nokia.com"]
ALLOWED_HOSTS=["your-server.nokia.com"]
DEBUG=false
```

#### 2. 重新构建前端
```bash
cd frontend
npm run build
```

#### 3. 配置 Nginx
参考 `deploy/nginx.conf.example` 配置反向代理。

### CI/CD 自动部署

项目已配置 GitLab CI/CD (`.gitlab-ci.yml`)，支持：

- ✅ 自动测试（前端构建检查、后端导入检查）
- ✅ 自动构建前端（支持自定义 Base Path）
- ✅ 手动部署到开发/生产环境

**配置 CI/CD 变量**（GitLab Settings → CI/CD → Variables）：
| 变量名 | 说明 |
|--------|------|
| `DEPLOY_HOST` | 部署服务器地址 |
| `DEPLOY_USER` | 部署用户名 |
| `DEPLOY_PATH` | 部署路径 |
| `BASE_PATH` | 应用基础路径（如 `/rpc-parser/`）|
| `SSH_PRIVATE_KEY` | SSH 私钥 |
| `SSH_KNOWN_HOSTS` | SSH known_hosts 内容 |

---

## 📄 License

MIT License

---

<div align="center">

**O-RAN RPC Message Log Parser** - Making O-RAN log analysis simpler

Made with ❤️ for O-RAN Engineers

</div>
