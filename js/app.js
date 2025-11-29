// ========================================
// Rakia Games - SPA Main Application
// ========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, addDoc, collection, query, orderBy, limit, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// Firebase設定
const firebaseConfig = {
    apiKey: "AIzaSyCqlOPEvdpg8rlgrT0bt1cUzRH2jKtfRqw",
    authDomain: "rakiagames.firebaseapp.com",
    projectId: "rakiagames",
    storageBucket: "rakiagames.firebasestorage.app",
    messagingSenderId: "988630075198",
    appId: "1:988630075198:web:b3eb7f4767d29cbce4ce6f",
    measurementId: "G-M44D45510V"
};

// Firebase初期化
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const googleProvider = new GoogleAuthProvider();

// ========================================
// グローバル状態管理
// ========================================
const App = {
    state: {
        user: null,
        userProfile: null,
        isAuthReady: false,
        currentRoute: null,
        games: []
    },

    // 認証キャッシュ
    AUTH_CACHE_KEY: 'authCache',
    RANKING_CACHE_KEY: 'rankingCache',
    RANKING_CACHE_DURATION: 15 * 60 * 1000, // 15分

    // 状態変更リスナー
    listeners: [],

    subscribe(fn) {
        this.listeners.push(fn);
        return () => {
            this.listeners = this.listeners.filter(l => l !== fn);
        };
    },

    notify() {
        this.listeners.forEach(fn => fn(this.state));
    },

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.notify();
    }
};

// ========================================
// ルーター
// ========================================
const Router = {
    routes: {},

    register(path, handler) {
        this.routes[path] = handler;
    },

    navigate(path, pushState = true) {
        if (pushState) {
            history.pushState({ path }, '', path);
        }
        this.handleRoute(path);
    },

    handleRoute(path) {
        // パスを正規化
        let normalizedPath = path.replace(/\/$/, '') || '/';

        // ルートマッチング
        let handler = this.routes[normalizedPath];

        // 動的ルートのチェック
        if (!handler) {
            for (const [pattern, h] of Object.entries(this.routes)) {
                if (pattern.includes(':')) {
                    const regex = new RegExp('^' + pattern.replace(/:[\w]+/g, '([\\w-]+)') + '$');
                    const match = normalizedPath.match(regex);
                    if (match) {
                        handler = h;
                        App.setState({ routeParams: match.slice(1) });
                        break;
                    }
                }
            }
        }

        if (handler) {
            App.setState({ currentRoute: normalizedPath });
            handler();
        } else {
            // 404
            this.routes['/']?.();
        }
    },

    init() {
        // ブラウザの戻る/進むボタン対応
        window.addEventListener('popstate', (e) => {
            const path = e.state?.path || window.location.pathname;
            this.handleRoute(path);
        });

        // リンククリックをインターセプト
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (link && link.href.startsWith(window.location.origin)) {
                const path = link.getAttribute('href');
                if (path && !path.startsWith('http') && !path.startsWith('#')) {
                    e.preventDefault();
                    this.navigate(path);
                }
            }
        });

        // GitHub Pages 404リダイレクト対応
        const redirectPath = sessionStorage.getItem('redirectPath');
        if (redirectPath) {
            sessionStorage.removeItem('redirectPath');
            this.navigate(redirectPath, true);
        } else {
            // 初期ルート
            this.handleRoute(window.location.pathname);
        }
    }
};

