
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import mysql.connector.pooling
import json
import logging
import os
from datetime import datetime
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import make_pipeline
from waitress import serve

# ================= LOGGING =================
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ================= FLASK APP =================
app = Flask(__name__)
CORS(app)

# ================= DATABASE CONFIGURATION =================
# Local development uses the existing XAMPP settings.
# Hosting uses environment variables.

DB_CONFIG = {
    'host': os.getenv('DB_HOST', '127.0.0.1'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'jobportal'),
    'port': int(os.getenv('DB_PORT', '3307'))
}

# ================= DATABASE CONNECTION POOL =================
db_pool = None

try:
    db_pool = mysql.connector.pooling.MySQLConnectionPool(
        pool_name="mypool",
        pool_size=5,
        **DB_CONFIG
    )
    logger.info("Database connection pool initialized successfully.")
except mysql.connector.Error as err:
    logger.error(f"Database pool initialization failed: {err}")


def get_db_connection():
    """Get a database connection from the connection pool."""
    global db_pool

    try:
        if db_pool is None:
            db_pool = mysql.connector.pooling.MySQLConnectionPool(
                pool_name="mypool",
                pool_size=5,
                **DB_CONFIG
            )

        return db_pool.get_connection()

    except mysql.connector.Error as err:
        logger.error(f"Database connection error: {err}")
        return None


# ================= USER SKILLS =================
def get_user_skills(user_id):
    conn = get_db_connection()

    if not conn:
        return []

    try:
        cursor = conn.cursor()

        cursor.execute(
            'SELECT skill FROM user_skills WHERE user_id = %s',
            (user_id,)
        )

        skills = cursor.fetchall()

        return [s[0] for s in skills] if skills else []

    except Exception as e:
        logger.error(f"Error fetching skills: {e}")
        return []

    finally:
        if conn:
            conn.close()


# ================= GET ALL JOBS =================
def get_all_jobs():
    conn = get_db_connection()

    if not conn:
        return []

    try:
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT id, title, description, company, location,
                   type, salary, requirements
            FROM jobs
            ORDER BY created_at DESC
            LIMIT 100
        """)

        return cursor.fetchall()

    except Exception as e:
        logger.error(f"Error fetching jobs: {e}")
        return []

    finally:
        if conn:
            conn.close()


# ================= VIEWED JOBS =================
def get_viewed_jobs(user_id):
    conn = get_db_connection()

    if not conn:
        return []

    try:
        cursor = conn.cursor()

        cursor.execute(
            'SELECT job_id FROM job_views WHERE user_id = %s',
            (user_id,)
        )

        return [row[0] for row in cursor.fetchall()]

    except Exception as e:
        logger.error(f"Error fetching viewed jobs: {e}")
        return []

    finally:
        if conn:
            conn.close()


# ================= APPLIED JOBS =================
def get_applied_jobs(user_id):
    conn = get_db_connection()

    if not conn:
        return []

    try:
        cursor = conn.cursor()

        cursor.execute(
            'SELECT job_id FROM applications WHERE user_id = %s',
            (user_id,)
        )

        return [row[0] for row in cursor.fetchall()]

    except Exception as e:
        logger.error(f"Error fetching applied jobs: {e}")
        return []

    finally:
        if conn:
            conn.close()


# ================= GET USER =================
def get_user_by_id(user_id):
    conn = get_db_connection()

    if not conn:
        return None

    try:
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            'SELECT id, name, email, role FROM users WHERE id = %s',
            (user_id,)
        )

        return cursor.fetchone()

    except Exception as e:
        logger.error(f"Error fetching user: {e}")
        return None

    finally:
        if conn:
            conn.close()


# ================= HEALTH CHECK =================
@app.route('/health', methods=['GET'])
def health_check():
    logger.info("Health check requested.")

    return jsonify({
        'status': 'healthy',
        'service': 'ML Recommendation Service',
        'version': '1.0.0',
        'timestamp': datetime.now().isoformat()
    })


# ================= POPULAR JOBS =================
@app.route('/popular', methods=['GET'])
def get_popular_jobs():
    conn = get_db_connection()

    if not conn:
        return jsonify({'error': 'Database connection failed'}), 503

    try:
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT j.*,
                (SELECT COUNT(*) FROM job_views
                 WHERE job_id = j.id) AS view_count,
                (SELECT COUNT(*) FROM applications
                 WHERE job_id = j.id) AS apply_count
            FROM jobs j
            ORDER BY (view_count + apply_count * 2) DESC
            LIMIT 20
        """)

        popular_jobs = cursor.fetchall()

        return jsonify(popular_jobs)

    except Exception as e:
        logger.error(f"Popular jobs error: {e}")
        return jsonify({'error': 'Unable to fetch popular jobs'}), 500

    finally:
        if conn:
            conn.close()


