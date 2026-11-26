import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API_URL } from '../config/api';

const Chat = ({ user, otherUser, onClose, socket }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [online, setOnline] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isMinimized, setIsMinimized] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [sending, setSending] = useState(false);

    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const typingResetRef = useRef(null);

    const getAuthHeaders = useCallback(() => {
    return {
        'Content-Type': 'application/json'
    };
}, []);

    // ==========================================
    // NORMALIZE MESSAGE DATA
    // ==========================================
    const normalizeMessage = useCallback((msg) => ({
        ...msg,
        id: msg.id,
        sender_id: msg.sender_id ?? msg.senderId,
        receiver_id: msg.receiver_id ?? msg.receiverId,
        created_at: msg.created_at ?? msg.createdAt,
        is_read: Boolean(msg.is_read ?? msg.isRead)
    }), []);

    // ==========================================
    // FETCH MESSAGE HISTORY
    // ==========================================
    const fetchMessages = useCallback(async () => {
        if (!user?.id || !otherUser?.id) {
            setLoading(false);
            return;
        }

        setLoading(true);

        try {
            const res = await fetch(
                `${API_URL}/api/messages/${user.id}/${otherUser.id}`,
                {
    method: 'GET',
    credentials: 'include',
    headers: getAuthHeaders()
}
            );

            if (!res.ok) {
                throw new Error(`Messages API error: ${res.status}`);
            }

            const result = await res.json();

            const messageList = Array.isArray(result)
                ? result
                : Array.isArray(result?.data)
                    ? result.data
                    : [];

            setMessages(messageList.map(normalizeMessage));

        } catch (error) {
            console.error('Error fetching messages:', error);
            setMessages([]);
        } finally {
            setLoading(false);
        }
    }, [user?.id, otherUser?.id, getAuthHeaders, normalizeMessage]);

    // ==========================================
    // FETCH MESSAGES WHEN CHAT OPENS
    // ==========================================
    useEffect(() => {
        fetchMessages();
    }, [fetchMessages]);

    
