import React, { useState, useEffect, useCallback } from 'react';

const Notifications = ({ user }) => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = useCallback(async () => {
        if (!user?.id && !user?.user_id) return;
        const currentUserId = user?.id || user?.user_id;

        try {
            const res = await fetch(`http://localhost:5000/api/notifications/user/${currentUserId}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setNotifications(data);
                setUnreadCount(data.filter(n => !n.is_read).length);
            }
        } catch (err) {
            console.error('❌ Error fetching notifications:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // 🌟 የተስተካከለው markAsRead
    const markAsRead = async (id, category) => {
        const currentUserId = user?.id || user?.user_id;
        try {
            const res = await fetch(`http://localhost:5000/api/notifications/read/${id}`, { 
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                // 🌟 ለአዲሱ ታብል userId እና category እንልካለን
                body: JSON.stringify({ 
                    userId: currentUserId, 
                    category: category 
                })
            });

            if (res.ok) {
                setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
                setUnreadCount(prev => Math.max(0, prev - 1));
                // 💡 አሁን phpMyAdmin ላይ notification_reads ውስጥ ዳታ ይገባል!
            }
        } catch (err) {
            console.error('Error marking as read:', err);
        }
    };

    const styles = {
        container: {
            padding: '2rem',
            background: 'rgba(15, 30, 15, 0.95)',
            minHeight: '100vh',
            color: '#fff',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif'
        },
        header: {
            color: '#2ecc71',
            borderBottom: '1px solid rgba(46, 204, 113, 0.2)',
            paddingBottom: '1rem',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
        },
        card: (isRead) => ({
            padding: '1.2rem',
            margin: '1rem 0',
            background: isRead ? 'rgba(255, 255, 255, 0.03)' : 'rgba(46, 204, 113, 0.08)',
            borderRadius: '12px',
            borderLeft: isRead ? '4px solid #333' : '4px solid #2ecc71',
            boxShadow: isRead ? 'none' : '0 4px 15px rgba(46, 204, 113, 0.1)',
            transition: '0.3s ease'
        }),
        button: {
            background: '#2ecc71',
            color: '#fff',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 'bold'
        }
    };

    if (loading) return <div style={styles.container}>የማሳወቂያዎች ዝርዝር እየመጣ ነው...</div>;

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h2>🔔 Notifications</h2>
                {unreadCount > 0 && (
                    <span style={{ background: '#e74c3c', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem' }}>
                        {unreadCount} አዲስ
                    </span>
                )}
            </div>

            {notifications.length === 0 ? (
                <div style={{ textAlign: 'center', marginTop: '4rem', opacity: 0.5 }}>
                    <p style={{ fontSize: '3rem' }}>📭</p>
                    <p>ምንም ማሳወቂያ የለም።</p>
                </div>
            ) : (
                notifications.map(notif => (
                    <div key={`${notif.category}-${notif.id}`} style={styles.card(notif.is_read)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <h4 style={{ color: notif.is_read ? '#888' : '#2ecc71' }}>{notif.title}</h4>
                            <small style={{ color: '#666' }}>{new Date(notif.created_at).toLocaleDateString()}</small>
                        </div>
                        <p style={{ color: notif.is_read ? '#aaa' : '#eee', fontSize: '0.95rem', lineHeight: '1.4' }}>
                            {notif.message}
                        </p>
                        
                        {!notif.is_read && (
                            <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                                {/* 🌟 እዚህ ጋር category (global/personal) አብረን እንልካለን */}
                                <button style={styles.button} onClick={() => markAsRead(notif.id, notif.category)}>
                                    እሺ አየሁት
                                </button>
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
    );
};

export default Notifications;