# ================= JOB RECOMMENDATION =================
@app.route('/recommend', methods=['POST'])
def recommend():
    data = request.get_json(silent=True) or {}

    user_id = data.get('userId')
    incoming_skills = data.get('skills')

    if not user_id:
        return jsonify({'error': 'User ID required'}), 400

    logger.info(f"Recommendation requested for user {user_id}")

    if incoming_skills and len(incoming_skills) > 0:
        user_skills = incoming_skills
    else:
        user_skills = get_user_skills(user_id)

    viewed_jobs = get_viewed_jobs(user_id)
    applied_jobs = get_applied_jobs(user_id)
    jobs = get_all_jobs()

    if not jobs:
        return jsonify([])

    job_texts = []

    for job in jobs:
        text = (
            f"{str(job['title'] or '')} "
            f"{str(job['description'] or '')} "
            f"{str(job['company'] or '')}"
        )

        job_texts.append(text.lower())

    if user_skills:
        if isinstance(user_skills, list):
            user_skills_text = " ".join(user_skills).lower()
        else:
            user_skills_text = str(user_skills).lower()
    else:
        user_skills_text = "software developer programming"

    all_texts = [user_skills_text] + job_texts

    try:
        vectorizer = TfidfVectorizer(
            stop_words='english',
            max_features=5000
        )

        tfidf_matrix = vectorizer.fit_transform(all_texts)

        similarity_scores = cosine_similarity(
            tfidf_matrix[0:1],
            tfidf_matrix[1:]
        ).flatten()

        candidates = []

        for idx, score in enumerate(similarity_scores):
            job = jobs[idx]

            if job['id'] not in applied_jobs:
                final_score = float(score)

                if job['id'] in viewed_jobs:
                    final_score *= 0.7

                candidates.append({
                    'id': job['id'],
                    'title': job['title'],
                    'company': job['company'],
                    'location': job['location'],
                    'type': job['type'],
                    'salary': job['salary'],
                    'similarity_score': final_score
                })

        recommendations = sorted(
            candidates,
            key=lambda x: x['similarity_score'],
            reverse=True
        )

        return jsonify(recommendations[:10])

    except Exception as e:
        logger.error(f"Recommendation error: {e}")
        return jsonify({'error': str(e)}), 500


# ================= CV RECOMMENDATION =================
@app.route('/recommend-cv', methods=['POST'])
def recommend_cv():
    data = request.get_json(silent=True) or {}

    user_id = data.get('userId')
    cv_text = data.get('cvText')

    if not user_id or not cv_text:
        return jsonify({
            'error': 'User ID and CV Text required'
        }), 400

    logger.info(f"CV recommendation requested for user {user_id}")

    jobs = get_all_jobs()

    if not jobs:
        return jsonify([])

    job_texts = []

    for job in jobs:
        reqs = job.get('requirements', '') or ''

        text = (
            f"{str(job['title'] or '')} "
            f"{str(job['description'] or '')} "
            f"{reqs} "
            f"{str(job['company'] or '')}"
        )

        job_texts.append(text.lower())

    import re

    cv_text_clean = re.sub(
        r'[^a-zA-Z0-9\s]',
        '',
        cv_text.lower()
    )

    all_texts = [cv_text_clean] + job_texts

    try:
        vectorizer = TfidfVectorizer(
            stop_words='english',
            max_features=5000
        )

        tfidf_matrix = vectorizer.fit_transform(all_texts)

        similarity_scores = cosine_similarity(
            tfidf_matrix[0:1],
            tfidf_matrix[1:]
        ).flatten()

        max_raw_score = (
            max(similarity_scores)
            if len(similarity_scores) > 0
            else 0
        )

        candidates = []

        for idx, score in enumerate(similarity_scores):
            job = jobs[idx]

            if max_raw_score > 0:
                base_score = (
                    float(score) / max_raw_score
                ) * 0.85
            else:
                base_score = 0.10

            job_title_lower = str(job['title'] or '').lower()
            title_words = job_title_lower.split()

            title_match_bonus = 0

            for word in title_words:
                if len(word) > 3 and word in cv_text_clean:
                    title_match_bonus += 0.10

            final_score = base_score + title_match_bonus

            final_score = max(0.05, min(final_score, 0.98))

            candidates.append({
                'id': job['id'],
                'title': job['title'],
                'company': job['company'],
                'location': job['location'],
                'type': job['type'],
                'salary': job['salary'],
                'similarity_score': round(final_score, 2)
            })

        recommendations = sorted(
            candidates,
            key=lambda x: x['similarity_score'],
            reverse=True
        )

        return jsonify(recommendations[:10])

    except Exception as e:
        logger.error(f"CV recommendation error: {e}")
        return jsonify({'error': str(e)}), 500


# ================= FAKE JOB DETECTION =================
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

