# RetailPulse Analytics

A comprehensive retail analytics platform for managing products, inventory, sales, and categories with real-time dashboards and stock monitoring.

## Features

- **User Authentication** — Register, login, and JWT-based session management with role-based access control (COMPANY_ADMIN, ANALYST, SUPER_ADMIN).
- **Product Management** — Full CRUD for products with categories, brands, SKU tracking, and stock quantities.
- **Category Management** — Create and organize product categories with product count tracking.
- **Inventory Management** — Monitor stock levels, add/remove/adjust stock, set reorder thresholds, and track stock movements and adjustment history.
- **Sales Management** — Record sales transactions across multiple channels (Departmental POS, Online Storefront, Express Kiosks).
- **Dashboard** — Real-time overview with key metrics, monthly revenue trend chart, sales channel breakdown, and inventory summary cards.
- **Inventory Charts** — Visual breakdown of inventory by category and stock status distribution.

## Tech Stack

### Backend
- **Python 3.12** — Core language
- **FastAPI** — Async web framework
- **SQLAlchemy 2.0** — Async ORM with PostgreSQL
- **PostgreSQL** — Database
- **Pydantic** — Data validation and serialization
- **python-jose** — JWT token handling
- **Passlib** — Password hashing (bcrypt)

### Frontend
- **React 19** — UI library
- **TypeScript** — Type safety
- **Vite** — Build tool and dev server
- **Tailwind CSS** — Utility-first styling
- **Material UI (MUI)** — Component library and icons
- **React Router DOM** — Client-side routing
- **TanStack React Query** — Server state management
- **Axios** — HTTP client
- **React Hook Form** — Form handling

## Installation

### Prerequisites
- Python 3.12+
- Node.js 20+
- PostgreSQL 15+

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment and activate it:
   ```bash
   python -m venv venv
   venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Copy the environment file and configure it:
   ```bash
   copy .env.example .env
   ```
   Edit `.env` with your database URL and JWT secrets.

5. Set up the PostgreSQL database:
   ```bash
   # Run the setup script or create the database manually
   createdb retailpulse
   ```

6. Start the backend server:
   ```bash
   python main.py
   ```
   The API will be available at `http://localhost:8000`.

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment file and configure it:
   ```bash
   copy .env.example .env
   ```
   Set `VITE_API_URL` to your backend URL (e.g., `http://localhost:8000/api`).

4. Start the development server:
   ```bash
   npm run dev
   ```
   The frontend will be available at `http://localhost:5173`.

## Environment Variables

### Backend (`.env`)
| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://retailpulse:retailpulse@localhost:5432/retailpulse` |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens | `super_secret_retail_pulse_access_key_987654321_abcd` |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens | `super_secret_retail_pulse_refresh_key_123456789_efgh` |
| `JWT_ACCESS_EXPIRY_MINUTES` | Access token expiry in minutes | `15` |
| `JWT_REFRESH_EXPIRY_DAYS` | Refresh token expiry in days | `7` |
| `APP_NAME` | Application name | `RetailPulse Analytics API` |
| `APP_ENV` | Environment (development/production) | `development` |

### Frontend (`.env`)
| Variable | Description | Default |
|---|---|---|
| `VITE_API_URL` | Backend API base URL | `http://localhost:8000/api` |

## Screenshots

### Dashboard
- **Dashboard Overview** — `Screenshot/Task 2 - Product & Category Management/Dashboard overview.png`
- **Dashboard Light Mode** — `Screenshot/Task 2 - Product & Category Management/Dashboard view lightmode.png`
- **Dashboard Dark Mode** — `Screenshot/Task 2 - Product & Category Management/Dashboard darkmodeMobile view page.png`

### Products & Categories
- **Products Page** — `Screenshot/Task 2 - Product & Category Management/Products page.png`
- **Categories Page** — `Screenshot/Task 2 - Product & Category Management/Category page.png`
- **Edit Product** — `Screenshot/Task 2 - Product & Category Management/Edit Product page.png`
- **Edit Category** — `Screenshot/Task 2 - Product & Category Management/Edit Category page.png`

### Sales Management
- **Sales Page** — `Screenshot/Task 3 - Sales Management & Sales Transactions/Sale page.png`
- **New Sale** — `Screenshot/Task 3 - Sales Management & Sales Transactions/New Sale page.png`
- **Sale by Invoice** — `Screenshot/Task 3 - Sales Management & Sales Transactions/sale search invoice number page.png`

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login and receive JWT tokens |
| POST | `/api/auth/refresh` | Refresh access token |

### Dashboard
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/dashboard/overview` | Get dashboard overview with metrics, revenue chart, and channel breakdown |

### Products
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/products` | List products with filtering, sorting, and pagination |
| GET | `/api/products/active` | List active products for sales entry |
| GET | `/api/products/{id}` | Get a single product |
| POST | `/api/products` | Create a new product |
| PUT | `/api/products/{id}` | Update a product |
| DELETE | `/api/products/{id}` | Delete a product |
| PATCH | `/api/products/{id}/activate` | Activate a product |
| PATCH | `/api/products/{id}/deactivate` | Deactivate a product |

### Categories
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/categories` | List categories |
| GET | `/api/categories/{id}` | Get a single category |
| POST | `/api/categories` | Create a category |
| PUT | `/api/categories/{id}` | Update a category |
| DELETE | `/api/categories/{id}` | Delete a category |

### Inventory
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/inventory` | List inventory items with filtering |
| GET | `/api/inventory/summary` | Get inventory summary (total, low stock, out of stock) |
| GET | `/api/inventory/category-breakdown` | Get inventory breakdown by category |
| GET | `/api/inventory/status-breakdown` | Get inventory breakdown by stock status |
| GET | `/api/inventory/movements` | Get stock movement history |
| GET | `/api/inventory/adjustments` | Get adjustment history |
| POST | `/api/inventory/add-stock` | Add stock to a product |
| POST | `/api/inventory/remove-stock` | Remove stock from a product |
| POST | `/api/inventory/adjust-stock` | Manually adjust stock quantity |
| PATCH | `/api/inventory/{id}/reorder-level` | Update reorder level for a product |

### Sales
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/sales` | List sales transactions |
| POST | `/api/sales` | Create a sale transaction |

### User & Profile
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/users/me` | Get current user profile |
| GET | `/api/users` | List users (admin) |
| PATCH | `/api/users/me` | Update current user profile |

### Notifications
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/notifications` | List notifications |
| PATCH | `/api/notifications/{id}/read` | Mark notification as read |