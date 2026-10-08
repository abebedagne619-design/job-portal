import React, { useEffect } from 'react';

const AuthSuccess = () => {
    useEffect(() => {
        // 1. ከ URL ላይ ቶከን እና የተጠቃሚ መረጃን እናወጣለን
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const userParam = urlParams.get('user');
        
        // ለፍተሻ በኮንሶል ላይ እናሳያለን
        console.log("Token received:", !!token);
        console.log("User data received:", !!userParam);

        if (token && userParam) {
            try {
                // 2. የተጠቃሚውን መረጃ ከ URL Decode አድርገን ወደ JSON እንቀይራለን
                const user = JSON.parse(decodeURIComponent(userParam));
                
                // 3. መረጃውን በ localStorage ውስጥ እናስቀምጣለን (App.jsx እንዲያነበው)
                localStorage.setItem('token', token);
                localStorage.setItem('user', JSON.stringify(user));
                
                console.log("Login successful! Redirecting to home...");

                // 4. ወደ ዋናው ገጽ እንልካለን
                // 'replace' መጠቀምህ ተጠቃሚው ወደ ኋላ ሲመለስ መልሶ እዚህ ገጽ ላይ እንዳይመጣ ያደርጋል
                window.location.replace('/'); 
            } catch (err) {
                console.error('Error processing login data:', err);
                window.location.replace('/login');
            }
        } else {
            // መረጃው ካልመጣ ከ1 ሰከንድ በኋላ ወደ ሎጊን ይመለሳል
            console.error('Missing token or user data in URL');
            const timeout = setTimeout(() => {
                window.location.replace('/login');
            }, 1500);
            return () => clearTimeout(timeout);
        }
    }, []);

    // የገጹ ስታይል (Loading Screen)
    const styles = {
        container: { 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh', 
            background: '#0a3d0a', // ያንተ አረንጓዴ Background
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif'
        },
        content: { 
            textAlign: 'center', 
            color: '#fff' 
        },
        spinner: { 
            fontSize: '3.5rem', 
            color: '#2ecc71',
            marginBottom: '1rem'
        },
        text: { 
            fontSize: '1.2rem',
            fontWeight: '500'
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.content}>
                {/* FontAwesome Spinner ካለህ እንዲዞር ያደርገዋል */}
                <i className="fas fa-circle-notch fa-spin" style={styles.spinner}></i>
                <h2 style={styles.text}>Completing sign in...</h2>
                <p style={{color: '#888'}}>Please wait a moment.</p>
            </div>
        </div>
    );
};

export default AuthSuccess;