// ==========================================
// SOCKET EVENTS
// ==========================================
useEffect(() => {
    if (!socket || !user?.id || !otherUser?.id) {
        return undefined;
    }

    const currentUserId = String(user.id);
    const otherUserId = String(otherUser.id);

    // Request the current online users when socket connects.
    const requestOnlineUsers = () => {
        socket.emit('get-online-users');

        socket.emit('mark-read', {
            otherUserId: otherUser.id
        });
    };

    // Handle incoming and outgoing messages.
    const handleNewMessage = (rawMessage) => {
        const message = normalizeMessage(rawMessage);

        const senderId = String(message.sender_id ?? '');
        const receiverId = String(message.receiver_id ?? '');

        const belongsToConversation =
            (senderId === currentUserId && receiverId === otherUserId) ||
            (senderId === otherUserId && receiverId === currentUserId);

        if (!belongsToConversation) return;

        setMessages(prev => {
            const alreadyExists = prev.some(
                item => String(item.id) === String(message.id)
            );

            if (alreadyExists) return prev;

            return [...prev, message];
        });

        // Mark incoming messages as read.
        if (senderId === otherUserId && socket.connected) {
            socket.emit('mark-read', {
                otherUserId: otherUser.id
            });
        }
    };

    // Handle typing indicator.
    const handleTyping = (data) => {
        if (String(data?.userId) === otherUserId) {
            setIsTyping(true);

            if (typingResetRef.current) {
                clearTimeout(typingResetRef.current);
            }

            typingResetRef.current = setTimeout(() => {
                setIsTyping(false);
                typingResetRef.current = null;
            }, 1500);
        }
    };

    // Handle online users.
    const handleOnlineUsers = (users) => {
        const onlineIds = Array.isArray(users)
            ? users.map(id => String(id))
            : [];

        setOnline(onlineIds.includes(otherUserId));
    };

    // Handle read receipts.
    const handleReadUpdate = (data) => {
        const readerId = String(
            data?.userId ?? data?.readerId ?? ''
        );

        if (readerId !== otherUserId) return;

        setMessages(prev =>
            prev.map(msg =>
                String(msg.sender_id) === currentUserId
                    ? { ...msg, is_read: true }
                    : msg
            )
        );
    };

    // Register listeners before checking connection status.
    socket.on('new-message', handleNewMessage);
    socket.on('user-typing', handleTyping);
    socket.on('online-users', handleOnlineUsers);
    socket.on('read-update', handleReadUpdate);
    socket.on('connect', requestOnlineUsers);

    // If socket is already connected, request immediately.
    if (socket.connected) {
        requestOnlineUsers();
    }

    return () => {
        socket.off('new-message', handleNewMessage);
        socket.off('user-typing', handleTyping);
        socket.off('online-users', handleOnlineUsers);
        socket.off('read-update', handleReadUpdate);
        socket.off('connect', requestOnlineUsers);

        if (typingResetRef.current) {
            clearTimeout(typingResetRef.current);
            typingResetRef.current = null;
        }
    };
}, [
    socket,
    user?.id,
    otherUser?.id,
    normalizeMessage
]);


    // ==========================================
    // SCROLL TO LATEST MESSAGE
    // ==========================================
    useEffect(() => {
        if (!isMinimized) {
            messagesEndRef.current?.scrollIntoView({
                behavior: 'smooth'
            });
        }
    }, [messages, isTyping, isMinimized]);

    // ==========================================
    // SEND MESSAGE
    // ==========================================
    const sendMessage = () => {
        const messageText = newMessage.trim();

        if (!messageText || sending) return;

        if (!socket || !socket.connected) {
            console.error('Socket is not connected.');
            return;
        }

        setSending(true);

        // Sender ID is obtained securely by the server from JWT.
        socket.emit('send-message', {
            receiverId: otherUser.id,
            message: messageText
        });

        setNewMessage('');
        setSending(false);
    };

    // ==========================================
    // TYPING EVENT
    // ==========================================
    const handleTyping = () => {
        if (!socket || !socket.connected || !otherUser?.id) {
            return;
        }

        socket.emit('typing', {
            receiverId: otherUser.id
        });

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
            typingTimeoutRef.current = null;
        }, 1500);
    };

    // ==========================================
    // MESSAGE STYLE
    // ==========================================
    const getMessageStyle = (msg) => {
        if (String(msg.sender_id) === String(user?.id)) {
            return styles.myMessage;
        }

        return msg.is_read
            ? styles.otherMessageRead
            : styles.otherMessageUnread;
    };

    // ==========================================
    // MINIMIZE CHAT
    // ==========================================
    const toggleMinimize = () => {
        setIsMinimized(prev => !prev);
    };
    const toggleMaximize = () => {
    setIsMinimized(false);
    setIsMaximized(prev => !prev);
};

    // ==========================================
    // CLOSE CHAT
    // ==========================================
    const handleClose = () => {
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        if (typingResetRef.current) {
            clearTimeout(typingResetRef.current);
        }

        onClose?.();
    };

    // ==========================================
    // STYLES
    // ==========================================
    const styles = {
        overlay: {
    position: 'fixed',
    top: isMaximized ? 0 : 'auto',
    left: isMaximized ? 0 : 'auto',
    bottom: isMaximized ? 0 : 20,
    right: isMaximized ? 0 : 20,
    width: isMaximized
        ? '100vw'
        : isMinimized ? '380px' : '90%',
    maxWidth: isMaximized
        ? 'none'
        : isMinimized ? '380px' : '500px',
    height: isMaximized
        ? '100vh'
        : isMinimized ? '60px' : '550px',
    maxHeight: isMaximized
        ? '100vh'
        : isMinimized ? '60px' : '80vh',
    background: '#1a3d1a',
    borderRadius: isMaximized ? '0' : '15px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 5px 25px rgba(0,0,0,0.3)',
    zIndex: 1000,
    overflow: 'hidden',
    transition: 'all 0.3s ease',
    cursor: isMinimized ? 'pointer' : 'default'
},

        header: {
            padding: '1rem',
            background: '#2ecc71',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer'
        },

        headerInfo: {
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
        },

        onlineDot: {
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: online ? '#2ecc71' : '#888'
        },

        headerButtons: {
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center'
        },

        minimizeBtn: {
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            borderRadius: '5px',
            color: '#fff',
            width: '28px',
            height: '28px',
            cursor: 'pointer',
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        },

        closeBtn: {
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            borderRadius: '5px',
            color: '#fff',
            width: '28px',
            height: '28px',
            cursor: 'pointer',
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        },

        messagesArea: {
            flex: 1,
            padding: isMinimized ? 0 : '1rem',
            overflowY: 'auto',
            display: isMinimized ? 'none' : 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
        },

        myMessage: {
            alignSelf: 'flex-end',
            background: '#2ecc71',
            padding: '0.5rem 1rem',
            borderRadius: '18px',
            maxWidth: '80%',
            overflowWrap: 'break-word',
            color: '#000'
        },

        otherMessageUnread: {
            alignSelf: 'flex-start',
            background: '#0a2a0a',
            padding: '0.5rem 1rem',
            borderRadius: '18px',
            maxWidth: '80%',
            overflowWrap: 'break-word',
            border: '2px solid #2ecc71',
            color: '#fff'
        },

        otherMessageRead: {
            alignSelf: 'flex-start',
            background: '#1a3d1a',
            padding: '0.5rem 1rem',
            borderRadius: '18px',
            maxWidth: '80%',
            overflowWrap: 'break-word',
            opacity: 0.7,
            color: '#fff'
        },

        senderName: {
            fontSize: '0.7rem',
            fontWeight: 'bold',
            opacity: 0.8,
            marginBottom: '3px',
            color: 'inherit'
        },

        time: {
            fontSize: '0.65rem',
            opacity: 0.7,
            marginTop: '0.2rem',
            textAlign: 'right'
        },

        typing: {
            fontSize: '0.8rem',
            color: '#aaa',
            padding: '0.5rem 1rem',
            display: isMinimized ? 'none' : 'block'
        },

        inputArea: {
            padding: isMinimized ? 0 : '1rem',
            borderTop: '1px solid rgba(46,204,113,0.3)',
            display: isMinimized ? 'none' : 'flex',
            gap: '0.5rem'
        },

        input: {
            flex: 1,
            padding: '0.5rem',
            borderRadius: '20px',
            border: 'none',
            background: '#0a2a0a',
            color: '#fff',
            outline: 'none'
        },

        sendBtn: {
            padding: '0.5rem 1rem',
            background: '#2ecc71',
            border: 'none',
            borderRadius: '20px',
            color: '#000',
            cursor: 'pointer',
            fontWeight: 'bold',
            opacity: sending ? 0.6 : 1
        },

        minimizedPreview: {
            display: isMinimized ? 'flex' : 'none',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1rem',
            height: '60px',
            color: '#fff'
        },

        unreadBadge: {
            background: '#e74c3c',
            borderRadius: '50%',
            padding: '2px 6px',
            fontSize: '0.7rem',
            marginLeft: '8px'
        },

        loading: {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            color: '#aaa'
        }
    };

    const unreadMessages = messages.filter(
        msg =>
            String(msg.sender_id) !== String(user?.id) &&
            !msg.is_read
    ).length;

    // ==========================================
    // MINIMIZED CHAT VIEW
    // ==========================================
    if (isMinimized) {
        return (
            <div style={styles.overlay} onClick={toggleMinimize}>
                <div style={styles.header}>
                    <div style={styles.headerInfo}>
                        <div style={styles.onlineDot}></div>
                        <span>💬 {otherUser?.name}</span>

                        {unreadMessages > 0 && (
                            <span style={styles.unreadBadge}>
                                {unreadMessages}
                            </span>
                        )}
                    </div>

                    <div style={styles.headerButtons}>
                        <button
                            type="button"
                            style={styles.minimizeBtn}
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleMinimize();
                            }}
                        >
                            □
                        </button>

                        <button
    type="button"
    style={styles.minimizeBtn}
    onClick={toggleMaximize}
    title={isMaximized ? 'Restore' : 'Maximize'}