// ========================================
// 認証機能
// ========================================
const Auth = {
    getCache() {
        try {
            const cached = sessionStorage.getItem(App.AUTH_CACHE_KEY);
            return cached ? JSON.parse(cached) : null;
        } catch { return null; }
    },

    setCache(data) {
        sessionStorage.setItem(App.AUTH_CACHE_KEY, JSON.stringify(data));
    },

    clearCache() {
        sessionStorage.removeItem(App.AUTH_CACHE_KEY);
    },

    async getUserProfile(uid) {
        try {
            const docSnap = await getDoc(doc(db, 'users', uid));
            return docSnap.exists() ? docSnap.data() : null;
        } catch (error) {
            console.error('プロフィール取得エラー:', error);
            return null;
        }
    },

    async saveUserProfile(uid, data) {
        try {
            await setDoc(doc(db, 'users', uid), data, { merge: true });
            return true;
        } catch (error) {
            console.error('プロフィール保存エラー:', error);
            return false;
        }
    },

    async signInWithGoogle() {
        try {
            await signInWithPopup(auth, googleProvider);
            return { success: true };
        } catch (error) {
            console.error('Googleログインエラー:', error);
            return { success: false, error: 'Googleログインに失敗しました' };
        }
    },

    async signInWithEmail(email, password) {
        try {
            await signInWithEmailAndPassword(auth, email, password);
            return { success: true };
        } catch (error) {
            return { success: false, error: this.getErrorMessage(error.code) };
        }
    },

    async signUpWithEmail(email, password) {
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            return { success: true };
        } catch (error) {
            return { success: false, error: this.getErrorMessage(error.code) };
        }
    },

    async signOut() {
        try {
            await signOut(auth);
            this.clearCache();
        } catch (error) {
            console.error('ログアウトエラー:', error);
        }
    },

    getErrorMessage(code) {
        const messages = {
            'auth/email-already-in-use': 'このメールアドレスは既に使用されています',
            'auth/invalid-email': 'メールアドレスの形式が正しくありません',
            'auth/weak-password': 'パスワードは6文字以上にしてください',
            'auth/user-not-found': 'メールアドレスまたはパスワードが正しくありません',
            'auth/wrong-password': 'メールアドレスまたはパスワードが正しくありません',
            'auth/invalid-credential': 'メールアドレスまたはパスワードが正しくありません'
        };
        return messages[code] || '認証に失敗しました';
    },

    init() {
        // キャッシュから即時表示
        const cached = this.getCache();
        if (cached) {
            App.setState({
                user: cached.loggedIn ? { cached: true } : null,
                userProfile: cached.loggedIn ? { displayName: cached.displayName, avatarId: cached.avatarId } : null
            });
        }

        // 認証状態監視
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                const profile = await this.getUserProfile(user.uid);
                const displayName = profile?.displayName || 'ユーザー';
                const avatarId = profile?.avatarId || 'cat-orange';

                this.setCache({ loggedIn: true, displayName, avatarId });
                App.setState({
                    user,
                    userProfile: profile || { displayName, avatarId },
                    isAuthReady: true,
                    needsUsername: !profile?.displayName
                });
            } else {
                this.setCache({ loggedIn: false });
                App.setState({
                    user: null,
                    userProfile: null,
                    isAuthReady: true,
                    needsUsername: false
                });
            }

            // ヘッダー更新
            Components.Header.updateAuth();
        });
    }
};

