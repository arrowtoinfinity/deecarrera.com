(function (global) {
    'use strict';

    const CMS_DATA_URL = '/data/cms.json';
    const CMS_CACHE_KEY = 'cms_data_cache_v1';
    const CMS_MIGRATION_FLAG_KEY = 'cms_migrated_v1';
    const ADMIN_KEY_SESSION = 'cms_admin_key';
    const LEGACY_STORAGE_KEYS = [
        'site_settings',
        'literature_posts',
        'software_apps',
        'art_videos',
        'art_photos',
        'music_tracks',
        'hardware_projects',
        'textiles_items'
    ];

    const DEFAULT_CMS = {
        version: 1,
        updatedAt: '2026-02-15T00:00:00.000Z',
        settings: {
            sectionOrder: ['latest', 'art', 'hardware', 'literature', 'music', 'software', 'textiles'],
            latestSource: 'literature',
            latestSectionTitle: 'Latest',
            latestSectionTarget: '',
            showLatestSection: true,
            showArtSection: true,
            showHardwareSection: true,
            showLiteratureSection: true,
            showMusicSection: true,
            showSoftwareSection: true,
            showTextilesSection: true,
            navOrder: ['art', 'literature', 'music', 'software', 'hardware', 'textiles'],
            showArtNav: true,
            showLiteratureNav: true,
            showMusicNav: true,
            showSoftwareNav: true,
            showHardwareNav: true,
            showTextilesNav: true
        },
        posts: [
            {
                id: 'default_1',
                type: 'essay',
                title: 'On the Nature of Creative Work',
                date: '2026-01-20',
                content: 'A longer exploration of how creativity intersects with discipline, and why the most meaningful work often emerges from constraint rather than freedom.',
                link: '#',
                visibility: 'visible'
            },
            {
                id: 'default_2',
                type: 'meditation',
                quote: 'The impediment to action advances action. What stands in the way becomes the way.',
                citation: '- Marcus Aurelius, Meditations',
                visibility: 'visible'
            },
            {
                id: 'default_3',
                type: 'post',
                title: 'Your First Blog Post',
                date: '2026-01-23',
                content: 'This is where your blog post excerpt will appear. Write about anything that interests you.',
                link: '#',
                visibility: 'visible'
            },
            {
                id: 'default_4',
                type: 'meditation',
                quote: 'Waste no more time arguing about what a good man should be. Be one.',
                citation: '- Marcus Aurelius, Meditations',
                visibility: 'visible'
            },
            {
                id: 'default_5',
                type: 'essay',
                title: 'The Quiet Architecture of Habit',
                date: '2026-01-15',
                content: 'How small, repeated actions compound into the invisible structure of our lives, and why understanding this changes everything about how we approach change.',
                link: '#',
                visibility: 'visible'
            }
        ],
        apps: [
            {
                id: 'app_1',
                name: 'Tiempo',
                subtitle: 'AI-Daily Planner for iOS and macOS',
                description: 'Tiempo reimagines how you interact with your calendar.',
                icon: 'icon-tiempo.png',
                link: '/software.html#tiempo',
                status: 'available'
            },
            {
                id: 'app_2',
                name: 'Synesthesia',
                subtitle: 'VisionOS app for experiencing music visually',
                icon: 'icon-synesthesia.png',
                status: 'coming_soon'
            },
            {
                id: 'app_3',
                name: 'Arrow',
                subtitle: 'VisionOS app for Spatial Messaging',
                icon: 'icon-arrow.png',
                status: 'coming_soon'
            }
        ],
        videos: [
            { id: 'vid_1', title: 'Video 1', url: '', thumbnail: '', visibility: 'visible' },
            { id: 'vid_2', title: 'Video 2', url: '', thumbnail: '', visibility: 'visible' },
            { id: 'vid_3', title: 'Video 3', url: '', thumbnail: '', visibility: 'visible' },
            { id: 'vid_4', title: 'Video 4', url: '', thumbnail: '', visibility: 'visible' },
            { id: 'vid_5', title: 'Video 5', url: '', thumbnail: '', visibility: 'visible' }
        ],
        photos: [
            { id: 'photo_1', title: 'Photo 1', url: '', visibility: 'visible' },
            { id: 'photo_2', title: 'Photo 2', url: '', visibility: 'visible' },
            { id: 'photo_3', title: 'Photo 3', url: '', visibility: 'visible' },
            { id: 'photo_4', title: 'Photo 4', url: '', visibility: 'visible' },
            { id: 'photo_5', title: 'Photo 5', url: '', visibility: 'visible' },
            { id: 'photo_6', title: 'Photo 6', url: '', visibility: 'visible' }
        ],
        tracks: [
            { id: 'track_1', title: 'Paradox', file: 'Paradox.mp3', visibility: 'visible' }
        ],
        hardware: [],
        textiles: []
    };

    let memoryCms = null;
    let inFlight = null;

    function deepClone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function asArray(value, fallback) {
        return Array.isArray(value) ? value : fallback;
    }

    function hasLegacyLocalStorageData() {
        try {
            return LEGACY_STORAGE_KEYS.some((key) => localStorage.getItem(key) !== null);
        } catch {
            return false;
        }
    }

    function isMigratedToRemoteCms() {
        try {
            return localStorage.getItem(CMS_MIGRATION_FLAG_KEY) === '1';
        } catch {
            return false;
        }
    }

    function mergeCms(input) {
        const cms = input && typeof input === 'object' ? input : {};
        return {
            version: typeof cms.version === 'number' ? cms.version : DEFAULT_CMS.version,
            updatedAt: typeof cms.updatedAt === 'string' ? cms.updatedAt : new Date().toISOString(),
            settings: { ...DEFAULT_CMS.settings, ...(cms.settings || {}) },
            posts: asArray(cms.posts, DEFAULT_CMS.posts),
            apps: asArray(cms.apps, DEFAULT_CMS.apps),
            videos: asArray(cms.videos, DEFAULT_CMS.videos),
            photos: asArray(cms.photos, DEFAULT_CMS.photos),
            tracks: asArray(cms.tracks, DEFAULT_CMS.tracks),
            hardware: asArray(cms.hardware, DEFAULT_CMS.hardware),
            textiles: asArray(cms.textiles, DEFAULT_CMS.textiles)
        };
    }

    function readCachedCms() {
        try {
            const raw = localStorage.getItem(CMS_CACHE_KEY);
            if (!raw) return null;
            return mergeCms(JSON.parse(raw));
        } catch {
            return null;
        }
    }

    function writeCachedCms(cms) {
        try {
            localStorage.setItem(CMS_CACHE_KEY, JSON.stringify(cms));
        } catch {
            // Ignore storage quota/privacy failures.
        }
    }

    function readLegacyLocalStorage() {
        if (!hasLegacyLocalStorageData()) {
            return null;
        }

        try {
            const parse = (key, fallback) => {
                const raw = localStorage.getItem(key);
                return raw ? JSON.parse(raw) : fallback;
            };

            const legacy = {
                version: 1,
                updatedAt: new Date().toISOString(),
                settings: parse('site_settings', DEFAULT_CMS.settings),
                posts: parse('literature_posts', DEFAULT_CMS.posts),
                apps: parse('software_apps', DEFAULT_CMS.apps),
                videos: parse('art_videos', DEFAULT_CMS.videos),
                photos: parse('art_photos', DEFAULT_CMS.photos),
                tracks: parse('music_tracks', DEFAULT_CMS.tracks),
                hardware: parse('hardware_projects', DEFAULT_CMS.hardware),
                textiles: parse('textiles_items', DEFAULT_CMS.textiles)
            };

            return mergeCms(legacy);
        } catch {
            return null;
        }
    }

    async function fetchCms(options) {
        const opts = options || {};
        const force = !!opts.force;

        if (!force && !isMigratedToRemoteCms()) {
            const legacy = readLegacyLocalStorage();
            if (legacy) {
                memoryCms = legacy;
                writeCachedCms(legacy);
                return deepClone(legacy);
            }
        }

        if (memoryCms && !force) {
            return deepClone(memoryCms);
        }

        if (inFlight && !force) {
            const result = await inFlight;
            return deepClone(result);
        }

        inFlight = (async () => {
            try {
                const response = await fetch(CMS_DATA_URL, { cache: 'no-store' });
                if (!response.ok) {
                    throw new Error(`Failed to fetch CMS data (${response.status})`);
                }
                const payload = await response.json();
                const merged = mergeCms(payload);
                memoryCms = merged;
                writeCachedCms(merged);
                return merged;
            } catch (error) {
                const cached = readCachedCms();
                if (cached) {
                    memoryCms = cached;
                    return cached;
                }
                const legacy = readLegacyLocalStorage();
                if (legacy) {
                    memoryCms = legacy;
                    return legacy;
                }
                memoryCms = deepClone(DEFAULT_CMS);
                return memoryCms;
            }
        })();

        try {
            const result = await inFlight;
            return deepClone(result);
        } finally {
            inFlight = null;
        }
    }

    async function saveCmsViaWorker(cms, config) {
        const cfg = config || {};
        const workerUrl = (cfg.workerUrl || '').trim().replace(/\/$/, '');
        const adminKey = (cfg.adminKey || '').trim();

        if (!workerUrl) throw new Error('Missing Worker URL');
        if (!adminKey) throw new Error('Missing admin key');

        const body = {
            cms: mergeCms(cms),
            commitMessage: cfg.commitMessage || `cms: update ${new Date().toISOString()}`
        };

        const response = await fetch(`${workerUrl}/cms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${adminKey}`
            },
            body: JSON.stringify(body)
        });

        const text = await response.text();
        let payload;
        try {
            payload = text ? JSON.parse(text) : {};
        } catch {
            payload = { error: text || 'Unknown response' };
        }

        if (!response.ok) {
            throw new Error(payload.error || `Save failed (${response.status})`);
        }

        const merged = mergeCms(body.cms);
        merged.updatedAt = payload.updatedAt || merged.updatedAt;
        memoryCms = merged;
        writeCachedCms(merged);
        return payload;
    }

    function getAdminKey() {
        return sessionStorage.getItem(ADMIN_KEY_SESSION) || '';
    }

    function setAdminKey(value) {
        sessionStorage.setItem(ADMIN_KEY_SESSION, value);
    }

    function clearAdminKey() {
        sessionStorage.removeItem(ADMIN_KEY_SESSION);
    }

    global.CMS = {
        CMS_DATA_URL,
        DEFAULT_CMS: deepClone(DEFAULT_CMS),
        mergeCms,
        fetchCms,
        saveCmsViaWorker,
        getAdminKey,
        setAdminKey,
        clearAdminKey,
        readLegacyLocalStorage,
        readCachedCms,
        writeCachedCms
    };
})(window);
