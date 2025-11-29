// 共通ヘッダーコンポーネント
(function() {
    'use strict';

    // ヘッダーCSS
    const headerCSS = `
        /* ヘッダー */
        header {
            background: var(--bg-dark);
            padding: 0 40px;
            border-bottom: 1px solid var(--border);
            position: sticky;
            top: 0;
            z-index: 100;
        }

        .header-content {
            max-width: 1200px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            height: 90px;
            gap: 50px;
        }

        .logo {
            text-decoration: none;
            display: flex;
            align-items: center;
        }

        .logo-img {
            height: 90px;
            width: auto;
        }

        nav {
            display: flex;
            gap: 8px;
        }

        nav a {
            color: var(--text-dim);
            text-decoration: none;
            font-size: 0.85rem;
            padding: 8px 16px;
            border-radius: 4px;
            transition: all 0.15s;
            white-space: nowrap;
        }

        nav a:hover, nav a.active {
            color: #fff;
            background: var(--bg-card);
        }

        /* 認証エリア */
        .auth-area {
            margin-left: auto;
            display: flex;
            align-items: center;
            gap: 12px;
            opacity: 0;
            transition: opacity 0.15s ease;
        }

        .auth-area.ready {
            opacity: 1;
        }

        .login-btn {
            background: var(--accent);
            color: #fff;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 0.85rem;
            cursor: pointer;
            transition: all 0.15s;
            white-space: nowrap;
            text-decoration: none;
            display: inline-block;
            box-sizing: border-box;
        }

        .login-btn:hover {
            background: #e55a2b;
        }

        .user-info {
            display: flex;
            align-items: center;
            gap: 10px;
            color: var(--text);
            font-size: 0.85rem;
        }

        .user-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: var(--bg-card);
        }

        .user-name {
            color: #fff;
        }

        .logout-btn {
            background: transparent;
            color: var(--text-dim);
            border: 1px solid var(--border);
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 0.8rem;
            cursor: pointer;
            transition: all 0.15s;
            white-space: nowrap;
        }

        .logout-btn:hover {
            color: #fff;
            border-color: var(--text-dim);
        }

        /* ユーザードロップダウン */
        .user-dropdown {
            position: relative;
        }

        .user-dropdown-btn {
            display: flex;
            align-items: center;
            gap: 10px;
            background: none;
            border: none;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 4px;
            transition: background 0.15s;
        }

        .user-dropdown-btn:hover {
            background: var(--bg-card);
        }

        .user-dropdown-menu {
            display: none;
            position: absolute;
            top: 100%;
            right: 0;
            margin-top: 8px;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 8px;
            min-width: 160px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 200;
            overflow: hidden;
        }

        .user-dropdown-menu.show {
            display: block;
        }

        .user-dropdown-menu a,
        .user-dropdown-menu button {
            display: block;
            width: 100%;
            padding: 12px 16px;
            text-align: left;
            color: var(--text);
            text-decoration: none;
            background: none;
            border: none;
            font-size: 0.9rem;
            cursor: pointer;
            transition: background 0.15s;
        }

        .user-dropdown-menu a:hover,
        .user-dropdown-menu button:hover {
            background: var(--bg-card-hover);
        }

        .user-dropdown-menu .divider {
            height: 1px;
            background: var(--border);
            margin: 4px 0;
        }

        /* ゲームページ用バックリンク */
        .back-link {
            color: var(--text-dim);
            text-decoration: none;
            font-size: 0.85rem;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: color 0.15s;
        }

        .back-link:hover {
            color: var(--text);
        }

        /* レスポンシブ 768px */
        @media (max-width: 768px) {
            header {
                padding: 0 20px;
            }

            .header-content {
                gap: 20px;
            }

            nav a {
                padding: 8px 12px;
                font-size: 0.8rem;
            }
        }

        /* スマホ向け（2段レイアウト） */
        @media (max-width: 600px) {
            header {
                padding: 0 4vw;
            }

            .header-content {
                flex-wrap: wrap;
                height: auto;
                padding: 10px 0;
                gap: 8px;
            }

            .logo-img {
                height: 60px;
            }

            nav {
                order: 3;
                width: 100%;
                justify-content: center;
                gap: 2vw;
                padding-top: 8px;
                border-top: 1px solid var(--border);
            }

            nav a {
                padding: 6px 12px;
                font-size: 0.8rem;
            }

            .auth-area {
                margin-left: auto;
            }

            .login-btn {
                padding: 6px 14px;
                font-size: 0.8rem;
            }
        }
    `;

    // 現在のページを判定
    function getCurrentPage() {
        const path = window.location.pathname;
        if (path.includes('/ranking')) return 'ranking';
        if (path.includes('/about')) return 'about';
        if (path.includes('/profile')) return 'profile';
        if (path.includes('/click-challenge')) return 'game';
        return 'home';
    }

    // ベースパスを取得
    function getBasePath() {
        const path = window.location.pathname;
        if (path.includes('/ranking/') || path.includes('/about/') || path.includes('/profile/') || path.includes('/click-challenge/')) {
            return '../';
        }
        return './';
    }

    // ヘッダーHTMLを生成
    function createHeaderHTML() {
        const currentPage = getCurrentPage();
        const basePath = getBasePath();

        // ゲームページはシンプルなヘッダー（バックリンクのみ）
        if (currentPage === 'game') {
            return `
                <div class="header-content">
                    <a href="${basePath}" class="logo">
                        <img src="${basePath}images/logo.png" alt="Rakia Games" class="logo-img">
                    </a>
                    <a href="${basePath}" class="back-link">← ゲーム一覧に戻る</a>
                </div>
            `;
        }

        // 通常ページはナビゲーション付きヘッダー
        return `
            <div class="header-content">
                <a href="${basePath}" class="logo">
                    <img src="${basePath}images/logo.png" alt="Rakia Games" class="logo-img">
                </a>
                <nav>
                    <a href="${basePath}" class="${currentPage === 'home' ? 'active' : ''}">ゲーム</a>
                    <a href="${basePath}ranking/" class="${currentPage === 'ranking' ? 'active' : ''}">ランキング</a>
                    <a href="${basePath}about/" class="${currentPage === 'about' ? 'active' : ''}">About</a>
                </nav>
                <div class="auth-area" id="authArea">
                    <button class="login-btn" id="loginBtn">ログイン</button>
                </div>
            </div>
        `;
    }

    // CSSを注入
    function injectCSS() {
        const style = document.createElement('style');
        style.id = 'header-styles';
        style.textContent = headerCSS;
        document.head.appendChild(style);
    }

    // ヘッダーを初期化
    function initHeader() {
        // CSSを注入
        if (!document.getElementById('header-styles')) {
            injectCSS();
        }

        // ヘッダー要素を取得
        const header = document.querySelector('header');
        if (header) {
            header.innerHTML = createHeaderHTML();
        }
    }

    // 即時実行
    initHeader();

    // グローバルに公開
    window.RakiaHeader = {
        init: initHeader,
        getBasePath: getBasePath,
        getCurrentPage: getCurrentPage
    };
})();