// ========================================
// ランキング機能
// ========================================
const Ranking = {
    getCache() {
        try {
            const cached = localStorage.getItem(App.RANKING_CACHE_KEY);
            if (!cached) return null;
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp > App.RANKING_CACHE_DURATION) {
                return null;
            }
            return { data, timestamp };
        } catch {
            return null;
        }
    },

    setCache(data) {
        localStorage.setItem(App.RANKING_CACHE_KEY, JSON.stringify({
            data,
            timestamp: Date.now()
        }));
    },

    clearCache() {
        localStorage.removeItem(App.RANKING_CACHE_KEY);
    },

    async load(force = false) {
        if (!force) {
            const cached = this.getCache();
            if (cached) {
                console.log('ランキング: キャッシュから取得');
                return cached;
            }
        }

        try {
            console.log('ランキング: Firebaseから取得');
            const q = query(
                collection(db, 'rankings'),
                orderBy('score', 'desc'),
                limit(10)
            );
            const snapshot = await getDocs(q);
            const rankings = [];
            snapshot.forEach(doc => {
                rankings.push(doc.data());
            });
            this.setCache(rankings);
            return { data: rankings, timestamp: Date.now() };
        } catch (error) {
            console.error('ランキング取得エラー:', error);
            return null;
        }
    },

    async submit(name, score) {
        try {
            const { user, userProfile } = App.state;

            if (user && !user.cached && userProfile) {
                // ログインユーザー
                const docRef = doc(db, 'rankings', user.uid);
                const existingDoc = await getDoc(docRef);

                if (existingDoc.exists()) {
                    if (score > existingDoc.data().score) {
                        await setDoc(docRef, {
                            name: userProfile.displayName,
                            score,
                            uid: user.uid,
                            timestamp: serverTimestamp()
                        });
                    }
                } else {
                    await setDoc(docRef, {
                        name: userProfile.displayName,
                        score,
                        uid: user.uid,
                        timestamp: serverTimestamp()
                    });
                }
            } else {
                // 未ログイン
                await addDoc(collection(db, 'rankings'), {
                    name: name.slice(0, 20),
                    score,
                    timestamp: serverTimestamp()
                });
            }

            this.clearCache();
            return true;
        } catch (error) {
            console.error('スコア登録エラー:', error);
            return false;
        }
    },

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    },

    getNextUpdateTime(timestamp) {
        const next = new Date(timestamp + App.RANKING_CACHE_DURATION);
        return next.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    }
};

// ========================================
// ユーティリティ
// ========================================
const Utils = {
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    $(selector) {
        return document.querySelector(selector);
    },

    $$(selector) {
        return document.querySelectorAll(selector);
    }
};

// ========================================
// コンポーネント
// ========================================
const Components = {
    Header: {
        render(isGamePage = false) {
            if (isGamePage) {
                return `
                    <div class="header-content">
                        <a href="/" class="logo">
                            <img src="./images/logo.png" alt="Rakia Games" class="logo-img">
                        </a>
                        <a href="/" class="back-link">← ゲーム一覧に戻る</a>
                    </div>
                `;
            }

            const currentPath = App.state.currentRoute || '/';

            return `
                <div class="header-content">
                    <a href="/" class="logo">
                        <img src="./images/logo.png" alt="Rakia Games" class="logo-img">
                    </a>
                    <nav>
                        <a href="/" class="${currentPath === '/' ? 'active' : ''}">ゲーム</a>
                        <a href="/ranking" class="${currentPath === '/ranking' ? 'active' : ''}">ランキング</a>
                        <a href="/about" class="${currentPath === '/about' ? 'active' : ''}">About</a>
                    </nav>
                    <div class="auth-area" id="authArea">
                        <button class="login-btn" id="loginBtn">ログイン</button>
                    </div>
                </div>
            `;
        },

        updateAuth() {
            const authArea = Utils.$('#authArea');
            if (!authArea) return;

            const { user, userProfile } = App.state;

            if (user) {
                const name = userProfile?.displayName || 'ユーザー';
                const avatarId = userProfile?.avatarId || 'cat-orange';

                authArea.innerHTML = `
                    <div class="user-dropdown">
                        <button class="user-dropdown-btn" id="userDropdownBtn">
                            <img src="./images/avatars/${avatarId}.svg" class="user-avatar">
                            <span class="user-name">${Utils.escapeHtml(name)}</span>
                        </button>
                        <div class="user-dropdown-menu" id="userDropdownMenu">
                            <a href="/profile">プロフィール</a>
                            <div class="divider"></div>
                            <button id="logoutBtn">ログアウト</button>
                        </div>
                    </div>
                `;

                Utils.$('#userDropdownBtn')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    Utils.$('#userDropdownMenu')?.classList.toggle('show');
                });

                Utils.$('#logoutBtn')?.addEventListener('click', () => Auth.signOut());
            } else {
                authArea.innerHTML = '<button class="login-btn" id="loginBtn">ログイン</button>';
                Utils.$('#loginBtn')?.addEventListener('click', () => Modals.showLogin());
            }

            authArea.classList.add('ready');
        }
    },

    Footer: {
        render() {
            return `
                <div class="footer-content">
                    <p>&copy; 2025 Rakia Games</p>
                    <p>Made with fun</p>
                </div>
            `;
        }
    },

    RankingList: {
        render(rankings, id = 'rankingList') {
            if (rankings === null) {
                return `<ul class="ranking-list" id="${id}"><li class="ranking-empty">取得に失敗しました</li></ul>`;
            }
            if (!rankings || rankings.length === 0) {
                return `<ul class="ranking-list" id="${id}"><li class="ranking-empty">まだ記録がありません</li></ul>`;
            }

            return `
                <ul class="ranking-list" id="${id}">
                    ${rankings.map((r, i) => `
                        <li class="ranking-item">
                            <span class="ranking-rank">${i + 1}</span>
                            <span class="ranking-name">${Utils.escapeHtml(r.name)}</span>
                            <span class="ranking-score">${r.score} 回</span>
                        </li>
                    `).join('')}
                </ul>
            `;
        }
    }
};

