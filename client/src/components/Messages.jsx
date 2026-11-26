
import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import { useLanguage } from '../context/LanguageContext';
import { API_URL as BASE_URL } from '../config/api';


const Messages = ({ user, setCurrentPage }) => {
    const { language } = useLanguage();
    const isAmharic = language === 'am';

    const text = (en, am) => isAmharic ? am : en;

    const [conversations, setConversations] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');

    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [socketConnected, setSocketConnected] = useState(false);

    const [error, setError] = useState('');
    const [isMinimized, setIsMinimized] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    const [showSearch, setShowSearch] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const socket = useRef(null);
    const selectedUserRef = useRef(null);
    const scrollRef = useRef(null);

    useEffect(() => {
        selectedUserRef.current = selectedUser;
    }, [selectedUser]);

    // =====================================
    // AUTHENTICATION HEADERS
    // =====================================

    const getAuthHeaders = useCallback(() => {
    return {
        'Content-Type': 'application/json'
    };
}, []);
    // =====================================
    // NORMALIZE MESSAGE DATA
    // =====================================

    const normalizeMessage = useCallback((msg) => ({
        ...msg,
        id: msg.id,
        sender_id: msg.sender_id ?? msg.senderId,
        receiver_id: msg.receiver_id ?? msg.receiverId,
        created_at: msg.created_at ?? msg.createdAt,
        is_read: Boolean(msg.is_read ?? msg.isRead)
    }), []);

    // =====================================
    // FETCH CONVERSATIONS
    // =====================================

    const fetchConversations = useCallback(async () => {
        if (!user?.id) return;

        try {
            const response = await fetch(
                `${BASE_URL}/api/messages/conversations/${user.id}`,
                {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: getAuthHeaders()
}
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to load conversations');
            }

            setConversations(
                Array.isArray(result.data) ? result.data : []
            );

        } catch (err) {
            console.error('Fetch conversations error:', err);
            setError(text('Could not load conversations.', 'ውይይቶችን መጫን አልተቻለም።'));
        }
    }, [user, getAuthHeaders, isAmharic]);

    // =====================================
    // FETCH USERS
    // =====================================

    const fetchUsers = useCallback(async () => {
        try {
          const response = await fetch(
    `${BASE_URL}/api/users`,
    {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: getAuthHeaders()
    }
);

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to load users');
            }

            setAllUsers(
                Array.isArray(result.data) ? result.data : []
            );

        } catch (err) {
            console.error('Fetch users error:', err);
        }
    }, [getAuthHeaders]);

    // =====================================
    // FETCH CHAT MESSAGES
    // =====================================

    const fetchMessages = useCallback(async (otherUser) => {
        if (!user?.id || !otherUser?.other_user_id) return;

        try {
            setLoading(true);
            setError('');

            const response = await fetch(
                `${BASE_URL}/api/messages/${user.id}/${otherUser.other_user_id}`,
                {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: getAuthHeaders()
}
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to load messages');
            }

            const messageList = Array.isArray(result.data)
                ? result.data
                : [];

            setMessages(messageList.map(normalizeMessage));

            // Mark messages as read.
            socket.current?.emit('mark-read', {
                otherUserId: otherUser.other_user_id
            });

            await fetchConversations();

        } catch (err) {
            console.error('Fetch messages error:', err);
            setError(text('Could not load messages.', 'መልዕክቶችን መጫን አልተቻለም።'));
            setMessages([]);
        } finally {
            setLoading(false);
        }
    }, [user, getAuthHeaders, normalizeMessage, fetchConversations, isAmharic]);

        // =====================================
    // SOCKET.IO CONNECTION
    // =====================================

    useEffect(() => {
        if (!user?.id) return;

        const newSocket = io(BASE_URL, {
            transports: ['polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            withCredentials: true
        });

        socket.current = newSocket;

        newSocket.on('connect', () => {
            console.log('Messages socket connected:', newSocket.id);
            setSocketConnected(true);
            setError('');
        });

        newSocket.on('disconnect', () => {
            setSocketConnected(false);
        });

        newSocket.on('connect_error', (err) => {
            console.error('Messages socket error:', err.message);
            setSocketConnected(false);

            setError(text(
                'Connection problem. Please check your server and login.',
                'የግንኙነት ችግር አለ። Server እና Login ያረጋግጡ።'
            ));
        });

        newSocket.on('new-message', (data) => {
            const incoming = normalizeMessage(data);
            const currentChat = selectedUserRef.current;

            if (currentChat) {
                const senderId = String(incoming.sender_id);
                const receiverId = String(incoming.receiver_id);
                const currentUserId = String(user.id);
                const otherUserId = String(currentChat.other_user_id);

                const belongsToCurrentChat =
                    (senderId === currentUserId && receiverId === otherUserId) ||
                    (senderId === otherUserId && receiverId === currentUserId);

                if (belongsToCurrentChat) {
                    setMessages(previous => {
                        const alreadyExists = previous.some(
                            msg => String(msg.id) === String(incoming.id)
                        );

                        if (alreadyExists) return previous;

                        return [...previous, incoming];
                    });

                    if (senderId === otherUserId) {
                        newSocket.emit('mark-read', {
                            otherUserId: currentChat.other_user_id
                        });
                    }
                }
            }

            fetchConversations();
        });

        newSocket.on('message-sent', (result) => {
            if (result?.success) {
                setSending(false);
                setError('');
                fetchConversations();
            }
        });

        newSocket.on('message-error', (result) => {
            setSending(false);

            setError(
                result?.message ||
                text(
                    'Message could not be sent.',
                    'መልዕክቱን መላክ አልተቻለም።'
                )
            );
        });

        return () => {
            newSocket.removeAllListeners();
            newSocket.disconnect();

            if (socket.current === newSocket) {
                socket.current = null;
            }

            setSocketConnected(false);
        };

    }, [user, normalizeMessage, fetchConversations, isAmharic]);
    // =====================================
    // INITIAL DATA
    // =====================================

    useEffect(() => {
        if (user?.id) {
            fetchConversations();
            fetchUsers();
        }
    }, [user, fetchConversations, fetchUsers]);

    // =====================================
    // SCROLL TO LATEST MESSAGE
    // =====================================

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'end'
            });
        }
    }, [messages]);

    // =====================================
    // OPEN CONVERSATION
    // =====================================

    const openConversation = (conversation) => {
        setSelectedUser(conversation);
        setMessages([]);
        setError('');
        setShowSearch(false);
        setSearchTerm('');
    };

    useEffect(() => {
        if (selectedUser) {
            fetchMessages(selectedUser);
        }
    }, [selectedUser, fetchMessages]);

    // =====================================
    // START NEW CHAT
    // =====================================

    const startNewChat = (person) => {
        const newConversation = {
            other_user_id: person.id,
            other_user_name: person.name,
            other_user_role: person.role
        };

        setSelectedUser(newConversation);
        setMessages([]);
        setShowSearch(false);
        setSearchTerm('');
        setError('');
    };

    // =====================================
    // SEND MESSAGE
    // =====================================

    const handleSendMessage = (e) => {
        e.preventDefault();

        const message = newMessage.trim();

        if (!message || !selectedUser || sending) return;

        if (!socket.current?.connected) {
            setError(text(
                'Not connected. Please wait and try again.',
                'ግንኙነት የለም። እባክዎ ትንሽ ይጠብቁና እንደገና ይሞክሩ።'
            ));
            return;
        }

        console.log('SENDING MESSAGE DEBUG:', {
    currentUserId: user.id,
    selectedUser,
    receiverId: selectedUser.other_user_id,
    message
});

        setSending(true);
        setError('');

        socket.current.emit('send-message', {
            receiverId: selectedUser.other_user_id,
            message
        });

        setNewMessage('');
    };

    // =====================================
    // FILTER USERS
    // =====================================

    const filteredUsers = allUsers.filter(person => {
        const search = searchTerm.toLowerCase();

        return (
            person.name?.toLowerCase().includes(search) ||
            person.email?.toLowerCase().includes(search) ||
            person.role?.toLowerCase().includes(search)
        );
    });

    // =====================================
    // FORMAT TIME
    // =====================================

    const formatTime = (date) => {
        if (!date) return '';

        const parsedDate = new Date(date);

        if (Number.isNaN(parsedDate.getTime())) return '';

        return parsedDate.toLocaleTimeString(
            isAmharic ? 'am-ET' : 'en-US',
            {
                hour: '2-digit',
                minute: '2-digit'
            }
        );
    };

    // =====================================
    // LOGIN CHECK
    // =====================================

    if (!user) {
        return (
            <div style={styles.centerMessage}>
                {text('Please log in to view messages.', 'መልዕክቶችን ለማየት እባክዎ ይግቡ።')}
            </div>
        );
    }

    // =====================================
    // MINIMIZED VIEW
    // =====================================

    if (isMinimized) {
        return (
            <div style={styles.minimized} onClick={() => setIsMinimized(false)}>
                <span>💬 {text('Messages', 'መልዕክቶች')}</span>
                <button style={styles.smallButton}>
                    {text('Open', 'ክፈት')}
                </button>
            </div>
        );
    }

    // =====================================
    // MAIN UI
    // =====================================

    return (
        <div
    style={{
        ...styles.container,
        ...(isMaximized ? styles.maximized : {})
    }}
>

            {/* HEADER */}
            <div style={styles.header}>
                <div>
                    <h2 style={styles.headerTitle}>
                        💬 {text('Messages', 'መልዕክቶች')}
                    </h2>

                    <span style={styles.connection}>
                        <span style={{
                            ...styles.statusDot,
                            background: socketConnected ? '#22c55e' : '#ef4444'
                        }} />
                        {socketConnected
                            ? text('Connected', 'ተገናኝቷል')
                            : text('Connecting...', 'በመገናኘት ላይ...')}
                    </span>
                </div>

                
<div style={styles.headerActions}>
    <button
        style={styles.headerButton}
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        title={text('Toggle conversations', 'ውይይቶችን ቀይር')}
    >
        ☰
    </button>

    {/* MINIMIZE */}
    <button
        style={styles.headerButton}
        onClick={() => setIsMinimized(true)}
        title={text('Minimize', 'አሳንስ')}
    >
        −
    </button>

    {/* MAXIMIZE / RESTORE */}
    <button
        style={styles.headerButton}
        onClick={() => setIsMaximized(prev => !prev)}
        title={isMaximized
            ? text('Restore', 'ወደ ቀድሞ መጠን መልስ')
            : text('Maximize', 'ሙሉ ስክሪን አድርግ')}
    >
        {isMaximized ? '❐' : '□'}
    </button>

    {/* CLOSE */}
    <button
        style={styles.headerButton}
        onClick={() => setCurrentPage('dashboard')}
        title={text('Close', 'ዝጋ')}
    >
        ✕
    </button>
</div>

            </div>

            {/* ERROR */}
            {error && (
                <div style={styles.error}>
                    {error}
                    <button
                        onClick={() => setError('')}
                        style={styles.errorClose}
                    >
                        ×
                    </button>
                </div>
            )}

            <div style={styles.main}>

                {/* SIDEBAR */}
                {!isSidebarCollapsed && (
                    <div style={styles.sidebar}>

                        <div style={styles.sidebarHeader}>
                            <h3 style={styles.sectionTitle}>
                                {text('Conversations', 'ውይይቶች')}
                            </h3>

                            <button
                                style={styles.newChatButton}
                                onClick={() => {
                                    setShowSearch(!showSearch);
                                    setSearchTerm('');
                                }}
                            >
                                {showSearch
                                    ? text('Cancel', 'ይቅር')
                                    : text('+ New Chat', '+ አዲስ ውይይት')}
                            </button>
                        </div>

                        {/* USER SEARCH */}
                        {showSearch && (
                            <div style={styles.searchArea}>
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder={text('Search people...', 'ሰዎችን ፈልግ...')}
                                    style={styles.searchInput}
                                />

                                <div style={styles.userList}>
                                    {filteredUsers.map(person => (
                                        <button
                                            key={person.id}
                                            style={styles.userItem}
                                            onClick={() => startNewChat(person)}
                                        >
                                            <div style={styles.avatar}>
                                                {person.name?.charAt(0)?.toUpperCase() || '?'}
                                            </div>

                                            <div style={styles.userInfo}>
                                                <strong>{person.name}</strong>
                                                <small>{person.role}</small>
                                            </div>
                                        </button>
                                    ))}

                                    {filteredUsers.length === 0 && (
                                        <p style={styles.emptyText}>
                                            {text('No users found.', 'ምንም ተጠቃሚ አልተገኘም።')}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* CONVERSATION LIST */}
                        {!showSearch && (
                            <div style={styles.conversationList}>
                                {conversations.map(conversation => (
                                    <button
                                        key={conversation.other_user_id}
                                        onClick={() => openConversation(conversation)}
                                        style={{
                                            ...styles.conversationItem,
                                            ...(String(selectedUser?.other_user_id) ===
                                                String(conversation.other_user_id)
                                                ? styles.activeConversation
                                                : {})
                                        }}
                                    >
                                        <div style={styles.avatar}>
                                            {conversation.other_user_name
                                                ?.charAt(0)?.toUpperCase() || '?'}
                                        </div>

                                        <div style={styles.userInfo}>
                                            <strong>{conversation.other_user_name}</strong>
                                            <small>
                                                {conversation.last_message || text(
                                                    'Start a conversation',
                                                    'ውይይት ይጀምሩ'
                                                )}
                                            </small>
                                        </div>
                                    </button>
                                ))}

                                {conversations.length === 0 && (
                                    <p style={styles.emptyText}>
                                        {text(
                                            'No conversations yet. Start a new chat.',
                                            'እስካሁን ውይይት የለም። አዲስ ውይይት ይጀምሩ።'
                                        )}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* CHAT AREA */}
                <div style={styles.chatArea}>

                    {selectedUser ? (
                        <>
                            {/* CHAT HEADER */}
                            <div style={styles.chatHeader}>
                                <div style={styles.avatar}>
                                    {selectedUser.other_user_name
                                        ?.charAt(0)?.toUpperCase() || '?'}
                                </div>

                                <div>
                                    <strong>{selectedUser.other_user_name}</strong>
                                    <small style={styles.roleText}>
                                        {selectedUser.other_user_role || text('User', 'ተጠቃሚ')}
                                    </small>
                                </div>
                            </div>

                            {/* MESSAGES */}
                            <div style={styles.messageArea}>
                                {loading ? (
                                    <p style={styles.emptyText}>
                                        {text('Loading messages...', 'መልዕክቶች በመጫን ላይ...')}
                                    </p>
                                ) : messages.length === 0 ? (
                                    <div style={styles.emptyChat}>
                                        <span style={{ fontSize: 40 }}>💬</span>
                                        <p>
                                            {text(
                                                'No messages yet. Say hello!',
                                                'እስካሁን መልዕክት የለም። ሰላም ይበሉ!'
                                            )}
                                        </p>
                                    </div>
                                ) : (
                                    messages.map((msg, index) => {
                                        const isMine =
                                            String(msg.sender_id) === String(user.id);

                                        return (
                                  
<div
    key={msg.id || index}
    style={{
        ...styles.messageRow,
        justifyContent: isMine ? 'flex-end' : 'flex-start'
    }}
>
    <div
        style={{
            ...styles.messageBubble,
            ...(isMine ? styles.myMessage : styles.theirMessage)
        }}
    >
        {/* SENDER NAME ONLY */}
        <div style={{
            fontSize: '11px',
            fontWeight: 'bold',
            marginBottom: '5px',
            color: isMine ? '#166534' : '#475569'
        }}>
            {isMine ? 'You' : selectedUser?.other_user_name || 'User'}
        </div>

        <p style={styles.messageText}>
    {msg.message}
</p>

        <small style={styles.messageTime}>
            {formatTime(msg.created_at)}
            {isMine && (
                <span>{msg.is_read ? ' ✓✓' : ' ✓'}</span>
            )}
        </small>
    </div>
</div>

                                        );
                                    })
                                )}

                                <div ref={scrollRef} />
                            </div>

                            {/* MESSAGE INPUT */}
                            <form
                                onSubmit={handleSendMessage}
                                style={styles.inputArea}
                            >
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={e => setNewMessage(e.target.value)}
                                    placeholder={text(
                                        'Type your message...',
                                        'መልዕክትዎን ይጻፉ...'
                                    )}
                                    style={styles.messageInput}
                                    maxLength={5000}
                                />

                                <button
                                    type="submit"
                                    disabled={!newMessage.trim() || sending}
                                    style={{
                                        ...styles.sendButton,
                                        opacity: !newMessage.trim() || sending ? 0.5 : 1
                                    }}
                                >
                                    {sending
                                        ? text('Sending...', 'በመላክ ላይ...')
                                        : text('Send ➤', 'ላክ ➤')}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div style={styles.emptyChat}>
                            <span style={{ fontSize: 55 }}>💬</span>
                            <h3>
                                {text('Your Messages', 'የእርስዎ መልዕክቶች')}
                            </h3>
                            <p>
                                {text(
                                    'Select a conversation or start a new chat.',
                                    'ውይይት ይምረጡ ወይም አዲስ ውይይት ይጀምሩ።'
                                )}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// =====================================
// STYLES
// =====================================

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 110px)',
        minHeight: '500px',
        background: '#ffffff',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid #e5e7eb',
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
    },
    maximized: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw',
    height: '100vh',
    minHeight: 0,
    zIndex: 9999,
    borderRadius: 0,
    border: 'none',
    boxShadow: 'none'
},

    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '15px 20px',
        background: '#1e40af',
        color: '#ffffff'
    },

    headerTitle: {
        margin: 0,
        fontSize: '20px'
    },

    connection: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        marginTop: '5px',
        color: '#dbeafe'
    },

    statusDot: {
        width: '8px',
        height: '8px',
        borderRadius: '50%'
    },

    headerActions: {
        display: 'flex',
        gap: '8px'
    },

    headerButton: {
        background: 'rgba(255,255,255,0.15)',
        border: 'none',
        color: '#ffffff',
        padding: '7px 12px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '18px'
    },

    main: {
        display: 'flex',
        flex: 1,
        minHeight: 0
    },

    sidebar: {
        width: '300px',
        minWidth: '230px',
        borderRight: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
    },

    sidebarHeader: {
        padding: '15px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '8px',
        borderBottom: '1px solid #e5e7eb'
    },

    sectionTitle: {
        margin: 0,
        fontSize: '16px',
        color: '#1f2937'
    },

    newChatButton: {
        border: 'none',
        background: '#2563eb',
        color: '#ffffff',
        padding: '8px 10px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '12px'
    },

    conversationList: {
        overflowY: 'auto',
        flex: 1
    },

    conversationItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        padding: '13px',
        border: 'none',
        borderBottom: '1px solid #f1f5f9',
        background: '#ffffff',
        textAlign: 'left',
        cursor: 'pointer'
    },

    activeConversation: {
        background: '#eff6ff'
    },

    avatar: {
        width: '42px',
        height: '42px',
        minWidth: '42px',
        borderRadius: '50%',
        background: '#dbeafe',
        color: '#1d4ed8',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontWeight: 'bold',
        fontSize: '17px'
    },

    userInfo: {
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        gap: '5px',
        color: '#1f2937',
        overflow: 'hidden'
    },

    searchArea: {
        padding: '12px',
        overflowY: 'auto'
    },

    searchInput: {
        width: '100%',
        boxSizing: 'border-box',
        padding: '11px',
        border: '1px solid #d1d5db',
        borderRadius: '7px',
        outline: 'none'
    },

    userList: {
        marginTop: '10px'
    },

    userItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        padding: '10px',
        border: 'none',
        borderBottom: '1px solid #eee',
        background: '#fff',
        cursor: 'pointer',
        textAlign: 'left'
    },

    chatArea: {
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minWidth: 0
    },

    chatHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 18px',
        borderBottom: '1px solid #e5e7eb',
        color: '#1f2937'
    },

    roleText: {
        display: 'block',
        color: '#6b7280',
        fontSize: '12px',
        marginTop: '4px'
    },

    messageArea: {
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        background: '#f8fafc'
    },

    messageRow: {
        display: 'flex',
        marginBottom: '12px'
    },

    messageBubble: {
        maxWidth: '75%',
        padding: '10px 14px',
        borderRadius: '12px',
        overflowWrap: 'anywhere'
    },

    myMessage: {
        background: '#2563eb',
        color: '#ffffff',
        borderBottomRightRadius: '3px'
    },

    theirMessage: {
    background: '#7c3aed',
    backgroundColor: '#7c3aed',
    color: '#ffffff',
    border: '2px solid #6d28d9',
    borderBottomLeftRadius: '3px'
},
    messageText: {
        margin: 0,
        whiteSpace: 'pre-wrap',
        lineHeight: 1.5
    },

    messageTime: {
        display: 'block',
        textAlign: 'right',
        fontSize: '10px',
        marginTop: '5px',
        opacity: 0.75
    },

    inputArea: {
        display: 'flex',
        gap: '10px',
        padding: '14px',
        borderTop: '1px solid #e5e7eb',
        background: '#ffffff'
    },

    messageInput: {
        flex: 1,
        minWidth: 0,
        padding: '12px',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        outline: 'none',
        fontSize: '14px'
    },

    sendButton: {
        padding: '10px 18px',
        border: 'none',
        borderRadius: '8px',
        background: '#2563eb',
        color: '#ffffff',
        cursor: 'pointer',
        fontWeight: 'bold'
    },

    emptyChat: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        color: '#6b7280',
        textAlign: 'center',
        padding: '20px'
    },

    emptyText: {
        color: '#9ca3af',
        textAlign: 'center',
        padding: '15px',
        fontSize: '13px'
    },

    error: {
        padding: '10px 15px',
        background: '#fee2e2',
        color: '#991b1b',
        fontSize: '13px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },

    errorClose: {
        border: 'none',
        background: 'transparent',
        fontSize: '18px',
        cursor: 'pointer',
        color: '#991b1b'
    },

    centerMessage: {
        padding: '40px',
        textAlign: 'center',
        color: '#6b7280'
    },

    minimized: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '15px',
        background: '#1e40af',
        color: '#ffffff',
        borderRadius: '8px',
        cursor: 'pointer'
    },

    smallButton: {
        background: '#ffffff',
        color: '#1e40af',
        border: 'none',
        padding: '7px 12px',
        borderRadius: '5px',
        cursor: 'pointer'
    }
};

export default Messages;