>
    {isMaximized ? '❐' : '⛶'}
</button>

<button
    type="button"
    style={styles.closeBtn}
    onClick={handleClose}
>
    ✕
</button>
                    </div>
                </div>

                <div style={styles.minimizedPreview}>
                    <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                        {messages.length > 0
                            ? `📝 ${messages[messages.length - 1]?.message?.substring(0, 40)}...`
                            : 'No messages yet'}
                    </span>
                </div>
            </div>
        );
    }

    // ==========================================
    // LOADING VIEW
    // ==========================================
    if (loading) {
        return (
            <div style={styles.overlay}>
                <div style={styles.header}>
                    <div style={styles.headerInfo}>
                        <div style={styles.onlineDot}></div>
                        <span>{otherUser?.name || 'User'}</span>
                    </div>

                    <div style={styles.headerButtons}>
                        <button
                            type="button"
                            style={styles.minimizeBtn}
                            onClick={toggleMinimize}
                        >
                            _
                        </button>

                        <button
    type="button"
    style={styles.minimizeBtn}
    onClick={toggleMaximize}
    title={isMaximized ? 'Restore' : 'Maximize'}
>
    {isMaximized ? '❐' : '⛶'}
</button>

<button
    type="button"
    style={styles.closeBtn}
    onClick={handleClose}
>
    ✕
</button>
                    </div>
                </div>

                <div style={styles.loading}>
                    Loading messages...
                </div>
            </div>
        );
    }

    // ==========================================
    // MAIN CHAT VIEW
    // ==========================================
    return (
        <div style={styles.overlay}>
            <div style={styles.header}>
                <div style={styles.headerInfo}>
                    <div style={styles.onlineDot}></div>

                    <span>
                        💬 {otherUser?.name}
                        {online ? ' (Online)' : ' (Offline)'}
                    </span>
                </div>

                <div style={styles.headerButtons}>
                    <button
                        type="button"
                        style={styles.minimizeBtn}
                        onClick={toggleMinimize}
                    >
                        _
                    </button>

                    <button
                        type="button"
                        style={styles.closeBtn}
                        onClick={handleClose}
                    >
                        ✕
                    </button>
                </div>
            </div>

            <div style={styles.messagesArea}>
                {messages.length === 0 ? (
                    <div
                        style={{
                            textAlign: 'center',
                            color: '#aaa',
                            marginTop: '20px'
                        }}
                    >
                        No messages yet. Start the conversation!
                    </div>
                ) : (
                    messages.map((msg, idx) => {
                        const isMine =
                            String(msg.sender_id) === String(user.id);

                        return (
                            <div
                                key={msg.id ?? idx}
                                style={getMessageStyle(msg)}
                            >
                                <div style={styles.senderName}>
    <div>
        From: {isMine
            ? (user?.name || 'You')
            : (otherUser?.name || 'User')}
    </div>

    <div>
        To: {isMine
            ? (otherUser?.name || 'User')
            : (user?.name || 'You')}
    </div>
</div>

                                <div>{msg.message}</div>

                                <div style={styles.time}>
                                    {msg.created_at
                                        ? new Date(msg.created_at).toLocaleTimeString(
                                            [],
                                            {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            }
                                        )
                                        : ''}

                                    {isMine && (
                                        <span style={{ marginLeft: '5px' }}>
                                            {msg.is_read ? '✓✓' : '✓'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}

                {isTyping && (
                    <div style={styles.typing}>
                        ✍️ Typing...
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <div style={styles.inputArea}>
                <input
                    style={styles.input}
                    value={newMessage}
                    onChange={(e) => {
                        setNewMessage(e.target.value);
                        handleTyping();
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            sendMessage();
                        }
                    }}
                    placeholder="Type a message..."
                />

                <button
                    type="button"
                    style={styles.sendBtn}
                    onClick={sendMessage}
                    disabled={sending || !newMessage.trim()}
                >
                    Send
                </button>
            </div>
        </div>
    );
};

export default Chat;
