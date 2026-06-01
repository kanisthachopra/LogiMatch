# LogiMatch 🚚

A logistics marketplace for small and medium-sized enterprises — connecting service seekers with logistics providers through a transparent, competitive bidding platform.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Problem Motivation](#problem-motivation)
- [Proposed Solution](#proposed-solution)
- [Core Features](#core-features)
- [Tech Stack](#tech-stack)
- [Basic User Flow](#basic-user-flow)
- [Getting Started](#getting-started)
  - [1. System Prerequisites](#1-system-prerequisites)
  - [2. Database Setup](#2-database-setup)
  - [3. Clone & Install Dependencies](#3-clone--install-dependencies)
  - [4. Configure Environment Variables](#4-configure-environment-variables)
  - [5. Run the Application](#5-run-the-application)
  - [6. Basic Demo Flow](#6-basic-demo-flow)
- [Milestone 1 Scope & Progress](#milestone-1-scope--progress)

---

## Project Overview

LogiMatch is a logistics marketplace designed for SMEs that need a clearer and more efficient way to find transport services.

Many businesses currently arrange deliveries through phone calls, WhatsApp messages, or a small personal contact list — making the process inefficient and opaque. Customers may not know whether a quoted price is fair, while smaller logistics providers may lose potential customers simply because they aren't visible to a wider market.

LogiMatch solves this by creating a platform where **service seekers** can post logistics requests and **logistics providers** can view available jobs and submit competitive offers. The long-term goal is to make logistics procurement more transparent, competitive, and organized.

> **Target Achievement Level: Apollo 11**
> We aim to build a complete full-stack web application with proper user flows, authentication, dashboards, bidding logic, documentation, testing, and meaningful extensions beyond a basic CRUD application.

---

## Problem Motivation

SME logistics often suffers from the following issues:

- Service seekers depend on a limited personal contact list
- Price discovery is unclear and often based on guesswork
- Smaller logistics providers lack a digital channel to find customers
- Communication and negotiation are scattered across informal channels
- Limited visibility into provider reliability, availability, or past performance

LogiMatch aims to reduce this information gap by giving both sides a centralized platform to interact.

---

## Proposed Solution

LogiMatch supports two main user groups:

1. **Service Seekers** — Users who need logistics or transport services
2. **Logistics Providers** — Users who offer transport or delivery services

Seekers create delivery job requests with relevant details (pickup, drop-off, weight). Providers can view these requests and submit competitive offers through a **timed asynchronous reverse bidding system** — providers submit or update bids within a given time window, and seekers can compare offers before choosing a provider.

---

## Core Features

### Planned Core Features

- User registration and login
- Separate user roles for Seekers and Providers
- Basic user profile page
- Home page with clear navigation
- Seeker dashboard / Provider dashboard (Unified Market View)
- Delivery job request creation
- Job listing page for providers
- Timed reverse bidding for custom jobs
- Bid comparison for seekers

### Possible Extension Features

- Recommended price ranges
- Advanced filtering for job listings
- Secure negotiation thread per job
- Notifications for bid updates and accepted jobs
- Improved provider profiles

---

## Tech Stack

* **Frontend:** Next.js / React, Tailwind CSS
* **Backend:** Node.js / Express
* **Database:** PostgreSQL
* **API style:** REST APIs

---

## Basic User Flow

```
1. User opens LogiMatch
2. User registers or logs in
3. User selects a role: Seeker or Provider
4. Seeker creates a delivery job request
5. Provider views available job requests on the Open Market
6. Provider submits an offer
7. Seeker compares available offers in their Profile
8. Seeker accepts the optimal bid
```

---

## Getting Started

### 1. System Prerequisites

Install the following tools before running the project.

#### A. Node.js & npm

- **Requirement:** Node.js version 18.x or 20.x (LTS)
- **Installation:** Download from the [official Node.js website](https://nodejs.org/). npm is included automatically.
- **Verification:**

```bash
node --version
npm --version
```

#### B. PostgreSQL

- **Requirement:** PostgreSQL version 14 or higher
- **Installation:** Download from the [official PostgreSQL downloads page](https://www.postgresql.org/download/)
- **Important:** Note the password you set for the default `postgres` superuser — you will need it later. We recommend keeping the default port `5432`.
- **Verification:**

```bash
psql --version
```

#### C. Git

- **Installation:** Download from [git-scm.com](https://git-scm.com/)

---

### 2. Database Setup

Open your PostgreSQL command line tool (`psql`) or pgAdmin.

**Create the project database:**

```sql
CREATE DATABASE logimatch;
```

**Connect to `logimatch` and create the required tables:**

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL
);

CREATE TABLE jobs (
    id SERIAL PRIMARY KEY,
    seeker_id INTEGER REFERENCES users(id),
    origin VARCHAR(100) NOT NULL,
    destination VARCHAR(100) NOT NULL,
    weight_kg NUMERIC NOT NULL,
    status VARCHAR(50) DEFAULT 'open'
);

CREATE TABLE bids (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES jobs(id),
    provider_id INTEGER REFERENCES users(id),
    amount NUMERIC NOT NULL,
    status VARCHAR(50) DEFAULT 'pending'
);
```

---

### 3. Clone & Install Dependencies

**Clone the repository:**

```bash
git clone https://github.com/kanisthachopra/LogiMatch
cd <repository-folder>
```

**Set up the Backend:**

```bash
cd backend
npm install
```

**Set up the Frontend** (open a new terminal window):

```bash
cd frontend
npm install
```

---

### 4. Configure Environment Variables

Navigate to the `backend` folder and create a `.env` file:

```bash
cd backend
touch .env
```

Add the following to `.env`, replacing `your_postgres_password` with the password set during PostgreSQL installation:

```env
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=logimatch
JWT_SECRET=super_secret_key_123
PORT=5000
```

---

### 5. Run the Application

**Start the Backend** (in your `backend` terminal):

```bash
node server.js
```

> You should see: `Server is operating on port 5000`

**Start the Frontend** (in your `frontend` terminal):

```bash
npm run dev
```

> The frontend will be available at **http://localhost:3000**

---

### 6. Basic Demo Flow

1. Open [http://localhost:3000/register](http://localhost:3000/register) and register **two accounts** — one as a Seeker, one as a Provider.
2. Log in as the **Seeker** and post a job from the Dashboard.
3. Log out, then log in as the **Provider** to view the Open Market and submit a bid.
4. Log back in as the **Seeker**, navigate to **My Profile → Jobs I Posted**, and accept the winning bid.

---

## Milestone 1 Scope & Progress

Milestone 1 focuses on ideation, system design, and building a basic technical proof of concept. The priority is establishing a solid foundation: a clear project idea, core feature plan, basic system design, local full-stack setup, and an early prototype of the main user flow.

**Current Progress:**

- [x] Setting up the project repository
- [x] Learning and finalizing the chosen tools
- [x] Building the basic full-stack structure
- [x] Implementing authentication basics (JWT & bcrypt)
- [x] Creating a unified dashboard and basic profile page
- [x] Prototyping the delivery request flow and live-auction bid viewing