// ========================================
// モーダル
// ========================================
const Modals = {
    container: null,

    init() {
        this.container = document.createElement('div');
        this.container.id = 'modals';
        document.body.appendChild(this.container);
    },

    showLogin() {
        this.container.innerHTML = `
            <div class="modal-overlay active" id="loginModal">
                <div class="modal">
                    <h2 class="modal-title" id="modalTitle">ログイン</h2>

                    <button class="google-btn" id="googleLoginBtn">
                        <svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                        Googleでログイン
                    </button>

                    <div class="auth-divider"><span>または</span></div>

                    <form class="auth-form" id="emailForm">
                        <input type="email" class="auth-input" id="emailInput" placeholder="メールアドレス" required>
                        <input type="password" class="auth-input" id="passwordInput" placeholder="パスワード" required>
                        <button type="submit" class="auth-submit" id="emailSubmitBtn">ログイン</button>
                    </form>

                    <p class="auth-error" id="authError"></p>

                    <p class="auth-toggle" id="authToggle">
                        アカウントをお持ちでない方は <a id="toggleLink">新規登録</a>
                    </p>
                </div>
            </div>
        `;

        let isSignUp = false;

        const modal = Utils.$('#loginModal');
        const googleBtn = Utils.$('#googleLoginBtn');
        const emailForm = Utils.$('#emailForm');
        const toggleLink = Utils.$('#toggleLink');
        const modalTitle = Utils.$('#modalTitle');
        const submitBtn = Utils.$('#emailSubmitBtn');
        const authToggle = Utils.$('#authToggle');
        const authError = Utils.$('#authError');

        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.close();
        });

        googleBtn.addEventListener('click', async () => {
            const result = await Auth.signInWithGoogle();
            if (result.success) {
                this.close();
                if (App.state.needsUsername) {
                    this.showUsername();
                }
            } else {
                authError.textContent = result.error;
            }
        });

        const updateToggle = () => {
            isSignUp = !isSignUp;
            if (isSignUp) {
                modalTitle.textContent = '新規登録';
                submitBtn.textContent = '登録';
                authToggle.innerHTML = 'すでにアカウントをお持ちの方は <a id="toggleLink">ログイン</a>';
            } else {
                modalTitle.textContent = 'ログイン';
                submitBtn.textContent = 'ログイン';
                authToggle.innerHTML = 'アカウントをお持ちでない方は <a id="toggleLink">新規登録</a>';
            }
            Utils.$('#toggleLink').addEventListener('click', updateToggle);
            authError.textContent = '';
        };

        toggleLink.addEventListener('click', updateToggle);

        emailForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = Utils.$('#emailInput').value;
            const password = Utils.$('#passwordInput').value;
            authError.textContent = '';

            const result = isSignUp
                ? await Auth.signUpWithEmail(email, password)
                : await Auth.signInWithEmail(email, password);

            if (result.success) {
                this.close();
                if (App.state.needsUsername) {
                    this.showUsername();
                }
            } else {
                authError.textContent = result.error;
            }
        });
    },

    showUsername() {
        const { user } = App.state;
        const defaultName = user?.displayName || user?.email?.split('@')[0] || '';

        this.container.innerHTML = `
            <div class="modal-overlay active" id="usernameModal">
                <div class="modal">
                    <h2 class="modal-title">ユーザーネームを設定</h2>
                    <p style="color: var(--text-dim); font-size: 0.85rem; margin-bottom: 16px; text-align: center;">ランキングに表示される名前です</p>
                    <input type="text" class="auth-input" id="usernameInput" placeholder="ユーザーネーム" maxlength="20" value="${Utils.escapeHtml(defaultName)}" required>
                    <p class="auth-error" id="usernameError"></p>
                    <button class="auth-submit" id="saveUsernameBtn" style="margin-top: 16px; width: 100%;">決定</button>
                </div>
            </div>
        `;

        const input = Utils.$('#usernameInput');
        const saveBtn = Utils.$('#saveUsernameBtn');
        const error = Utils.$('#usernameError');

        setTimeout(() => input.focus(), 100);

        const save = async () => {
            const name = input.value.trim();
            if (!name) {
                error.textContent = 'ユーザーネームを入力してください';
                return;
            }
            if (name.length < 2) {
                error.textContent = '2文字以上で入力してください';
                return;
            }

            saveBtn.disabled = true;
            saveBtn.textContent = '保存中...';

            const { user } = App.state;
            const success = await Auth.saveUserProfile(user.uid, { displayName: name });

            if (success) {
                App.setState({
                    userProfile: { ...App.state.userProfile, displayName: name },
                    needsUsername: false
                });
                Auth.setCache({ loggedIn: true, displayName: name, avatarId: App.state.userProfile?.avatarId || 'cat-orange' });
                Components.Header.updateAuth();
                this.close();
            } else {
                error.textContent = '保存に失敗しました';
                saveBtn.disabled = false;
                saveBtn.textContent = '決定';
            }
        };

        saveBtn.addEventListener('click', save);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') save();
        });
    },

    showNameInput(onSubmit) {
        const lastName = localStorage.getItem('clickChallengeLastName') || '';

        this.container.innerHTML = `
            <div class="modal-overlay active" id="nameModal">
                <div class="modal">
                    <h2 class="modal-title">名前を入力</h2>
                    <input type="text" class="auth-input" id="playerName" placeholder="ニックネーム" maxlength="20" value="${Utils.escapeHtml(lastName)}" autocomplete="off">
                    <div style="display: flex; gap: 10px; margin-top: 20px;">
                        <button class="control-button secondary" id="cancelBtn" style="flex: 1;">キャンセル</button>
                        <button class="control-button" id="submitBtn" style="flex: 1;">登録</button>
                    </div>
                </div>
            </div>
        `;

        const modal = Utils.$('#nameModal');
        const input = Utils.$('#playerName');
        const submitBtn = Utils.$('#submitBtn');
        const cancelBtn = Utils.$('#cancelBtn');

        setTimeout(() => input.focus(), 100);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.close();
        });

        cancelBtn.addEventListener('click', () => this.close());

        const submit = () => {
            const name = input.value.trim();
            if (!name) {
                input.focus();
                return;
            }
            localStorage.setItem('clickChallengeLastName', name);
            onSubmit(name);
        };

        submitBtn.addEventListener('click', submit);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submit();
        });
    },

    close() {
        this.container.innerHTML = '';
    }
};