fake_model = make_pipeline(
    TfidfVectorizer(),
    MultinomialNB()
)

fake_model.fit(X_train, y_train)


@app.route('/detect-fake', methods=['POST'])
def detect_fake():
    data = request.get_json(silent=True) or {}

    title = data.get('title', '')
    description = data.get('description', '')

    if not description:
        return jsonify({'error': 'Description required'}), 400

    text_to_check = f"{title} {description}".lower()

    prediction = fake_model.predict([text_to_check])[0]
    probabilities = fake_model.predict_proba([text_to_check])[0]

    is_fake = bool(prediction == 1)
    confidence = float(max(probabilities)) * 100

    logger.info(
        f"Fake job detection result: {is_fake}, "
        f"confidence: {confidence:.2f}%"
    )

    return jsonify({
        'is_fake': is_fake,
        'confidence': round(confidence, 2),
        'message': (
            'Warning: This job looks suspicious!'
            if is_fake
            else 'This job appears to be legitimate.'
        )
    })


# ================= TRAIN MODEL =================
@app.route('/train', methods=['POST'])
def train_model():
    logger.info("Training endpoint requested.")

    return jsonify({
        'message': 'Model training initiated',
        'status': 'success',
        'note': 'This is a placeholder. Implement actual training logic here.'
    })


# ================= FEEDBACK =================
@app.route('/feedback', methods=['POST'])
def submit_feedback():
    data = request.get_json(silent=True) or {}

    user_id = data.get('userId')
    job_id = data.get('jobId')
    feedback = data.get('feedback')

    if not user_id or not job_id:
        return jsonify({
            'error': 'User ID and Job ID required'
        }), 400

    conn = get_db_connection()

    if not conn:
        return jsonify({'error': 'Database connection failed'}), 503

    try:
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO recommendation_feedback
            (user_id, job_id, feedback, created_at)
            VALUES (%s, %s, %s, NOW())
        """, (user_id, job_id, feedback))

        conn.commit()

        return jsonify({
            'message': 'Feedback recorded successfully'
        })

    except Exception as e:
        logger.error(f"Feedback error: {e}")
        return jsonify({'error': 'Unable to save feedback'}), 500

    finally:
        if conn:
            conn.close()


# ================= SIMILAR JOBS =================
@app.route('/similar/<int:job_id>', methods=['GET'])
def get_similar_jobs(job_id):
    jobs = get_all_jobs()

    if not jobs:
        return jsonify([])

    target_job = None

    for job in jobs:
        if job['id'] == job_id:
            target_job = job
            break

    if not target_job:
        return jsonify({'error': 'Job not found'}), 404

    job_texts = []

    for job in jobs:
        text = (
            f"{str(job['title'] or '')} "
            f"{str(job['description'] or '')} "
            f"{str(job['company'] or '')}"
        )

        job_texts.append(text.lower())

    target_text = (
        f"{target_job['title']} "
        f"{target_job['description']} "
        f"{target_job['company']}"
    ).lower()

    all_texts = [target_text] + job_texts

    try:
        vectorizer = TfidfVectorizer(stop_words='english')
        tfidf_matrix = vectorizer.fit_transform(all_texts)

        similarity_scores = cosine_similarity(
            tfidf_matrix[0:1],
            tfidf_matrix[1:]
        ).flatten()

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

        return jsonify(similar_jobs[:10])

    except Exception as e:
        logger.error(f"Similar jobs error: {e}")
        return jsonify({'error': str(e)}), 500


# ================= ROOT ENDPOINT =================
@app.route('/', methods=['GET'])
def root():
    return jsonify({
        'service': 'ML Recommendation Service',
        'version': '1.0.0',
        'endpoints': {
            'GET /health': 'Health check',
            'GET /popular': 'Get popular jobs',
            'POST /recommend': 'Get job recommendations (requires userId)',
            'POST /recommend-cv': 'Get job recommendations based on CV text',
            'POST /detect-fake': 'Fake job detection',
            'POST /train': 'Train recommendation model',
            'POST /feedback': 'Submit feedback',
            'GET /similar/<job_id>': 'Get similar jobs'
        }
    })


# ================= START SERVER =================
if __name__ == '__main__':
    PORT = int(os.environ.get('PORT', 5001))

    print("\n" + "=" * 70)
    print("ML RECOMMENDATION SERVICE STARTING")
    print("=" * 70)
    print(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("Host: 0.0.0.0")
    print(f"Port: {PORT}")
    print("=" * 70)

    print("Available endpoints:")
    print("/health")
    print("/popular")
    print("/recommend")
    print("/recommend-cv")
    print("/detect-fake")
    print("/train")
    print("/feedback")
    print("/similar/<job_id>")
    print("=" * 70)

    serve(app, host='0.0.0.0', port=PORT)
