# 🌟 RestroAstra — One platform. Every restaurant operation.

[![Node.js](https://img.shields.io/badge/Node.js-20+-68a063?logo=node.js)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-010101?logo=socket.io)](https://socket.io/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?logo=prisma)](https://www.prisma.io/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

**RestroAstra** is an enterprise-grade, multi-tenant restaurant operating system and digital dining platform. It seamlessly unifies contactless tabletop QR ordering, 3D culinary previews, real-time kitchen display (KOT), POS billing, live diner-to-staff messaging, daily financial reconciliation, and intelligent inventory tracking into a single, high-performance platform.

---

## 💎 Core Architecture & Capabilities

### 1. Contactless Table Dining (`/menu/[slug]`)
- **Zero App Download:** Instant access by scanning table QR codes.
- **Table Session Integrity:** Server-side verification binds orders to verified tabletop sessions, preventing order submission from outside or settled tables.
- **3D Food Exploration:** Interactive WebGL 3D model viewer (`<model-viewer>`) allowing guests to inspect dishes in 360°.
- **Bilingual Experience:** Instant 1-click toggle between **English** and **नेपाली (Nepali)**.
- **Cart & Order Submission:** Real-time price verification directly against database records to prevent client tampering.
- **Live Order Progression (`/order/[id]`):** Live stepper tracking (`Received` → `Preparing` → `Served`) powered by Socket.io.
- **Two-Way Table Chat:** Direct live messaging channel connecting diners with restaurant staff.
- **One-Click Waiter Call:** Real-time acoustic alert sent to the staff dashboard.
- **5-Star Post-Order Reviews:** Interactive dining rating, guest review notes, and celebratory confetti.

### 2. Kitchen Display & Operations Hub (`/dashboard`)
- **Live Orders Feed & Audio Chimes:** Instant order broadcast with browser Web Audio API acoustic bells.
- **1-Click Order Workflow:** Advance orders through Received, In Progress, Done, and Settled.
- **Printable Thermal Receipts & KOT:** Pre-formatted 80mm/58mm kitchen tickets and customer VAT invoices.
- **Menu Management (`/dashboard/menu`):** Add dishes, upload and auto-compress photos (WebP via Sharp), manage 3D GLB models, and toggle stock.
- **Realtime Table Chat (`/dashboard/chat`):** Manage active diner threads with instant replies.
- **Daily Financial Register & Reports (`/dashboard/reports`):** Opening/closing cash register balance, gross sales, payment breakdown (Cash vs. QR), and top-selling items.
- **Table QR Generator (`/dashboard/qr`):** High-resolution QR generator for individual tables and general menus with printable luxury table tent cards.
- **Ingredient & Inventory Management (`/dashboard/inventory`):** Ingredient tracking, low-stock threshold notifications, and usage deductions.

### 3. Platform Super Admin (`/admin`)
- **Multi-Tenant Administration:** Provision new restaurants, generate unique slugs, and assign credentials.
- **Subscription Lifecycle Control:** 1-click account status toggle (`pending` ↔ `active` ↔ `expired`).
- **Global Metrics:** Platform-wide volume, order counts, and tenant activity.
- **Credential Management:** Secure administrative password reset tools.

---

## 🛠️ Technology Stack

| Layer | Technology | Details |
|---|---|---|
| **Frontend & APIs** | Next.js 14.2 (App Router) | React 18, TypeScript, Tailwind CSS |
| **Realtime Engine** | Node.js HTTP + Socket.io 4.8 | Low-latency WebSockets with tenant-isolated rooms |
| **Database & ORM** | Prisma ORM 5.22 | SQLite (`restroastra.db`) or PostgreSQL (`restroastra_prod`) |
| **Media Processing** | Sharp 0.35 | Automatic EXIF orientation, WebP compression, 1400px resize |
| **Authentication** | JWT (`jsonwebtoken`) + `bcryptjs` | Multi-role HTTP-only cookies (`restroastra_hotel_token`, `restroastra_admin_token`) |
| **Process Manager** | PM2 | Configured as `restroastra-app` on internal port `3005` |

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy the example environment configuration:
```bash
cp .env.example .env
```
Default local port is configured to `3005` to prevent conflicts with other services.

### 3. Initialize Database & Seed
```bash
npx prisma generate
npx prisma db push
npm run prisma:seed
```

### 4. Run Development Server
```bash
npm run dev
```
Open **`http://localhost:3005`** in your browser.

- **Customer Menu Demo:** `http://localhost:3005/menu/sitan-dabaka-sekuwa?table=1&qr=1`
- **Staff Operations Hub:** `http://localhost:3005/dashboard/login` (Email: `sitan@sekuwacornor.com` | Password: `password123`)
- **Platform Super Admin:** `http://localhost:3005/admin/login` (Email: `admin@restroastra.com` | Password: `adminpassword123`)

### 🌐 Live Production Links (restroastra.com)
- **Live Production Domain:** [https://restroastra.com](https://restroastra.com)
- **Customer QR Menu:** [https://restroastra.com/menu/sitan-dabaka-sekuwa?table=1](https://restroastra.com/menu/sitan-dabaka-sekuwa?table=1)
- **Restaurant POS / Kitchen Hub:** [https://restroastra.com/dashboard/login](https://restroastra.com/dashboard/login)
- **Super Admin Portal:** [https://restroastra.com/admin/login](https://restroastra.com/admin/login)

---

## 🛡️ Production Deployment & Isolation (VPS)

RestroAstra is engineered to run alongside other websites on a shared VPS without interference:

### Key Isolation Points:
- **Dedicated Port:** Uses port `3005` (the original application uses 3000/3001).
- **Dedicated PM2 Process:** Named `restroastra-app`.
- **Dedicated Directory:** `/var/www/restroastra`.
- **Dedicated Database:** `restroastra_prod` (or SQLite `restroastra.db`).
- **Dedicated Cookies:** `restroastra_hotel_token` & `restroastra_admin_token`.
- **Nginx Upstream:** `restroastra_upstream` proxying `127.0.0.1:3005`.

### Deployment Steps on VPS:
1. Copy project files to `/var/www/restroastra`.
2. Configure `.env` with production secrets, port `3005`, and dedicated database credentials.
3. Install Nginx configuration from `nginx-vps.conf` into `/etc/nginx/sites-available/restroastra.conf`.
4. Link to `sites-enabled` and test Nginx:
   ```bash
   ln -s /etc/nginx/sites-available/restroastra.conf /etc/nginx/sites-enabled/
   nginx -t
   systemctl reload nginx
   ```
5. Issue SSL certificate via Certbot:
   ```bash
   certbot --nginx -d restroastra.com -d www.restroastra.com
   ```
6. Build and launch with PM2:
   ```bash
   ./deploy-vps.sh
   ```

---

## 📄 License & Attribution

Copyright © 2026 RestroAstra. All rights reserved.  
**RestroAstra — One platform. Every restaurant operation.**
