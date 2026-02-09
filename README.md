# Crypto Portfolio Tracker

A professional-grade crypto portfolio tracking application built with Next.js 14, Hyperliquid SDK, and CCXT.

## Features

- **Real-time Portfolio Tracking**: Aggregated view of assets across EVM, Solana, and CEXs.
- **Advanced Futures Analytics**: 
  - Lifetime PNL & Drawdown Charts
  - Win Rate, Profit Factor, and Volume metrics
  - Session Analysis (Day of Week, Time of Day)
- **Fee Analysis**: Market vs Limit fee ratio for Spot and Futures.
- **Unified Interface**: Premium dark-mode UI with sortable tables and real-time updates.

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   Create a `.env` file in the root directory (if not already present) and add your API keys:
   ```env
   # Optional: For specialized data fetching
   NEXT_PUBLIC_HYPERLIQUID_API_URL=https://api.hyperliquid.xyz
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```

4. **Build for Production**
   ```bash
   npm run build
   npm start
   ```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: TailwindCSS + Shadcn/UI
- **Data Fetching**: TanStack Query
- **Charts**: Recharts
- **Exchanges**: CCXT (Binance, Bybit), Hyperliquid SDK

## Project Structure

- `/src/app`: App router pages and API routes
- `/src/components`: UI components (Dashboard, Charts, Shared)
- `/src/hooks`: Custom React hooks for data fetching
- `/src/lib`: Utility functions and API clients
