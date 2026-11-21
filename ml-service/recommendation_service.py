from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import mysql.connector.pooling  # ✅ Connection Pool ለመጠቀም
import json
import logging
from datetime import datetime
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import make_pipeline
# አዲሱ ሰርቨር እዚህ ተጨምሯል
from waitress import serve

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Database configuration
DB_CONFIG = {
    'host': '127.0.0.1',
    'user': 'root',
    'password': '',
    'database': 'jobportal',
    'port': 3307
}

# ✅ Connection Pool ፍጠር (ለፍጥነት እና ድግግሞሽ ለመከላከል)
db_pool = mysql.connector.pooling.MySQLConnectionPool(
    pool_name="mypool",
    pool_size=5,
    **DB_CONFIG
)

def get_db_connection():
    """Create and return a database connection from pool"""
    try:
        conn = db_pool.get_connection()
        return conn
    except mysql.connector.Error as err:
        logger.error(f"Database connection error: {err}")
        return None

def get_user_skills(user_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # ስህተት የነበረው እዚህ ነበር - 'skill' ተብሎ ተስተካክሏል
        cursor.execute('SELECT skill FROM user_skills WHERE user_id = %s', (user_id,))
        skills = cursor.fetchall()
        cursor.close()
        conn.close()
        
        return [s[0] for s in skills] if skills else []
    except Exception as e:
        logger.error(f"Error fetching skills: {e}")
        return []

def get_all_jobs():
    """Get all jobs from database"""
    conn = get_db_connection()
    if not conn:
        return []
    
    cursor = conn.cursor(dictionary=True)
    # ✅ requirements የሚለው ኮለም እዚህ ተጨምሯል እንዲሁም LIMIT 100 በመጨመር ፍጥነቱን እናሻሽላለን
    cursor.execute('SELECT id, title, description, company, location, type, salary, requirements FROM jobs ORDER BY created_at DESC LIMIT 100')
    jobs = cursor.fetchall()
    cursor.close()
    conn.close()
    
    return jobs

def get_viewed_jobs(user_id):
    """Get jobs that user has already viewed"""
    conn = get_db_connection()
    if not conn:
        return []
    
    cursor = conn.cursor()
    cursor.execute('SELECT job_id FROM job_views WHERE user_id = %s', (user_id,))
    viewed = [row[0] for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    
    return viewed

def get_applied_jobs(user_id):
    """Get jobs that user has already applied to"""
    conn = get_db_connection()
    if not conn:
        return []
    
    cursor = conn.cursor()
    cursor.execute('SELECT job_id FROM applications WHERE user_id = %s', (user_id,))
    applied = [row[0] for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    
    return applied

def get_user_by_id(user_id):
    """Get user information by ID"""
    conn = get_db_connection()
    if not conn:
        return None
    
    cursor = conn.cursor(dictionary=True)
    cursor.execute('SELECT id, name, email, role FROM users WHERE id = %s', (user_id,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()
    
    return user

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    print("\n" + "="*60)
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 🏥 HEALTH CHECK REQUESTED")
    print("="*60)
    print("✅ ML Service is running properly")
    print(f"📡 Endpoint: /health")
    print(f"🌐 URL: http://localhost:5001/health")
    print("="*60 + "\n")
    
    return jsonify({
        'status': 'healthy',
        'service': 'ML Recommendation Service',
        'version': '1.0.0',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/popular', methods=['GET'])
def get_popular_jobs():
    """Get popular jobs based on views and applications"""
    print("\n" + "="*60)
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 📊 POPULAR JOBS REQUESTED")
    print("="*60)
    
    conn = get_db_connection()
    if not conn:
        print("❌ Database connection failed")
        return jsonify([])
    
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT j.*, 
                (SELECT COUNT(*) FROM job_views WHERE job_id = j.id) as view_count,
                (SELECT COUNT(*) FROM applications WHERE job_id = j.id) as apply_count
        FROM jobs j
        ORDER BY (view_count + apply_count * 2) DESC
        LIMIT 20
    """)
    popular_jobs = cursor.fetchall()
    cursor.close()
    conn.close()
    
    print(f"✅ Found {len(popular_jobs)} popular jobs")
    for job in popular_jobs[:5]:
        print(f"    📌 {job['title']} - {job['company']} (Views: {job['view_count']}, Apps: {job['apply_count']})")
    if len(popular_jobs) > 5:
        print(f"    ... and {len(popular_jobs) - 5} more")
    print("="*60 + "\n")
    
    return jsonify(popular_jobs)

@app.route('/recommend', methods=['POST'])
def recommend():
    """Get job recommendations for a user based on provided skills"""
    data = request.json
    user_id = data.get('userId')
    # ከ Node.js የመጡ ክህሎቶች (ካሉ)
    incoming_skills = data.get('skills') 
    
    print("\n" + "="*60)
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 🤖 RECOMMENDATION REQUESTED")
    print("="*60)
    print(f"👤 User ID: {user_id}")
    
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400
    
    # 1. ክህሎቶችን ማዘጋጀት
    # ከ Node.js ክህሎቶች ከመጡ እነሱን ይጠቀማል፣ ካልመጡ ከዳታቤዝ ይፈልጋል
    if incoming_skills and len(incoming_skills) > 0:
        user_skills = incoming_skills
        print(f"📝 Using skills from request: {user_skills}")
    else:
        user_skills = get_user_skills(user_id)
        print(f"📝 Using skills from database: {user_skills}")

    viewed_jobs = get_viewed_jobs(user_id)
    applied_jobs = get_applied_jobs(user_id)
    jobs = get_all_jobs()
    
    if not jobs:
        return jsonify([])
    
    # 2. የጽሁፍ ማነጻጸሪያ (TF-IDF) ዝግጅት
    job_texts = []
    for job in jobs:
        # Title እና Description በማጣመር የተሻለ ውጤት እንዲመጣ እናደርጋለን
        text = f"{str(job['title'] or '')} {str(job['description'] or '')} {str(job['company'] or '')}"
        job_texts.append(text.lower())
    
    # ክህሎቶቹን ወደ አንድ ጽሁፍ መቀየር
    if user_skills:
        user_skills_text = " ".join(user_skills).lower() if isinstance(user_skills, list) else user_skills.lower()
    else:
        user_skills_text = "software developer programming" # Default keyword

    all_texts = [user_skills_text] + job_texts
    
    try:
        vectorizer = TfidfVectorizer(stop_words='english', max_features=5000)
        tfidf_matrix = vectorizer.fit_transform(all_texts)
        
        # የመጀመሪያው (Index 0) የተጠቃሚው ክህሎት ነው፣ ከቀሪዎቹ ስራዎች ጋር እናነጻጽራለን
        similarity_scores = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:]).flatten()
        
        candidates = []
        for idx, score in enumerate(similarity_scores):
            job = jobs[idx]
            
            # ያመለከተባቸውን ስራዎች እናስወግዳለን
            if job['id'] not in applied_jobs:
                final_score = float(score)
                # ቀድሞ ያያቸው ስራዎች ከሆኑ ውጤቱን ዝቅ እናደርጋለን (ለአዲስ ስራ ቅድሚያ ለመስጠት)
                if job['id'] in viewed_jobs:
                    final_score = final_score * 0.7 
                
                candidates.append({
                    'id': job['id'],
                    'title': job['title'],
                    'company': job['company'],
                    'location': job['location'],
                    'type': job['type'],
                    'salary': job['salary'],
                    'similarity_score': final_score
                })
        
        # በከፍተኛ ውጤት ቅደም ተከተል መደርደር
        recommendations = sorted(candidates, key=lambda x: x['similarity_score'], reverse=True)
        
        print(f"✅ Returning {len(recommendations[:10])} recommendations")
        print("="*60 + "\n")
        
        return jsonify(recommendations[:10])
        
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/recommend-cv', methods=['POST'])
def recommend_cv():
    data = request.json
    user_id = data.get('userId')
    cv_text = data.get('cvText')

    if not user_id or not cv_text:
        return jsonify({'error': 'User ID and CV Text required'}), 400

    print("\n" + "="*60)
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 📄 CV RECOMMENDATION REQUESTED")
    print("="*60)
    print(f"👤 User ID: {user_id}")
    print(f"📝 CV Length: {len(cv_text)} characters")

    jobs = get_all_jobs()
    if not jobs:
        return jsonify([])

    job_texts = []
    for job in jobs:
        reqs = job.get('requirements', '') or ''
        text = f"{str(job['title'] or '')} {str(job['description'] or '')} {reqs} {str(job['company'] or '')}"
        job_texts.append(text.lower())

    import re
    cv_text_clean = re.sub(r'[^a-zA-Z0-9\s]', '', cv_text.lower())

    all_texts = [cv_text_clean] + job_texts

    try:
        vectorizer = TfidfVectorizer(stop_words='english', max_features=5000)
        tfidf_matrix = vectorizer.fit_transform(all_texts)
        
        similarity_scores = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:]).flatten()
        
        max_raw_score = max(similarity_scores) if len(similarity_scores) > 0 else 0

        candidates = []
        for idx, score in enumerate(similarity_scores):
            job = jobs[idx]
            
            # ✅ እዚህ ጋር ውጤቱን ወደ 0.0 - 1.0 እንመልሰዋለን (ለ React 100 ማባዛት)
            if max_raw_score > 0:
                base_score = (float(score) / max_raw_score) * 0.85 # 0.85 ማለት 85%
            else:
                base_score = 0.10 # 0.10 ማለት 10%

            job_title_lower = str(job['title'] or '').lower()
            title_words = job_title_lower.split()
            
            title_match_bonus = 0
            for word in title_words:
                if len(word) > 3 and word in cv_text_clean:
                    title_match_bonus += 0.10 # ለእያንዳንዱ ቃል 0.10 (10%) ጨምር
            
            final_score = base_score + title_match_bonus
            
            # ውጤቱ ከ 98% እንዳይበልጥ እና ከ 5% እንዳያንስ ማስተካከል
            if final_score > 0.98: final_score = 0.98
            if final_score < 0.05: final_score = 0.05
            
            candidates.append({
                'id': job['id'],
                'title': job['title'],
                'company': job['company'],
                'location': job['location'],
                'type': job['type'],
                'salary': job['salary'],
                'similarity_score': round(final_score, 2) # ለምሳሌ 0.85 ይመልሳል
            })
        
        recommendations = sorted(candidates, key=lambda x: x['similarity_score'], reverse=True)
        
        top_score = round(recommendations[0]['similarity_score'] * 100, 2) if recommendations else 0
        print(f"✅ Found {len(recommendations)} matches. Top score: {top_score}%")
        print("="*60 + "\n")
        
        return jsonify(recommendations[:10])
        
    except Exception as e:
        logger.error(f"Error in CV recommendation: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
# ============= FAKE JOB DETECTION =============
# ✅ ሞዴሉን በአንድ ጊዜ እናሰራው (Train)
fake_jobs_data = [
    ("Earn $5000 a week from home. No experience needed. Send fee.", 1),
    ("Urgent hiring! Just pay registration fee and start today.", 1),
    ("Work 2 hours a day and earn thousands. Contact on Telegram.", 1),
    ("Easy money! Send your bank details to start working.", 1),
    ("We need a senior software engineer with React and Node.js.", 0),
    ("Looking for a data analyst. Must know Python, SQL, and Excel.", 0),
    ("Full time frontend developer needed in Addis Ababa. 3 years exp.", 0),
    ("Medical doctor needed for a local hospital. Must have MD.", 0),
    ("Make money fast working from your phone. Click here!", 1),
    ("Accountant needed. Bachelor's degree required. Competitive salary.", 0)
]
X_train = [text for text, label in fake_jobs_data]
y_train = [label for text, label in fake_jobs_data]

# ቀላል የ ML ሞዴል (Naive Bayes) በመጠቀም
fake_model = make_pipeline(TfidfVectorizer(), MultinomialNB())
fake_model.fit(X_train, y_train)

@app.route('/detect-fake', methods=['POST'])
def detect_fake():
    data = request.json
    title = data.get('title', '')
    description = data.get('description', '')
    
    if not description:
        return jsonify({'error': 'Description required'}), 400

    print("\n" + "="*60)
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 🚨 FAKE JOB DETECTION REQUESTED")
    print(f"📋 Title: {title}")
    
    text_to_check = f"{title} {description}".lower()
    
    # ሞዴሉ ትንበያ እንዲሰጥ ማድረግ
    prediction = fake_model.predict([text_to_check])[0]
    probabilities = fake_model.predict_proba([text_to_check])[0]
    
    is_fake = bool(prediction == 1)
    confidence = float(max(probabilities)) * 100
    
    print(f"🤖 Result: {'FAKE ⚠️' if is_fake else 'REAL ✅'} (Confidence: {confidence:.2f}%)")
    print("="*60 + "\n")
    
    return jsonify({
        'is_fake': is_fake,
        'confidence': round(confidence, 2),
        'message': '⚠️ Warning: This job looks suspicious!' if is_fake else '✅ This job appears to be legitimate.'
    })

@app.route('/train', methods=['POST'])
def train_model():
    """Train or update the recommendation model"""
    print("\n" + "="*60)
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 🧠 TRAINING REQUESTED")
    print("="*60)
    print("⚠️ This is a placeholder. Implement actual training logic here.")
    print("="*60 + "\n")
    
    return jsonify({
        'message': 'Model training initiated',
        'status': 'success',
        'note': 'This is a placeholder. Implement actual training logic here.'
    })

@app.route('/feedback', methods=['POST'])
def submit_feedback():
    """Submit user feedback on recommendations"""
    data = request.json
    user_id = data.get('userId')
    job_id = data.get('jobId')
    feedback = data.get('feedback')  # 'like', 'dislike', 'view', 'apply'
    
    print("\n" + "="*60)
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 📝 FEEDBACK RECEIVED")
    print("="*60)
    print(f"👤 User ID: {user_id}")
    print(f"📋 Job ID: {job_id}")
    print(f"💬 Feedback: {feedback}")
    
    if not user_id or not job_id:
        print("❌ Error: User ID and Job ID required")
        return jsonify({'error': 'User ID and Job ID required'}), 400
    
    # Store feedback for future model improvement
    conn = get_db_connection()
    if conn:
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO recommendation_feedback (user_id, job_id, feedback, created_at)
                VALUES (%s, %s, %s, NOW())
            """, (user_id, job_id, feedback))
            conn.commit()
            print(f"✅ Feedback recorded successfully")
            logger.info(f"Feedback recorded: user={user_id}, job={job_id}, feedback={feedback}")
        except Exception as e:
            print(f"❌ Error saving feedback: {e}")
            logger.error(f"Error saving feedback: {e}")
        finally:
            cursor.close()
            conn.close()
    else:
        print("❌ Database connection failed")
    
    print("="*60 + "\n")
    return jsonify({'message': 'Feedback recorded successfully'})

@app.route('/similar/<int:job_id>', methods=['GET'])
def get_similar_jobs(job_id):
    """Get jobs similar to a given job"""
    print("\n" + "="*60)
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 🔍 SIMILAR JOBS REQUESTED")
    print("="*60)
    print(f"📋 Job ID: {job_id}")
    
    jobs = get_all_jobs()
    
    if not jobs:
        print("❌ No jobs found in database")
        return jsonify([])
    
    # Find the target job
    target_job = None
    for job in jobs:
        if job['id'] == job_id:
            target_job = job
            break
    
    if not target_job:
        print(f"❌ Job with ID {job_id} not found")
        return jsonify({'error': 'Job not found'}), 404
    
    print(f"🎯 Target job: {target_job['title']} at {target_job['company']}")
    
    # Create text corpus
    job_texts = []
    for job in jobs:
        text = f"{str(job['title'] or '')} {str(job['description'] or '')} {str(job['company'] or '')}"
        job_texts.append(text.lower())
    
    target_text = f"{target_job['title']} {target_job['description']} {target_job['company']}".lower()
    
    # Calculate similarity
    all_texts = [target_text] + job_texts
    vectorizer = TfidfVectorizer(stop_words='english')
    tfidf_matrix = vectorizer.fit_transform(all_texts)
    similarity_scores = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:]).flatten()
    
    # Get top similar jobs (excluding the job itself)
    top_indices = similarity_scores.argsort()[-11:-1][::-1]
    
    similar_jobs = []
    for idx in top_indices:
        job = jobs[idx]
        if job['id'] != job_id:
            similar_jobs.append({
                'id': job['id'],
                'title': job['title'],
                'company': job['company'],
                'location': job['location'],
                'similarity_score': float(similarity_scores[idx])
            })
    
    print(f"✅ Found {len(similar_jobs)} similar jobs")
    for i, job in enumerate(similar_jobs[:5], 1):
        print(f"    {i}. {job['title']} at {job['company']} (Similarity: {job['similarity_score']*100:.1f}%)")
    if len(similar_jobs) > 5:
        print(f"    ... and {len(similar_jobs) - 5} more")
    print("="*60 + "\n")
    
    return jsonify(similar_jobs[:10])

@app.route('/', methods=['GET'])
def root():
    """Root endpoint - shows available endpoints"""
    print("\n" + "="*60)
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 🌐 ROOT ACCESSED")
    print("="*60)
    print("⚠️ Root endpoint accessed - returning API info")
    print("="*60 + "\n")
    
    return jsonify({
        'service': 'ML Recommendation Service',
        'version': '1.0.0',
        'endpoints': {
            'GET /health': 'Health check',
            'GET /popular': 'Get popular jobs',
            'POST /recommend': 'Get job recommendations (requires userId)',
            'POST /recommend-cv': 'Get job recommendations based on CV text',
            'POST /train': 'Train recommendation model',
            'POST /feedback': 'Submit feedback',
            'GET /similar/<job_id>': 'Get similar jobs'
        }
    })

if __name__ == '__main__':
    # Print startup banner
    print("\n" + "="*70)
    print("🚀 ML RECOMMENDATION SERVICE STARTING (PRODUCTION MODE)...")
    print("="*70)
    print(f"📅 Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🌐 Host: 0.0.0.0")
    print(f"🔌 Port: 5001")
    print("="*70)
    print("\n📡 Available endpoints:")
    print("    🏥 http://localhost:5001/health - Health check")
    print("    📊 http://localhost:5001/popular - Popular jobs")
    print("    🤖 http://localhost:5001/recommend - Recommendations (POST)")
    print("    📄 http://localhost:5001/recommend-cv - CV Recommendations (POST)")
    print("    🔍 http://localhost:5001/similar/<id> - Similar jobs")
    print("    📝 http://localhost:5001/feedback - Submit feedback (POST)")
    print("\n" + "="*70)
    print("✅ Service is ready to accept requests via Waitress!")
    print("="*70 + "\n")
    
    serve(app, host='0.0.0.0', port=5001)