// ========================================
// ページコンポーネント
// ========================================
const Pages = {
    // ホームページ（ゲーム一覧）
    async Home() {
        const main = Utils.$('main');

        // ゲームデータを取得
        let games = App.state.games;
        if (games.length === 0) {
            try {
                const response = await fetch('./data/games.json');
                games = await response.json();
                App.setState({ games });
            } catch (error) {
                console.error('ゲームデータ取得エラー:', error);
                games = [];
            }
        }

        main.innerHTML = `
            <div class="page-container">
                <div class="page-header">
                    <h1 class="page-title">ゲームライブラリ</h1>
                    <p class="page-subtitle">ブラウザで遊べるミニゲーム集</p>
                </div>

                <div class="games-grid">
                    ${games.map(game => `
                        <div class="game-card${game.comingSoon ? ' coming-soon' : ''}" data-game="${game.id}">
                            <div class="game-thumbnail">
                                ${game.image
                                    ? `<img src="./images/${game.image}" alt="${Utils.escapeHtml(game.title)}">`
                                    : '<span class="placeholder">?</span>'
                                }
                            </div>
                            <div class="game-info">
                                <div class="game-title">${Utils.escapeHtml(game.title)}</div>
                                <div class="game-description">${Utils.escapeHtml(game.description)}</div>
                                <div class="game-tags">
                                    ${game.tags.map(tag => `<span class="tag">${Utils.escapeHtml(tag)}</span>`).join('')}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // ゲームカードクリック
        Utils.$$('.game-card:not(.coming-soon)').forEach(card => {
            card.addEventListener('click', () => {
                const gameId = card.dataset.game;
                Router.navigate(`/games/${gameId}`);
            });
        });

        // ヘッダー更新
        Utils.$('header').innerHTML = Components.Header.render(false);
        Components.Header.updateAuth();
    },

    // ランキングページ
    async Ranking() {
        const main = Utils.$('main');

        main.innerHTML = `
            <div class="page-container narrow">
                <div class="page-header">
                    <h1 class="page-title">ランキング</h1>
                    <p class="page-subtitle">各ゲームのトップスコア</p>
                </div>

                <div class="game-ranking">
                    <div class="game-ranking-header">
                        <img src="./images/click-challenge.png" alt="10秒クリックチャレンジ" class="game-icon">
                        <div class="game-info">
                            <h2>10秒クリックチャレンジ</h2>
                            <p>10秒間で何回クリックできる？</p>
                        </div>
                        <a href="/games/click-challenge" class="play-link">プレイする</a>
                    </div>
                    <ul class="ranking-list" id="clickChallengeRanking">
                        <li class="ranking-loading">読み込み中...</li>
                    </ul>
                </div>

                <p class="cache-info" id="cacheInfo"></p>
            </div>
        `;

        // ヘッダー更新
        Utils.$('header').innerHTML = Components.Header.render(false);
        Components.Header.updateAuth();

        // ランキング読み込み
        const result = await Ranking.load();
        const list = Utils.$('#clickChallengeRanking');
        const cacheInfo = Utils.$('#cacheInfo');

        if (result) {
            list.outerHTML = Components.RankingList.render(result.data, 'clickChallengeRanking');
            cacheInfo.textContent = `最終更新: ${Ranking.formatTime(result.timestamp)} / 次回更新: ${Ranking.getNextUpdateTime(result.timestamp)}`;
        } else {
            list.innerHTML = '<li class="ranking-empty">取得に失敗しました</li>';
        }
    },

    // Aboutページ
    About() {
        const main = Utils.$('main');

        main.innerHTML = `
            <div class="page-container very-narrow">
                <h1 class="page-title" style="margin-bottom: 40px;">About</h1>

                <div class="section">
                    <h2>このサイトについて</h2>
                    <p>Rakia Gamesは、ブラウザで気軽に遊べるミニゲーム集です。暇つぶしや息抜きに、サクッと楽しめるゲームを作っています。</p>
                </div>

                <div class="section">
                    <h2>作者</h2>
                    <p class="author-name">Rakia</p>
                </div>
            </div>
        `;

        // ヘッダー更新
        Utils.$('header').innerHTML = Components.Header.render(false);
        Components.Header.updateAuth();
    },

    // プロフィールページ
    async Profile() {
        const main = Utils.$('main');
        const { user, userProfile } = App.state;

        // アバターリスト
        const avatars = {
            cat: ['cat-orange', 'cat-blue', 'cat-purple', 'cat-green'],
            dog: ['dog-orange', 'dog-blue', 'dog-purple', 'dog-green'],
            robot: ['robot-orange', 'robot-blue', 'robot-purple', 'robot-green'],
            geo: ['geo-triangle', 'geo-hexagon', 'geo-diamond', 'geo-star', 'geo-circles', 'geo-squares', 'geo-spiral', 'geo-burst']
        };
        const allAvatars = [...avatars.cat, ...avatars.dog, ...avatars.robot, ...avatars.geo];

        if (!user || user.cached) {
            main.innerHTML = `
                <div class="page-container narrow">
                    <h1 class="page-title">プロフィール</h1>
                    <div class="login-required">
                        <p>プロフィールを表示するには<a href="#" id="loginLink">ログイン</a>してください</p>
                    </div>
                </div>
            `;

            Utils.$('#loginLink')?.addEventListener('click', (e) => {
                e.preventDefault();
                Modals.showLogin();
            });
        } else {
            const currentAvatarId = userProfile?.avatarId || 'cat-orange';

            main.innerHTML = `
                <div class="page-container narrow">
                    <h1 class="page-title">プロフィール</h1>

                    <div class="profile-card">
                        <div class="profile-header">
                            <div class="current-avatar">
                                <img src="./images/avatars/${currentAvatarId}.svg" alt="アバター" id="avatarImg">
                            </div>
                            <div class="profile-info">
                                <h2 id="displayName">${Utils.escapeHtml(userProfile?.displayName || 'ユーザー')}</h2>
                                <p id="userEmail">${Utils.escapeHtml(user.email || '')}</p>
                            </div>
                        </div>

                        <div class="section">
                            <h3 class="section-title">ユーザーネーム</h3>
                            <div class="name-form">
                                <input type="text" class="name-input" id="nameInput" maxlength="20" placeholder="ユーザーネーム" value="${Utils.escapeHtml(userProfile?.displayName || '')}">
                                <button class="save-btn" id="saveNameBtn">保存</button>
                            </div>
                            <p class="save-status" id="nameStatus"></p>
                        </div>

                        <div class="section">
                            <h3 class="section-title">ランキング成績</h3>
                            <div class="stats-grid" id="statsGrid">
                                <p class="no-stats">読み込み中...</p>
                            </div>
                        </div>

                        <div class="section">
                            <h3 class="section-title">アバター</h3>
                            <div class="avatar-grid" id="avatarGrid">
                                ${allAvatars.map(id => `
                                    <div class="avatar-option${id === currentAvatarId ? ' selected' : ''}" data-avatar="${id}">
                                        <img src="./images/avatars/${id}.svg" alt="${id}">
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // ユーザーネーム保存
            const saveNameBtn = Utils.$('#saveNameBtn');
            const nameInput = Utils.$('#nameInput');
            const nameStatus = Utils.$('#nameStatus');

            saveNameBtn.addEventListener('click', async () => {
                const name = nameInput.value.trim();
                if (!name || name.length < 2) {
                    nameStatus.textContent = '2文字以上で入力してください';
                    nameStatus.className = 'save-status error';
                    return;
                }

                saveNameBtn.disabled = true;
                saveNameBtn.textContent = '保存中...';
                nameStatus.textContent = '';

                const success = await Auth.saveUserProfile(user.uid, { displayName: name });

                if (success) {
                    Utils.$('#displayName').textContent = name;
                    App.setState({ userProfile: { ...userProfile, displayName: name } });
                    Auth.setCache({ loggedIn: true, displayName: name, avatarId: userProfile?.avatarId || 'cat-orange' });
                    Components.Header.updateAuth();
                    nameStatus.textContent = '保存しました';
                    nameStatus.className = 'save-status success';
                } else {
                    nameStatus.textContent = '保存に失敗しました';
                    nameStatus.className = 'save-status error';
                }

                saveNameBtn.disabled = false;
                saveNameBtn.textContent = '保存';
            });

            // アバター選択
            Utils.$$('.avatar-option').forEach(option => {
                option.addEventListener('click', async () => {
                    const avatarId = option.dataset.avatar;

                    Utils.$$('.avatar-option').forEach(el => el.classList.remove('selected'));
                    option.classList.add('selected');
                    Utils.$('#avatarImg').src = `./images/avatars/${avatarId}.svg`;

                    await Auth.saveUserProfile(user.uid, { avatarId });
                    App.setState({ userProfile: { ...userProfile, avatarId } });
                    Auth.setCache({ loggedIn: true, displayName: userProfile?.displayName, avatarId });
                    Components.Header.updateAuth();
                });
            });

            // ランキング成績読み込み
            const statsGrid = Utils.$('#statsGrid');
            try {
                const q = query(collection(db, 'rankings'), orderBy('score', 'desc'));
                const snapshot = await getDocs(q);

                let rank = 0;
                let userScore = null;

                snapshot.docs.forEach((docSnap, index) => {
                    if (docSnap.id === user.uid || docSnap.data().uid === user.uid) {
                        rank = index + 1;
                        userScore = docSnap.data().score;
                    }
                });

                if (userScore !== null) {
                    statsGrid.innerHTML = `
                        <div class="stat-card">
                            <p class="stat-game">10秒クリックチャレンジ</p>
                            <p class="stat-score">${userScore}<span style="font-size:0.5em">回</span></p>
                            <p class="stat-rank ${rank <= 3 ? 'top3' : ''}">${rank}位 / ${snapshot.size}人中</p>
                        </div>
                    `;
                } else {
                    statsGrid.innerHTML = '<p class="no-stats">まだランキング登録がありません</p>';
                }
            } catch (error) {
                console.error('ランキング取得エラー:', error);
                statsGrid.innerHTML = '<p class="no-stats">読み込みに失敗しました</p>';
            }
        }

        // ヘッダー更新
        Utils.$('header').innerHTML = Components.Header.render(false);
        Components.Header.updateAuth();
    },

    // ゲームページ（動的）
    async Game(gameId) {
        // ゲームモジュールを動的読み込み
        try {
            const module = await import(`./pages/games/${gameId}.js`);
            module.default({ App, Auth, Ranking, Utils, Components, Modals, Router });
        } catch (error) {
            console.error('ゲーム読み込みエラー:', error);
            Router.navigate('/');
        }
    }
};

// ========================================
// ルート登録
// ========================================
Router.register('/', Pages.Home);
Router.register('/ranking', Pages.Ranking);
Router.register('/about', Pages.About);
Router.register('/profile', Pages.Profile);
Router.register('/games/:gameId', () => {
    const gameId = App.state.routeParams?.[0];
    Pages.Game(gameId);
});

// ========================================
// 初期化
// ========================================
function init() {
    // モーダル初期化
    Modals.init();

    // 認証初期化
    Auth.init();

    // フッター描画
    Utils.$('footer').innerHTML = Components.Footer.render();

    // ルーター初期化
    Router.init();

    // ドロップダウン閉じる
    document.addEventListener('click', () => {
        Utils.$('#userDropdownMenu')?.classList.remove('show');
    });

    // Service Worker登録
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(() => console.log('Service Worker registered'))
            .catch((err) => console.log('Service Worker registration failed:', err));
    }
}

// DOM準備完了後に初期化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// グローバルエクスポート（ゲームモジュール用）
window.RakiaApp = { App, Auth, Ranking, Utils, Components, Modals, Router, db, auth };
