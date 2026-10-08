import React, { useState, useEffect } from 'react';

const RatingStars = ({ jobId, userId, onRatingChange }) => {
    const [rating, setRating] = useState(0);
    const [hover, setHover] = useState(0);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [averageRating, setAverageRating] = useState(0);
    const [totalRatings, setTotalRatings] = useState(0);

    useEffect(() => {
        fetchAverageRating();
        if (userId) {
            fetchUserRating();
        }
    }, [jobId, userId]);

    const fetchAverageRating = async () => {
        try {
            const res = await fetch(`http://localhost:5000/api/ratings/job/${jobId}`);
            const data = await res.json();
            // ዳታው ባዶ ከሆነ 0 እንዲሆን መከላከያ
            setAverageRating(data.average || 0);
            setTotalRatings(data.count || 0);
        } catch (err) {
            console.error('Error fetching average rating:', err);
        }
    };

    const fetchUserRating = async () => {
        try {
            const res = await fetch(`http://localhost:5000/api/ratings/check/${userId}/${jobId}`);
            const data = await res.json();
            if (data && data.rating) {
                setRating(data.rating);
                setComment(data.comment || '');
            }
        } catch (err) {
            console.error('Error fetching user rating:', err);
        }
    };

    const submitRating = async () => {
        if (rating === 0) {
            alert('እባክሽን መጀመሪያ ኮከብ ምረጪ!');
            return;
        }

        if (!userId) {
            alert('ደረጃ ለመስጠት መጀመሪያ Login አድርጊ!');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('http://localhost:5000/api/ratings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // ዳታቤዙ የሚፈልጋቸውን ስሞች (job_id, user_id) በትክክል መላካቸውን እናረጋግጥ
                body: JSON.stringify({ 
                    job_id: jobId, 
                    user_id: userId, 
                    rating: rating, 
                    comment: comment,
                    // ለጥንቃቄ በካሜል ኬዝም እንላካቸው
                    jobId: jobId,
                    userId: userId
                })
            });

            const responseData = await res.json();

            if (res.ok) {
                fetchAverageRating();
                if (onRatingChange) onRatingChange();
                alert('ስለ አስተያየትሽ እናመሰግናለን!');
            } else {
                alert('ስህተት፡ ' + (responseData.message || 'መረጃውን መላክ አልተቻለም'));
            }
        } catch (err) {
            console.error('Error submitting rating:', err);
            alert('ከሰርቨር ጋር መገናኘት አልተቻለም!');
        }
        setSubmitting(false);
    };

    const styles = {
        container: { 
            marginTop: '1rem', 
            paddingTop: '1rem', 
            borderTop: '1px solid rgba(46,204,113,0.3)',
            color: '#fff' 
        },
        stars: { display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' },
        star: { 
            cursor: 'pointer', 
            fontSize: '1.8rem', 
            transition: 'all 0.2s ease',
            textShadow: '0 0 5px rgba(0,0,0,0.5)' 
        },
        comment: { 
            width: '100%', 
            padding: '0.8rem', 
            borderRadius: '8px', 
            background: 'rgba(10, 42, 10, 0.8)', 
            color: '#fff', 
            border: '1px solid rgba(46,204,113,0.2)', 
            marginTop: '0.5rem',
            outline: 'none',
            fontFamily: 'inherit'
        },
        button: { 
            padding: '0.6rem 1.2rem', 
            background: '#2ecc71', 
            border: 'none', 
            borderRadius: '8px', 
            color: '#fff', 
            cursor: 'pointer', 
            marginTop: '0.8rem',
            fontWeight: 'bold',
            transition: 'opacity 0.3s'
        },
        average: { 
            marginTop: '0.8rem', 
            color: '#2ecc71', 
            fontSize: '0.95rem',
            fontWeight: '500'
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.stars}>
                {[1, 2, 3, 4, 5].map(star => (
                    <span
                        key={star}
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHover(star)}
                        onMouseLeave={() => setHover(0)}
                        style={{
                            ...styles.star,
                            color: (hover >= star || (!hover && rating >= star)) ? '#ffc107' : '#444',
                            transform: (hover === star) ? 'scale(1.2)' : 'scale(1)'
                        }}
                    >
                        ★
                    </span>
                ))}
            </div>
            
            <textarea
                style={styles.comment}
                placeholder="አስተያየት ካለሽ እዚህ ጻፊ (አማራጭ)..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows="3"
            />
            
            <button 
                style={{...styles.button, opacity: submitting ? 0.7 : 1}} 
                onClick={submitRating} 
                disabled={submitting}
            >
                {submitting ? 'በመላክ ላይ...' : rating ? 'አስተካክለው' : 'ደረጃ ስጥ'}
            </button>
            
            <div style={styles.average}>
                ⭐ {Number(averageRating).toFixed(1)} / 5 ({totalRatings} ratings)
            </div>
        </div>
    );
};

export default RatingStars;