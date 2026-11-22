
import React, {
    useState,
    useEffect,
    useRef,
    useCallback
} from 'react';

import { useLanguage } from '../context/LanguageContext';
import ChangePassword from './ChangePassword';
import Chat from './Chat';
import io from 'socket.io-client';
import { API_URL } from '../config/api';

const Navbar = ({
    user,
    setUser,
    setCurrentPage,
    onLogout,
    currentPage
}) => {
    const { language, setLanguage, t } = useLanguage();

    // ==========================================
    // STATES
    // ==========================================
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [selectedChatUser, setSelectedChatUser] = useState(null);

    // Unread messages
    const [unreadCount, setUnreadCount] = useState(0);

    // Unread notifications
    const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);

    const [showUserMenu, setShowUserMenu] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const [availableUsers, setAvailableUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [usersLoading, setUsersLoading] = useState(false);

    // Shared Socket.IO connection
    const [socketInstance, setSocketInstance] = useState(null);

    const socketRef = useRef(null);

    // ==========================================
    // AUTHENTICATION HEADERS
    // ==========================================
    const getAuthHeaders = useCallback(() => {
        const token = sessionStorage.getItem('token');

        return {
            'Content-Type': 'application/json',
            ...(token
                ? { Authorization: `Bearer ${token}` }
                : {})
        };
    }, []);

    // ==========================================
    // FETCH UNREAD MESSAGE COUNT
    // ==========================================
    const fetchUnreadCount = useCallback(async () => {
        if (!user?.id) {
            setUnreadCount(0);
            return;
        }

        try {
            const res = await fetch(
                `${API_URL}/api/messages/unread/${user.id}`,
                {
                    method: 'GET',
                    headers: getAuthHeaders()
                }
            );

            if (!res.ok) {
                console.warn('Unread message API error:', res.status);
                return;
            }

            const data = await res.json();

            const count =
                data?.count ??
                data?.data?.count ??
                0;

            setUnreadCount(Number(count) || 0);

        } catch (err) {
            console.error('Error fetching unread messages:', err);
        }
    }, [user?.id, getAuthHeaders]);

    // ==========================================
    // FETCH UNREAD NOTIFICATION COUNT
    // ==========================================
    const fetchNotificationUnreadCount = useCallback(async () => {
        if (!user?.id) {
            setNotificationUnreadCount(0);
            return;
        }

        try {
            const res = await fetch(
                `${API_URL}/api/notifications/unread/${user.id}`,
                {
                    method: 'GET',
                    headers: getAuthHeaders()
                }
            );

            if (!res.ok) {
                console.warn(
                    'Unread notification API error:',
                    res.status
                );
                return;
            }

            const data = await res.json();

            setNotificationUnreadCount(
                Number(data?.count) || 0
            );

        } catch (err) {
            console.error(
                'Error fetching unread notifications:',
                err
            );
        }
    }, [user?.id, getAuthHeaders]);

    // ==========================================
    // FETCH AVAILABLE CHAT USERS
    // ==========================================
    const fetchAvailableUsers = useCallback(async () => {
        if (!user?.id) {
            setAvailableUsers([]);
            return;
        }

        setUsersLoading(true);

        try {
            const res = await fetch(
                `${API_URL}/api/users`,
                {
                    method: 'GET',
                    headers: getAuthHeaders()
                }
            );

            if (!res.ok) {
                console.warn('Users API error:', res.status);
                setAvailableUsers([]);
                return;
            }

            const response = await res.json();

            const users =
                Array.isArray(response)
                    ? response
                    : Array.isArray(response?.data)
                        ? response.data
                        : Array.isArray(response?.users)
                            ? response.users
                            : Array.isArray(response?.data?.users)
                                ? response.data.users
                                : [];

            setAvailableUsers(
                users.filter(
                    usr => String(usr.id) !== String(user.id)
                )
            );

        } catch (err) {
            console.error('Error fetching users:', err);
            setAvailableUsers([]);

        } finally {
            setUsersLoading(false);
        }
    }, [user?.id, getAuthHeaders]);

    // ==========================================
    // SOCKET.IO CONNECTION
    // ==========================================
    useEffect(() => {
        if (!user?.id) {
            setUnreadCount(0);
            setNotificationUnreadCount(0);
            setAvailableUsers([]);
            setShowUserMenu(false);
            setShowChat(false);
            setSelectedChatUser(null);
            setSocketInstance(null);

            return undefined;
        }

        const token = sessionStorage.getItem('token');

        if (!token) {
            console.error(
                'Socket connection cancelled: JWT token not found.'
            );

            setSocketInstance(null);
            return undefined;
        }

        fetchUnreadCount();
        fetchNotificationUnreadCount();
        fetchAvailableUsers();

        // Create ONE authenticated Socket.IO connection.
        const socket = io(API_URL, {
            transports: ['polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            withCredentials: true,
            auth: {
                token
            }
        });

        socketRef.current = socket;
        setSocketInstance(socket);

        // SOCKET CONNECTED
        const handleConnect = () => {
            console.log(
                'Connected to authenticated Socket.IO:',
                socket.id
            );
        };

        // UNREAD MESSAGE UPDATE
        const handleUnreadUpdate = (data) => {
            if (String(data?.userId) === String(user.id)) {
                setUnreadCount(Number(data?.count) || 0);
                fetchUnreadCount();
            }
        };

        // NEW MESSAGE
        const handleNewMessage = () => {
            fetchUnreadCount();
        };

        // NEW NOTIFICATION
        const handleNewNotification = (notification) => {
            console.log('New notification received:', notification);
            fetchNotificationUnreadCount();
        };

        // DISCONNECT
        const handleDisconnect = (reason) => {
            console.log('Socket disconnected:', reason);
        };

        // CONNECTION ERROR
        const handleConnectError = (error) => {
            console.error(
                'Socket connection error:',
                error.message
            );
        };

        socket.on('connect', handleConnect);
        socket.on('unread-update', handleUnreadUpdate);
        socket.on('new-message', handleNewMessage);

        // Listener ready for server-side notification events
        socket.on('new-notification', handleNewNotification);

        socket.on('disconnect', handleDisconnect);
        socket.on('connect_error', handleConnectError);

        // CLEANUP
        return () => {
            socket.off('connect', handleConnect);
            socket.off('unread-update', handleUnreadUpdate);
            socket.off('new-message', handleNewMessage);
            socket.off('new-notification', handleNewNotification);
            socket.off('disconnect', handleDisconnect);
            socket.off('connect_error', handleConnectError);

            socket.disconnect();

            if (socketRef.current === socket) {
                socketRef.current = null;
                setSocketInstance(null);
            }
        };

    }, [
        user?.id,
        fetchUnreadCount,
        fetchNotificationUnreadCount,
        fetchAvailableUsers
    ]);

    // ==========================================
    // REFRESH NOTIFICATIONS WHEN PAGE IS OPENED
    // ==========================================
    useEffect(() => {
        if (user?.id && currentPage === 'notifications') {
            fetchNotificationUnreadCount();
        }
    }, [
        user?.id,
        currentPage,
        fetchNotificationUnreadCount
    ]);

    // ==========================================
    // LOGOUT
    // ==========================================
    const handleLogout = () => {
        setShowUserMenu(false);
        setShowChat(false);
        setShowChangePassword(false);
        setSelectedChatUser(null);
        setIsMobileMenuOpen(false);
        setSearchTerm('');

        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }

        setSocketInstance(null);

        setUnreadCount(0);
        setNotificationUnreadCount(0);
        setAvailableUsers([]);

        setUser(null);

        sessionStorage.removeItem('user');
        sessionStorage.removeItem('token');

        if (onLogout) {
            onLogout();
        } else {
            setCurrentPage('login');
        }
    };

    // ==========================================
    // OPEN CHAT
    // ==========================================
    const openChatWith = (otherUser) => {
        if (!user) {
            setCurrentPage('login');
            return;
        }

        setSelectedChatUser(otherUser);
        setShowChat(true);

        setShowUserMenu(false);
        setIsMobileMenuOpen(false);
    };

    // ==========================================
    // FILTER CHAT USERS
    // ==========================================
    const filteredUsers = availableUsers.filter(usr => {
        const name = (usr.name || '').toLowerCase();
        const email = (usr.email || '').toLowerCase();

        const search = searchTerm.toLowerCase().trim();

        return (
            name.includes(search) ||
            email.includes(search)
        );
    });

    // ==========================================
    // NAVIGATION HELPER
    // ==========================================
    const navigatePage = (page, isMobile = false) => {
        setCurrentPage(page);
        setShowUserMenu(false);

        if (isMobile) {
            setIsMobileMenuOpen(false);
        }
    };

    // ==========================================
    // USER ROLE CHECK
    // ==========================================
    const isApplicant =
        user?.role === 'applicant' ||
        user?.role === 'user';

    const isEmployer = user?.role === 'employer';
    const isAdmin = user?.role === 'admin';

    // ==========================================
    // PREMIUM GREEN THEME STYLES
    // ==========================================
    const styles = {
        nav: {
            background:
                'linear-gradient(135deg, #061b12 0%, #082b1c 55%, #063b25 100%)',
            display: 'flex',
            flexDirection: 'column',
            position: 'sticky',
            top: 0,
            zIndex: 1000,
            boxShadow: '0 5px 22px rgba(0,0,0,0.28)',
            width: '100%',
            boxSizing: 'border-box',
            borderBottom: '1px solid rgba(16, 185, 129, 0.25)'
        },

        topRow: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.8rem 3%',
            borderBottom: '1px solid rgba(16, 185, 129, 0.15)',
            width: '100%',
            boxSizing: 'border-box',
            gap: '12px',
            minHeight: '70px'
        },

        bottomRow: {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '1.5rem',
            padding: '0.9rem 2%',
            background: 'rgba(2, 20, 13, 0.35)',
            flexWrap: 'wrap',
            width: '100%',
            boxSizing: 'border-box'
        },

        logo: {
            fontSize: '1.65rem',
            fontWeight: '800',
            background:
                'linear-gradient(90deg, #34d399, #a7f3d0)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            cursor: 'pointer',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            whiteSpace: 'nowrap',
            letterSpacing: '-0.5px'
        },

        link: (active) => ({
            color: active ? '#34d399' : '#e5f5ec',
            cursor: 'pointer',
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: active ? '700' : '500',
            position: 'relative',
            transition: 'all 0.25s ease',
            whiteSpace: 'nowrap',
            padding: '7px 3px',
            borderBottom: active
                ? '2px solid #34d399'
                : '2px solid transparent'
        }),

        aiBtn: (active) => ({
            padding: '0.55rem 1.05rem',
            background: active
                ? 'linear-gradient(135deg, #059669, #10b981)'
                : 'rgba(16, 185, 129, 0.1)',
            border: '1px solid #10b981',
            borderRadius: '25px',
            color: '#ecfdf5',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: '700',
            transition: 'all 0.3s ease',
            whiteSpace: 'nowrap'
        }),

        userSection: {
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            justifyContent: 'flex-end'
        },

        btn: {
            padding: '0.55rem 1.2rem',
            background:
                'linear-gradient(135deg, #059669, #10b981)',
            border: '1px solid #10b981',
            borderRadius: '8px',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: '700',
            fontSize: '0.85rem',
            whiteSpace: 'nowrap',
            transition: 'all 0.25s ease'
        },

        btnOutline: {
            padding: '0.55rem 1rem',
            background: 'rgba(16, 185, 129, 0.06)',
            border: '1px solid rgba(52, 211, 153, 0.7)',
            borderRadius: '8px',
            color: '#a7f3d0',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.85rem',
            fontWeight: '600',
            whiteSpace: 'nowrap',
            transition: 'all 0.25s ease'
        },

        badge: {
            position: 'absolute',
            top: '-9px',
            right: '-14px',
            background: '#ef4444',
            color: '#fff',
            fontSize: '0.68rem',
            fontWeight: '700',
            borderRadius: '50%',
            minWidth: '19px',
            height: '19px',
            padding: '0 3px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #082b1c',
            boxSizing: 'border-box'
        },

        notificationBadge: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: '7px',
            minWidth: '19px',
            height: '19px',
            padding: '0 5px',
            background: '#ef4444',
            color: '#fff',
            borderRadius: '20px',
            fontSize: '0.68rem',
            fontWeight: '800',
            border: '2px solid #082b1c',
            boxSizing: 'border-box'
        },

        hamburger: {
            display: 'none',
            fontSize: '1.8rem',
            cursor: 'pointer',
            color: '#d1fae5',
            userSelect: 'none',
            lineHeight: 1,
            padding: '5px',
            background: 'transparent',
            border: 'none'
        },

        mobileMenu: {
            display: isMobileMenuOpen ? 'flex' : 'none',
            flexDirection: 'column',
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#071f15',
            padding: '1.5rem',
            gap: '1.2rem',
            zIndex: 999,
            borderTop:
                '1px solid rgba(52, 211, 153, 0.4)',
            boxShadow: '0 12px 25px rgba(0,0,0,0.35)',
            boxSizing: 'border-box',
            maxHeight: 'calc(100vh - 75px)',
            overflowY: 'auto'
        }
    };

    // ==========================================
    // NAVIGATION MENU ITEMS
    // ==========================================
    const MenuItems = ({ isMobile = false }) => (
        <>
            {/* PUBLIC JOBS PAGE */}
            <span
                style={styles.link(currentPage === 'jobs')}
                onClick={() => navigatePage('jobs', isMobile)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        navigatePage('jobs', isMobile);
                    }
                }}
            >
                {t.jobs || 'Jobs'}
            </span>

            {/* AUTHENTICATED USER MENU */}
            {user && (
                <>
                    {/* NOTIFICATIONS */}
                    <span
                        style={{
                            ...styles.link(
                                currentPage === 'notifications'
                            ),
                            position: 'relative'
                        }}
                        onClick={() => {
                            navigatePage('notifications', isMobile);
                            fetchNotificationUnreadCount();
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                navigatePage('notifications', isMobile);
                                fetchNotificationUnreadCount();
                            }
                        }}
                    >
                        🔔 {t.notifications || 'Notifications'}

                        {notificationUnreadCount > 0 && (
                            <span style={styles.notificationBadge}>
                                {notificationUnreadCount > 99
                                    ? '99+'
                                    : notificationUnreadCount}
                            </span>
                        )}
                    </span>

                    {/* JOB ALERTS */}
                    {(isApplicant || isAdmin) && (
                        <span
                            style={styles.link(currentPage === 'alerts')}
                            onClick={() => navigatePage('alerts', isMobile)}
                            role="button"
                            tabIndex={0}
                        >
                            📢 {t.jobAlerts || 'Job Alerts'}
                        </span>
                    )}

                    {/* INTERVIEWS */}
                    {(isApplicant || isEmployer || isAdmin) && (
                        <span
                            style={styles.link(currentPage === 'interviews')}
                            onClick={() => navigatePage('interviews', isMobile)}
                            role="button"
                            tabIndex={0}
                        >
                            📅 {t.interviews || 'Interviews'}
                        </span>
                    )}

                    {/* EMPLOYER APPLICATIONS */}
                    {(isEmployer || isAdmin) && (
                        <span
                            style={styles.link(currentPage === 'employer-apps')}
                            onClick={() => navigatePage('employer-apps', isMobile)}
                            role="button"
                            tabIndex={0}
                        >
                            📥 {t.applications || 'Applications'}
                        </span>
                    )}

                    {/* SAVED JOBS */}
                    <span
                        style={styles.link(currentPage === 'saved')}
                        onClick={() => navigatePage('saved', isMobile)}
                        role="button"
                        tabIndex={0}
                    >
                        📚 {t.savedJobs || 'Saved'}
                    </span>

                    {/* ADMIN MENU */}
                    {isAdmin && (
                        <>
                            <span
                                style={styles.link(currentPage === 'admin')}
                                onClick={() => navigatePage('admin', isMobile)}
                                role="button"
                                tabIndex={0}
                            >
                                ⚙️ {t.admin || 'Admin'}
                            </span>

                            <span
                                style={styles.link(currentPage === 'analytics')}
                                onClick={() => navigatePage('analytics', isMobile)}
                                role="button"
                                tabIndex={0}
                            >
                                📈 {t.analytics || 'Analytics'}
                            </span>
                        </>
                    )}

                    {/* MESSAGES */}
                    <span
                        style={{
                            ...styles.link(currentPage === 'messages'),
                            position: 'relative'
                        }}
                        onClick={() => navigatePage('messages', isMobile)}
                        role="button"
                        tabIndex={0}
                    >
                        💬 {t.messages || 'Messages'}

                        {unreadCount > 0 && (
                            <span style={styles.badge}>
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </span>

                    {/* AI RECOMMENDATIONS */}
                    <button
                        type="button"
                        style={styles.aiBtn(currentPage === 'recommendations')}
                        onClick={() => navigatePage('recommendations', isMobile)}
                    >
                        ✨ {t.aiRecommendations || 'AI Recommendations'}
                    </button>
                </>
            )}

            {/* GUEST MOBILE MENU */}
            {!user && isMobile && (
                <>
                    <button
                        type="button"
                        style={styles.btn}
                        onClick={() => navigatePage('login', true)}
                    >
                        {t.login || 'Login'}
                    </button>

                    <button
                        type="button"
                        style={styles.btnOutline}
                        onClick={() => navigatePage('register', true)}
                    >
                        {t.register || 'Register'}
                    </button>
                </>
            )}
        </>
    );

    // ==========================================
    // MAIN NAVBAR
    // ==========================================
    return (
        <>
            <nav style={styles.nav}>

                {/* TOP NAVIGATION */}
                <div style={styles.topRow}>

                    {/* LOGO */}
                    <div
                        style={styles.logo}
                        onClick={() => navigatePage('jobs')}
                        role="button"
                        tabIndex={0}
                        aria-label="Go to home page"
                    >
                        JobPortal
                    </div>

                    <div style={styles.userSection}>

                        {/* LANGUAGE SWITCHER */}
                        <button
                            type="button"
                            style={styles.btnOutline}
                            onClick={() =>
                                setLanguage(l => l === 'en' ? 'am' : 'en')
                            }
                        >
                            {language === 'en' ? 'አማርኛ' : 'English'}
                        </button>

                        {/* LOGGED-IN USER */}
                        {user ? (
                            <>
                                <span
                                    style={{
                                        color: '#ecfdf5',
                                        fontSize: '0.9rem',
                                        fontWeight: '600'
                                    }}
                                >
                                    👋 {user.name}
                                </span>

                                <button
                                    type="button"
                                    style={styles.btnOutline}
                                    onClick={() => {
                                        setShowChangePassword(true);
                                        setIsMobileMenuOpen(false);
                                    }}
                                >
                                    🔐 {t.changePassword || 'Change Password'}
                                </button>

                                <button
                                    type="button"
                                    style={styles.btn}
                                    onClick={handleLogout}
                                >
                                    {t.logout || 'Logout'}
                                </button>
                            </>
                        ) : (
                            <div
                                className="guest-auth-buttons"
                                style={{
                                    display: 'flex',
                                    gap: '10px',
                                    alignItems: 'center'
                                }}
                            >
                                <button
                                    type="button"
                                    style={styles.btn}
                                    onClick={() => navigatePage('login')}
                                >
                                    {t.login || 'Login'}
                                </button>

                                <button
                                    type="button"
                                    style={styles.btnOutline}
                                    onClick={() => navigatePage('register')}
                                >
                                    {t.register || 'Register'}
                                </button>
                            </div>
                        )}

                        {/* MOBILE MENU BUTTON */}
                        <button
                            type="button"
                            className="mobile-toggle"
                            style={styles.hamburger}
                            onClick={() =>
                                setIsMobileMenuOpen(prev => !prev)
                            }
                            aria-label="Toggle navigation menu"
                            aria-expanded={isMobileMenuOpen}
                        >
                            {isMobileMenuOpen ? '✕' : '☰'}
                        </button>
                    </div>
                </div>

                {/* DESKTOP NAVIGATION */}
                <div className="desktop-only" style={styles.bottomRow}>
                    <MenuItems />
                </div>

                {/* MOBILE NAVIGATION */}
                <div style={styles.mobileMenu}>
                    <MenuItems isMobile={true} />
                </div>

                {/* RESPONSIVE CSS */}
                <style>
                    {`
                        .mobile-toggle {
                            display: none;
                        }

                        @media (max-width: 1100px) {
                            .desktop-only {
                                display: none !important;
                            }

                            .mobile-toggle {
                                display: block !important;
                            }
                        }

                        @media (max-width: 600px) {
                            .guest-auth-buttons {
                                gap: 5px !important;
                            }

                            .guest-auth-buttons button {
                                padding: 0.4rem 0.65rem !important;
                                font-size: 0.75rem !important;
                            }
                        }

                        @media (max-width: 420px) {
                            .guest-auth-buttons {
                                display: none !important;
                            }
                        }
                    `}
                </style>
            </nav>

            {/* QUICK CHAT USER MENU */}
            {showUserMenu && user && (
                <div
                    style={{
                        position: 'fixed',
                        top: '125px',
                        right: '3%',
                        background: '#0b2d1e',
                        borderRadius: '14px',
                        padding: '1.4rem',
                        width: '320px',
                        maxWidth: '90vw',
                        zIndex: 2000,
                        boxShadow: '0 15px 35px rgba(0,0,0,0.45)',
                        border: '1px solid rgba(52, 211, 153, 0.5)',
                        boxSizing: 'border-box'
                    }}
                >
                    <button
                        type="button"
                        onClick={() => navigatePage('messages')}
                        style={{
                            width: '100%',
                            background: 'linear-gradient(135deg, #059669, #10b981)',
                            color: '#fff',
                            border: 'none',
                            padding: '12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            marginBottom: '15px',
                            fontWeight: '700'
                        }}
                    >
                        📂 View All {t.messages || 'Messages'}
                    </button>

                    <div
                        style={{
                            color: '#6ee7b7',
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            marginBottom: '10px',
                            textTransform: 'uppercase',
                            letterSpacing: '1px'
                        }}
                    >
                        Quick Chat
                    </div>

                    <input
                        type="text"
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px',
                            marginBottom: '15px',
                            borderRadius: '7px',
                            border: '1px solid rgba(52, 211, 153, 0.25)',
                            background: '#061f15',
                            color: '#fff',
                            boxSizing: 'border-box',
                            outline: 'none'
                        }}
                    />

                    <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                        {usersLoading ? (
                            <p style={{
                                color: '#a7f3d0',
                                textAlign: 'center',
                                padding: '15px'
                            }}>
                                Loading users...
                            </p>
                        ) : filteredUsers.length > 0 ? (
                            filteredUsers.map(usr => (
                                <div
                                    key={usr.id}
                                    onClick={() => openChatWith(usr)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') openChatWith(usr);
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    style={{
                                        padding: '12px',
                                        cursor: 'pointer',
                                        color: '#ecfdf5',
                                        borderBottom: '1px solid rgba(52, 211, 153, 0.12)',
                                        transition: 'background 0.2s'
                                    }}
                                >
                                    <strong>{usr.name}</strong>
                                    <br />
                                    <small style={{ color: '#9ca3af' }}>
                                        {usr.email}
                                    </small>
                                </div>
                            ))
                        ) : (
                            <p style={{
                                color: '#9ca3af',
                                textAlign: 'center',
                                padding: '15px'
                            }}>
                                No users found.
                            </p>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            setShowUserMenu(false);
                            setSearchTerm('');
                        }}
                        style={{
                            width: '100%',
                            marginTop: '15px',
                            background: 'transparent',
                            color: '#f87171',
                            border: '1px solid #ef4444',
                            padding: '10px',
                            borderRadius: '7px',
                            cursor: 'pointer',
                            fontWeight: '600'
                        }}
                    >
                        Close
                    </button>
                </div>
            )}

            {/* CHANGE PASSWORD MODAL */}
            {showChangePassword && user && (
                <ChangePassword
                    user={user}
                    onClose={() => setShowChangePassword(false)}
                />
            )}

            {/* CHAT COMPONENT */}
            {showChat && selectedChatUser && user && (
                <Chat
                    user={user}
                    otherUser={selectedChatUser}
                    socket={socketInstance}
                    onClose={() => {
                        setShowChat(false);
                        setSelectedChatUser(null);
                        fetchUnreadCount();
                    }}
                />
            )}
        </>
    );
};

export default Navbar;
