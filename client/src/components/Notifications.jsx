
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../config/api';


const Notifications = ({ user, onNotificationsUpdated }) => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [readingId, setReadingId] = useState(null);

    const userId = user?.id || user?.user_id;
const getAuthHeaders = () => {
    return {
        'Content-Type': 'application/json'
    };
};

    const isRead = (value) => {
        return value === true || value === 1 || value === '1';
    };

    // =====================================
    // FETCH NOTIFICATIONS
    // =====================================
    const fetchNotifications = useCallback(async () => {
        if (!userId) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError('');

            const response = await fetch(
                `${API_URL}/api/notifications/user/${userId}`,
                {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: getAuthHeaders()
}
            );

            if (response.status === 401) {
                throw new Error('Session expired. Please login again.');
            }

            if (!response.ok) {
                throw new Error('Failed to load notifications.');
            }

            const data = await response.json();

            if (Array.isArray(data)) {
                setNotifications(data);

                const unread = data.filter(
                    notification => !isRead(notification.is_read)
                ).length;

                setUnreadCount(unread);
            } else {
                setNotifications([]);
                setUnreadCount(0);
            }

        } catch (err) {
            console.error('Fetch notifications error:', err);
            setError(err.message || 'Unable to load notifications.');
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // =====================================
    // MARK NOTIFICATION AS READ
    // =====================================
    const markAsRead = async (id, category) => {
        if (!userId || readingId !== null) return;

        const notification = notifications.find(
            item =>
                String(item.id) === String(id) &&
                item.category === category
        );

        if (!notification || isRead(notification.is_read)) {
            return;
        }

        const uniqueId = `${category}-${id}`;

        try {
            setReadingId(uniqueId);
            setError('');

            const response = await fetch(
                `${API_URL}/api/notifications/read/${id}`,
                {
    method: 'PUT',
    credentials: 'include',
    cache: 'no-store',
    headers: getAuthHeaders(),
    body: JSON.stringify({ category })
}
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || 'Could not mark notification as read.'
                );
            }

            // Update local notification state
            setNotifications(previous => {
                const updated = previous.map(item => {
                    if (
                        String(item.id) === String(id) &&
                        item.category === category
                    ) {
                        return {
                            ...item,
                            is_read: 1
                        };
                    }

                    return item;
                });

                setUnreadCount(
                    updated.filter(
                        item => !isRead(item.is_read)
                    ).length
                );

                return updated;
            });

            // =====================================
            // UPDATE NAVBAR NOTIFICATION BADGE
            // =====================================
            if (typeof onNotificationsUpdated === 'function') {
                onNotificationsUpdated();
            }

        } catch (err) {
            console.error('Mark as read error:', err);
            setError(err.message || 'Failed to mark as read.');
        } finally {
            setReadingId(null);
        }
    };

    // =====================================
    // DATE FORMAT
    // =====================================
    const formatDate = (date) => {
        if (!date) return '';

        const parsedDate = new Date(date);

        if (Number.isNaN(parsedDate.getTime())) {
            return '';
        }

        return parsedDate.toLocaleString();
    };

    // =====================================
    // STYLES
    // =====================================
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
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
        },

        card: (read) => ({
            padding: '1.2rem',
            margin: '1rem 0',
            background: read
                ? 'rgba(255, 255, 255, 0.03)'
                : 'rgba(46, 204, 113, 0.08)',
            borderRadius: '12px',
            borderLeft: read
                ? '4px solid #333'
                : '4px solid #2ecc71',
            boxShadow: read
                ? 'none'
                : '0 4px 15px rgba(46, 204, 113, 0.1)',
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
        },

        error: {
            background: 'rgba(231, 76, 60, 0.12)',
            border: '1px solid rgba(231, 76, 60, 0.4)',
            color: '#ff7675',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '15px'
        },

        category: {
            fontSize: '0.7rem',
            padding: '4px 8px',
            borderRadius: '5px',
            background: 'rgba(255,255,255,0.08)',
            color: '#aaa',
            textTransform: 'uppercase'
        }
    };

    // =====================================
    // LOADING
    // =====================================
    if (loading) {
        return (
            <div style={styles.container}>
                <p>የማሳወቂያዎች ዝርዝር እየመጣ ነው...</p>
            </div>
        );
    }

    // =====================================
    // MAIN UI
    // =====================================
    return (
        <div style={styles.container}>

            <div style={styles.header}>
                <h2>🔔 Notifications</h2>

                {unreadCount > 0 && (
                    <span
                        style={{
                            background: '#e74c3c',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '0.85rem'
                        }}
                    >
                        {unreadCount} አዲስ
                    </span>
                )}
            </div>

            {error && (
                <div style={styles.error}>
                    ⚠️ {error}
                </div>
            )}

            {notifications.length === 0 ? (
                <div
                    style={{
                        textAlign: 'center',
                        marginTop: '4rem',
                        opacity: 0.5
                    }}
                >
                    <p style={{ fontSize: '3rem' }}>📭</p>
                    <p>ምንም ማሳወቂያ የለም።</p>

                    <button
                        style={styles.button}
                        onClick={fetchNotifications}
                    >
                        🔄 Refresh
                    </button>
                </div>
            ) : (
                notifications.map(notif => {
                    const read = isRead(notif.is_read);
                    const uniqueId = `${notif.category}-${notif.id}`;

                    return (
                        <div
                            key={uniqueId}
                            style={styles.card(read)}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '10px',
                                    marginBottom: '0.5rem'
                                }}
                            >
                                <h4
                                    style={{
                                        color: read ? '#888' : '#2ecc71',
                                        margin: 0
                                    }}
                                >
                                    {notif.title}
                                </h4>

                                <small style={{ color: '#666' }}>
                                    {formatDate(notif.created_at)}
                                </small>
                            </div>

                            <div style={{ marginBottom: '10px' }}>
                                <span style={styles.category}>
                                    {notif.category || 'notification'}
                                </span>

                                <span
                                    style={{
                                        marginLeft: '8px',
                                        fontSize: '0.75rem',
                                        color: read ? '#888' : '#2ecc71'
                                    }}
                                >
                                    {read ? '✓ Read' : '● Unread'}
                                </span>
                            </div>

                            <p
                                style={{
                                    color: read ? '#aaa' : '#eee',
                                    fontSize: '0.95rem',
                                    lineHeight: '1.5'
                                }}
                            >
                                {notif.message}
                            </p>

                            {!read && (
                                <div
                                    style={{
                                        marginTop: '1rem',
                                        textAlign: 'right'
                                    }}
                                >
                                    <button
                                        style={{
                                            ...styles.button,
                                            opacity:
                                                readingId === uniqueId ? 0.6 : 1,
                                            cursor:
                                                readingId === uniqueId
                                                    ? 'not-allowed'
                                                    : 'pointer'
                                        }}
                                        disabled={readingId === uniqueId}
                                        onClick={() =>
                                            markAsRead(
                                                notif.id,
                                                notif.category
                                            )
                                        }
                                    >
                                        {readingId === uniqueId
                                            ? 'Please wait...'
                                            : '✓ እሺ አየሁት(Okay, I saw it.)'}
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })
            )}

            {notifications.length > 0 && (
                <div style={{ textAlign: 'center', marginTop: '25px' }}>
                    <button
                        style={styles.button}
                        onClick={fetchNotifications}
                    >
                        🔄 Refresh Notifications
                    </button>
                </div>
            )}

        </div>
    );
};

export default Notifications;
