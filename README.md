\# ML Recommendation Service for Job Portal
AI-powered job recommendation system using Machine Learning.
\## 🚀 Features
\- 🤖 \*\*Content-based Recommendations\*\* using TF-IDF
\- 📊 \*\*Popular Jobs\*\* based on views and applications
\- 🔍 \*\*Similar Jobs\*\* recommendations
\- 📝 \*\*User Feedback\*\* collection for model improvement
\- 👤 \*\*Personalized\*\* job suggestions based on user skills
\## 🛠 Technologies
\- \*\*Framework:\*\* Flask
\- \*\*ML Libraries:\*\* scikit-learn, Pandas, NumPy
\- \*\*Database:\*\* MySQL
\- \*\*Server:\*\* Waitress
\## 📦 Installation
\### Prerequisites
\- Python 3.8+
\- MySQL Server
\### Setup
```bash
\# Clone repository
git clone https://github.com/abebedagne619-design/ml-service.git
cd ml-service
\# Create virtual environment
python -m venv venv
\# Activate virtual environment
\# Windows:
venv\\Scripts\\activate
\# Linux/Mac:
source venv/bin/activate
\# Install dependencies
pip install -r requirements.txt
\# Configure environment
cp .env.example .env
\# Update .env with your database credentials
\# Run the service
python recommendation\_service.py

