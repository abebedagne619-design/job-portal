# 🎯 AI-Powered Smart Job Portal & Recruitment Platform

A comprehensive, full-stack job portal designed to connect employers and applicants seamlessly. It features intelligent AI-driven job recommendations, real-time messaging, interview scheduling, and a powerful admin dashboard.

## 🚀 Key Features

### 👤 For Applicants

- **Authentication**: Secure JWT-based login/register + Google OAuth integration.
- **Job Search & Filtering**: Browse and search jobs by title, company, or description.
- **AI Recommendations**: Get personalized job matches based on your skills using a Python ML microservice.
- **Save Jobs**: Bookmark jobs to view or apply later.
- **Application Tracking**: Apply for jobs and track status (Pending, Reviewed, Accepted, Rejected).
- **Job Alerts**: Set alerts for specific keywords and locations.
- **Real-time Chat**: Message employers directly in real-time.

### 🏢 For Employers

- **Job Management**: Post, edit, and delete job listings.
- **Applicant Tracking**: View applications for your posted jobs and update their status.
- **Interview Scheduling**: Schedule interviews with applicants (Date, Time, Meeting Link).
- **Real-time Chat**: Communicate with applicants instantly.

### 👑 For Admins

- **Admin Dashboard**: Manage all users, jobs, and applications from a single interface.
- **Analytics**: View system stats, popular jobs, and application timelines.
- **Act as Sender**: (Testing feature) Send messages on behalf of any user for system demonstration.

## 🛠️ Tech Stack

### Frontend

- **React.js** (Vite) - Fast, modern UI.
- **React Router** - Client-side routing.
- **Context API** - State management.
- **Socket.IO Client** - Real-time WebSockets.
- **Custom CSS** - Responsive, dark-themed UI.

### Backend

- **Node.js & Express.js** - RESTful API server.
- **MySQL** (Port 3307) - Relational database with Foreign Keys.
- **JSON Web Tokens (JWT)** - Secure authentication.
- **Socket.IO** - Real-time bi-directional communication.
- **Bcrypt.js** - Password hashing.

### AI / Machine Learning Microservice

- **Python 3 & Flask** - Microservice architecture.
- **Scikit-learn** - TF-IDF Vectorizer & Cosine Similarity.
- **Pandas & NumPy** - Data manipulation.
- **Waitress** - Production WSGI server.

## 🏗️ System Architecture

1. **React Client** communicates via REST APIs for CRUD operations and WebSockets for real-time chat.
2. **Node.js Backend** handles authentication, business logic, MySQL database interactions, and Socket.IO connections.
3. **Python ML Service** is an independent microservice that receives user skills and returns ranked job recommendations based on content similarity.

## 📁 Project Structure

```text
job-portal/
├── client/                 # React Frontend (Vite)
│   ├── src/
│   │   ├── components/     # Navbar, Chat, JobAlerts, etc.
│   │   ├── pages/          # Messages, Recommendations, Admin Dashboard
│   │   └── context/        # Auth and Language contexts
│   └── package.json
│
├── server/                 # Node.js Backend
│   ├── routes/             # Express routes (messages, auth, etc.)
│   ├── server.js           # Main application entry point
│   └── .env                # Environment variables
│
└── ml-service/             # Python ML Microservice
    ├── recommendation_service.py # Flask App
    ├── requirements.txt    # Python dependencies
    └── venv/               # Virtual environment
```
