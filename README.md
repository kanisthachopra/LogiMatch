# LogiMatch

## Project Overview

LogiMatch is a logistics marketplace for small and medium-sized enterprises that need a clearer and more efficient way to find transport services.

Many businesses currently arrange deliveries through phone calls, WhatsApp messages, or a small personal contact list. This makes the process inefficient and unclear. Customers may not know whether the quoted price is fair, while smaller logistics providers may lose potential customers simply because they are not visible to a wider market.

LogiMatch aims to solve this by creating a platform where service seekers can post logistics requests and logistics providers can view available jobs and submit offers. The long-term goal is to make logistics procurement more transparent, competitive, and organized.

---

## Target Level of Achievement

**Apollo 11**

We are targeting Apollo 11 because we aim to build a complete full-stack web application with proper user flows, authentication, dashboards, bidding logic, documentation, testing, and meaningful extensions beyond a basic CRUD application.

---

## Problem Motivation

SME logistics often suffers from the following issues:

* Service seekers depend on limited personal contacts.
* Price discovery is unclear and often based on guesswork.
* Logistics providers, especially smaller ones, may not have a good digital channel to find customers.
* Communication and negotiation are scattered across informal channels.
* There is limited visibility into provider reliability, availability, or past performance.

LogiMatch is intended to reduce this information gap by giving both sides a centralized platform to interact.

---

## Proposed Solution

LogiMatch will support two main user groups:

1. **Service Seekers**
   Users who need logistics or transport services.

2. **Logistics Providers**
   Users who offer transport or delivery services.

The platform will allow seekers to create delivery job requests with relevant details such as pickup location, drop-off location, cargo details, timing, and vehicle requirements. Providers will be able to view these requests and submit offers.

Our bidding system is planned as a **timed asynchronous reverse bidding system**, not a real-time auction. This means providers can submit or update bids within a given time window, and seekers can compare the available offers before choosing a provider.

---

## Core Features

### Planned Core Features

* User registration and login
* Separate user roles for seekers and providers
* Basic user profile page
* Home page with clear navigation
* Seeker dashboard
* Provider dashboard
* Delivery job request creation
* Job listing page for providers
* Timed reverse bidding for custom jobs
* Bid comparison for seekers
* Basic ratings or trust indicators

### Possible Extension Features

* Recommended price ranges
* More advanced filtering for jobs
* Secure negotiation thread for each job
* Notifications for bid updates and accepted jobs
* Improved provider profiles
* User testing and UI refinements

---

## Milestone 1 Scope

Milestone 1 focuses on ideation, system design, and building a basic technical proof of concept.

For this milestone, our focus is not to complete the full application. Instead, we aim to build a strong foundation that later features can be added onto.

### Milestone 1 Goals

By Milestone 1, we aim to have:

* A clearly defined project idea
* Problem motivation and target users
* Core features and user stories
* Initial system design
* Initial development plan
* Basic frontend, backend, and database connection
* Simple user login/register flow
* Basic homepage structure
* Basic profile page showing user information
* Initial prototype of the first core feature: creating and viewing logistics job requests
* Local setup instructions for running the project
* Updated README, project log, poster, and video

---


## Current Milestone 1 Progress

At Milestone 1, the project is in the ideation and early prototype stage.

Current focus areas:

* Setting up the project repository
* Learning and finalizing the chosen tools
* Building the basic full-stack structure
* Implementing authentication basics
* Creating the first version of the homepage
* Creating a basic profile page
* Prototyping the delivery request flow
* Documenting the system design and project plan

The current prototype is intended to show that the basic application structure works locally and that the frontend, backend, and database can be connected.

---

## Planned Tech Stack

The exact implementation may be refined as development progresses, but our planned stack is:

* **Frontend:** Next.js / React
* **Backend:** Node.js / Express
* **Database:** PostgreSQL
* **API style:** REST APIs
* **Authentication:** To be finalized during development
* **Version control:** Git and GitHub
* **Testing:** Basic system testing and selected automated tests as the project grows

This stack was chosen because it supports a clear separation between frontend, backend, and database, while still being manageable for a summer software engineering project.

---


## Basic User Flow

```text
1. User opens LogiMatch
2. User registers or logs in
3. User selects or is assigned a role: seeker or provider
4. Seeker creates a delivery job request
5. Provider views available job requests
6. Provider submits an offer within the bidding window
7. Seeker compares available offers
8. Seeker chooses a suitable provider
```

For Milestone 1, we are mainly focusing on steps 1 to 5.

---


## How to Run Locally

This project is intended to be run locally for Milestone 1. Online deployment is not required at this stage.

### 1. Install Required Software

Before running the project, install the following:

* **Git**
* **Node.js**
* **npm**
* **PostgreSQL** if the database is already connected in the current version

You can check whether they are installed by running:

```bash
git --version
node --version
npm --version
```

If PostgreSQL is being used in the current version, also check:

```bash
psql --version
```

### 2. Clone the Repository

```bash
git clone <repository-link>
cd <repository-folder>
```

### 3. Install Dependencies

If the project has separate frontend and backend folders, install dependencies in both.

For the frontend:

```bash
cd frontend
npm install
```

For the backend:

```bash
cd backend
npm install
```

If the project uses different folder names, replace `frontend` and `backend` with the correct folder names.

### 4. Set Up Environment Variables

Create the required environment file based on the example file provided in the repository.

For example:

```bash
cp .env.example .env
```

Then fill in the required values such as database URL, authentication secret, or backend port.

### 5. Start the Backend

```bash
cd backend
npm run dev
```

The backend should start on the port specified in the environment file.

### 6. Start the Frontend

Open a new terminal window.

```bash
cd frontend
npm run dev
```

The frontend should usually be available at:

```text
http://localhost:3000
```

### 7. Basic Demo Flow

Once the application is running locally:

1. Open the frontend in the browser.
2. Register a new account.
3. Log in.
4. View the homepage.
5. Open the profile page.
6. Create or view a sample logistics job request, depending on the current prototype state.

---
## Summary

LogiMatch aims to make SME logistics procurement more transparent by connecting service seekers and logistics providers through a structured digital platform.

For Milestone 1, our priority is to establish a solid foundation: a clear project idea, core feature plan, basic system design, local full-stack setup, and an early prototype of the main user flow.
