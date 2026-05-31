# E-Commerce Store — MERN + AI Agent Customer Support

A full-stack e-commerce platform built with the MERN stack, featuring Redis caching, Stripe payments, Cloudinary image hosting, and an **AI-powered customer support agent (ShopBot)** driven by Groq's LLaMA 3.1 model.

![Homepage](Screenshot%202024-12-08%20115707.png)
![Admin Dashboard](Screenshot%202024-12-08%20115857.png)

---

## Features

- **AI Agent Customer Support** — ShopBot answers product, shipping, returns, payment, and offer questions in real-time using Groq's LLaMA 3.1 8B Instant model with a dynamic store knowledge base
- **Redis Caching** — Upstash Redis caches featured products and JWT refresh tokens to reduce database load
- **Stripe Payments** — Full checkout session, coupon/discount support, and post-payment order recording
- **Cloudinary Image Hosting** — Admin product images uploaded directly to Cloudinary CDN
- **Admin Dashboard** — Create/delete products, toggle featured status, view sales analytics with Recharts
- **JWT Authentication** — Access + refresh token flow with HTTP-only cookies and Redis-backed token invalidation
- **Zustand State Management** — Lightweight global state for cart, user, and product data
- **Framer Motion Animations** — Smooth transitions across all pages
- **Docker Support** — Fully containerized with Docker Compose (frontend + backend + MongoDB)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion, Zustand |
| Backend | Node.js, Express 4 |
| Database | MongoDB (Mongoose) |
| Cache | Redis (Upstash via ioredis) |
| AI Agent | Groq API — `llama-3.1-8b-instant` |
| Payments | Stripe |
| Image Storage | Cloudinary |
| Containerization | Docker + Docker Compose |

---

## AI Agent Customer Support — ShopBot

ShopBot is the core AI feature of this project. It is a **tool-calling agent** embedded in the storefront that answers real questions about products, policies, offers, and store info using a two-pass LLM architecture.

### Agent Type

**Single Agent — Tool-Calling Architecture**

The LLM decides which tools to call. JavaScript executes them. The LLM then writes the final answer from the tool results. The LLM never answers from its own training data.

### How It Works

```
User Question
     │
     ▼
Pass 1 — LLM reads query + 8 tool definitions
     │    decides which tool(s) to call
     ▼
executeTool() — JavaScript fetches data from shopmart.json
     │
     ▼
Pass 2 — LLM reads tool results → writes natural response
     │
     ▼
Answer displayed to user
```

> The LLM does NOT execute tools directly. JavaScript is the agent that runs them.

### Architecture

**1. Knowledge Base (`Frontend/src/data/shopmart.json`)**

All store data is stored in a structured JSON file. ShopBot never answers from the LLM's training data — every response is grounded in this file:

- `store.contact` — Owner (Ansa Abid), phone, email, working hours
- `currentOffers` — Active promotions and discount codes
- `productInfo` — 7 categories: Jeans, Bags, Glasses, T-Shirts, Shoes, Jackets, Suits. Each includes types, materials, sizes, colors, price range, care tips, buying tips
- `policies` — Returns (7 days), shipping (standard 3–5 days, express 1–2 days), payments (COD, Card, JazzCash, EasyPaisa, Bank Transfer), cancellations
- `sellerProgram` — Registration steps, commission (5–15%), payout cycle (14 days)
- `orderTracking` — How to track + status definitions
- `faq` — 10 common Q&A pairs (fallback)

**2. Tools (8 Functions)**

The LLM selects from these tools based on the user's question:

| Tool | Fetches From | Triggered By |
|---|---|---|
| `get_offers` | `currentOffers` | "sale", "discount", "offer", "deal" |
| `get_categories` | Hardcoded list | "what do you have", "popular" |
| `get_product_info(category)` | `productInfo[category]` | "jeans", "bags", "shoes", etc. |
| `get_policy(type)` | `policies[type]` | "return", "ship", "pay", "cancel" |
| `get_order_tracking` | `orderTracking` | "track", "where is my order" |
| `get_seller_info` | `sellerProgram` | "sell", "become a seller" |
| `get_store_contact` | `store.contact` | "owner", "contact", "hours" |
| `get_faq` | `faq` | Fallback for unmatched questions |

**3. Two-Pass LLM Loop**

```js
// Pass 1 — tool selection
POST /openai/v1/chat/completions
{ model: "llama-3.1-8b-instant", messages, tools: TOOLS, tool_choice: "auto" }

// JavaScript executes the tool
const result = executeTool(toolName, args)   // reads shopmart.json

// Pass 2 — final answer
POST /openai/v1/chat/completions
{ model: "llama-3.1-8b-instant", messages: [...messages, assistantMsg, toolResult] }
```

**4. Agent Rules (System Prompt)**

- ShopMart sells ONLY 7 categories — any other product gets a polite redirect
- Always call a tool first — never answer from training data
- Use only the exact data returned by tools — no invented product names or details
- Never expose tool names, JSON, or XML tags in responses

**5. Safety & UX**

- Input capped at 200 characters
- Content filter blocks off-topic queries (politics, violence, etc.)
- 4 pre-built quick-question buttons for common topics
- Programmatic `get_faq` fallback when LLM returns no tool call
- Framer Motion spinner while awaiting response
- Dark theme UI with emerald/teal accents

### ShopBot UI

