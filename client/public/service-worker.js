// ==========================================
// SERVICE WORKER - JOB PORTAL
// ==========================================

self.addEventListener('install', (event) => {

    console.log('Job Portal Service Worker installed.');

    self.skipWaiting();

});

self.addEventListener('activate', (event) => {

    console.log('Job Portal Service Worker activated.');

    event.waitUntil(
        self.clients.claim()
    );

});

// ==========================================
// RECEIVE PUSH NOTIFICATION
// ==========================================

self.addEventListener('push', (event) => {

    let data = {};

    try {

        if (event.data) {
            data = event.data.json();
        }

    } catch (error) {

        console.error(
            'Push notification parsing error:',
            error
        );

    }

    const title =
        data.title || 'Job Portal Notification';

    const options = {

        body:
            data.body ||
            data.message ||
            'You have a new notification.',

        icon:
            data.icon ||
            '/favicon.ico',

        badge:
            data.badge ||
            '/favicon.ico',

        data: {
            url: data.url || '/'
        },

        tag: data.tag || 'job-portal-notification',

        renotify: true

    };

    event.waitUntil(

        self.registration.showNotification(
            title,
            options
        )

    );

});

// ==========================================
// NOTIFICATION CLICK
// ==========================================

self.addEventListener('notificationclick', (event) => {

    event.notification.close();

    const targetUrl =
        event.notification.data?.url || '/';

    event.waitUntil(

        self.clients.matchAll({

            type: 'window',
            includeUncontrolled: true

        }).then((clientList) => {

            for (const client of clientList) {

                if ('focus' in client) {

                    return client.focus().then(() => {

                        if ('navigate' in client) {
                            return client.navigate(targetUrl);
                        }

                        return client;

                    });

                }

            }

            return self.clients.openWindow(targetUrl);

        })

    );

});