```
┌──────────────────────────────────────┐
│  🤖 ShopBot    Powered by Groq AI   │
├──────────────────────────────────────┤
│                                      │
│  [Bot]  Hi! I'm ShopBot...           │
│                                      │
│              [User] What's on sale?  │
│                                      │
│  [Bot]  We currently have the        │
│         Summer Mega Sale with up      │
│         to 50% off...                │
│                                      │
├──────────────────────────────────────┤
│  [Common: Shipping] [Returns] [...]  │
│  ┌────────────────────────────────┐  │
│  │ Ask a question...              │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

---

## Project Structure

```
E-Commerce-Store/
├── Backend/
│   ├── server.js                  # Entry point (port 8000)
│   ├── app.js                     # Express app + middleware
│   ├── routes/
│   │   ├── auth.route.js
│   │   ├── product.route.js
│   │   ├── cart.route.js
│   │   ├── coupon.route.js
│   │   ├── payment.route.js
│   │   └── analytic.route.js
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── product.controller.js
│   │   ├── cart.controller.js
│   │   ├── coupon.controller.js
│   │   ├── payment.controller.js
│   │   └── analytic.controller.js
│   ├── models/
│   │   ├── user.models.js
│   │   ├── product.model.js
│   │   ├── order.model.js
│   │   └── coupon.model.js
│   ├── middlewares/
│   │   └── auth.middleware.js     # protectedRoute, adminRoute
│   ├── db/
│   │   └── dbConnection.js
│   └── utils/
│       ├── redis.js
│       ├── cloudinary.js
│       ├── stripeConfig.js
│       ├── asyncHandler.js
│       ├── ApiError.js
│       └── ApiResponse.js
│
├── Frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── HomePage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   ├── SignUpPage.jsx
│   │   │   ├── CategoryPage.jsx
│   │   │   ├── CartPage.jsx
│   │   │   ├── AdminPage.jsx
│   │   │   ├── CustomerSupport.jsx    # ShopBot AI agent
│   │   │   ├── PurchaseSuccessPage.jsx
│   │   │   └── PurchaseCancelPage.jsx
│   │   ├── components/
│   │   │   ├── NavBar.jsx
│   │   │   ├── ProductCard.jsx
│   │   │   ├── FeaturedProducts.jsx
│   │   │   ├── AnalyticsTab.jsx
│   │   │   ├── CreateProductForm.jsx
│   │   │   └── ...
│   │   ├── stores/
│   │   │   ├── useProductStore.js
│   │   │   ├── useCartStore.js
│   │   │   └── useUserStore.js
│   │   ├── data/
│   │   │   └── shopmart.json          # ShopBot knowledge base
│   │   └── lib/
│   │       └── axios.js
│   └── public/                        # Product images
│
├── docker-compose.yaml
├── Dockerfile
└── .env
```

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT cookies |
| POST | `/api/auth/logout` | Logout, clears cookies |
| POST | `/api/auth/refresh` | Refresh access token via Redis |
| GET | `/api/auth/profile` | Get current user (protected) |

### Products
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/products/getAllProducts` | All products (admin) |
| GET | `/api/products/featured` | Featured products (Redis cached) |
| GET | `/api/products/category/:category` | Products by category |
| GET | `/api/products/recommendation` | 3 random recommendations |
| POST | `/api/products/createProduct` | Create product (admin) |
| PATCH | `/api/products/toggle-Featured-Product/:id` | Toggle featured (admin) |
| DELETE | `/api/products/deleteProduct/:id` | Delete product (admin) |

### Cart, Coupons & Payments
| Method | Endpoint | Description |
|---|---|---|
| GET/POST/DELETE | `/api/cart` | Manage cart items |
| POST | `/api/coupons/validate` | Validate coupon code |
| POST | `/api/payments/create-checkout-session` | Create Stripe session |
| POST | `/api/payments/checkout-success` | Record order after payment |

---

## Getting Started

### Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)
- Redis (local or Upstash)
- Accounts: Groq, Stripe, Cloudinary

### 1. Clone the repository

```bash
git clone https://github.com/22-20911-009/E-commerce.git

cd E-Commerce-Store
```

### 2. Environment Setup

**Root `.env` (Backend):**

```env
PORT=8000
CORS_ORIGIN=http://localhost:5173
MONGO_URI=your_mongodb_connection_string
UPSTASH_REDIS_URL=your_upstash_redis_url
ACCESS_TOKEN_SECRET=your_access_token_secret
REFRESH_TOKEN_SECRET=your_refresh_token_secret
CLOUDINARY_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
STRIPE_SECRET_KEY=your_stripe_secret_key
CLIENT_URL=http://localhost:5173
```

**`Frontend/.env`:**

```env
VITE_GROQ_API_KEY=your_groq_api_key
VITE_STRIPE_PUBLISH_KEY=your_stripe_publishable_key
```

Get your Groq API key at [console.groq.com](https://console.groq.com).

### 3. Install dependencies

```bash
# Backend
npm install

# Frontend
cd Frontend
npm install
```

### 4. Run the application

**Development (two terminals):**

```bash
# Terminal 1 — Backend (port 8000)
npm run dev

# Terminal 2 — Frontend (port 5173)
cd Frontend
npm run dev
```

### 5. Run with Docker

```bash
docker-compose up --build
```

Services started:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- MongoDB: `localhost:27017`

---

## Database Models

### User
```js
{ name, email, password (bcrypt), role: "customer"|"admin", cartItems: [] }
```

### Product
```js
{ name, description, price, image (Cloudinary URL), category, isFeatured }
```

### Order
```js
{ user (ref), products: [{ product, quantity, price }], totalAmount, StripeSessionId }
```

### Coupon
```js
{ code, discountPercentage, expiryDate, userId, isActive }
```

---

## Contributing

Contributions are welcome. Fork the repository, create a feature branch, and open a pull request.

1. Fork the repo
2. Create a branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m "Add your feature"`
4. Push: `git push origin feature/your-feature`
5. Open a pull request

---

## License

MIT