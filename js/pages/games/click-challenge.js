// ========================================
// 10秒クリックチャレンジ
// ========================================

export default function ClickChallenge({ App, Auth, Ranking, Utils, Components, Modals, Router }) {
    const GAME_DURATION = 10000;

    let clickCount = 0;
    let startTime = null;
    let gameActive = false;
    let currentScore = 0;
    let scoreRegistered = false;
    let animationFrameId = null;

    // ベストスコア
    function getBestScore() {
        return parseInt(localStorage.getItem('clickChallengeBestScore') || '0', 10);
    }

    function setBestScore(score) {
        localStorage.setItem('clickChallengeBestScore', score.toString());
    }

    // ヘッダー更新（ゲームページ用）
    Utils.$('header').innerHTML = Components.Header.render(true);

    // メインコンテンツ描画
    const main = Utils.$('main');
    main.innerHTML = `
        <div class="game-wrapper">
            <!-- 左サイド広告 -->
            <aside class="ad-side ad-left">
                <div class="ad-label">広告</div>
            </aside>

            <!-- メインコンテンツ -->
            <div class="game-container">
                <h1>10秒クリックチャレンジ</h1>

                <!-- 待機画面 -->
                <div id="startScreen">
                    <p style="color: var(--text-dim); margin: 16px 0;">10秒間で何回クリックできるかな？</p>
                    <button class="control-button" id="startButton">スタート</button>
                    <div class="best-score">
                        <div class="best-score-label">自己ベスト</div>
                        <div class="best-score-value" id="bestScoreStart">${getBestScore()} 回</div>
                    </div>

                    <div class="ranking-section">
                        <div class="ranking-title">ランキング TOP10</div>
                        <ul class="ranking-list" id="rankingListStart">
                            <li class="ranking-loading">読み込み中...</li>
                        </ul>
                    </div>
                </div>

                <!-- ゲーム画面 -->
                <div id="gameScreen" class="hidden">
                    <div class="stats">
                        <div class="stat-box">
                            <div class="stat-label">残り時間</div>
                            <div class="stat-value timer" id="timer">10.0</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-label">クリック数</div>
                            <div class="stat-value click-count" id="clickCount">0</div>
                        </div>
                    </div>
                    <button class="click-button" id="clickButton">
                        クリック！
                    </button>
                    <div class="cps">CPS: <span id="liveCps">0.0</span></div>
                </div>

                <!-- 結果画面 -->
                <div id="resultScreen" class="hidden">
                    <p style="font-size: 1rem; color: var(--text-dim);">結果</p>
                    <div class="final-score" id="finalScore">0</div>
                    <div class="cps">CPS (クリック/秒): <span id="finalCps">0.0</span></div>
                    <div class="new-record" id="newRecord">NEW RECORD!</div>
                    <div class="best-score">
                        <div class="best-score-label">自己ベスト</div>
                        <div class="best-score-value" id="bestScoreResult">${getBestScore()} 回</div>
                    </div>
                    <div style="margin-top: 20px;">
                        <button class="control-button secondary" id="registerButton" style="display: none;">ランキング登録</button>
                    </div>
                    <div class="save-status" id="registerStatus"></div>
                    <button class="control-button" id="retryButton" style="margin-top: 10px;">もう一度</button>

                    <div class="ranking-section">
                        <div class="ranking-title">ランキング TOP10</div>
                        <ul class="ranking-list" id="rankingListResult">
                            <li class="ranking-loading">読み込み中...</li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- 右サイド広告 -->
            <aside class="ad-side ad-right">
                <div class="ad-label">広告</div>
            </aside>
        </div>
    `;

    // DOM要素
    const startScreen = Utils.$('#startScreen');
    const gameScreen = Utils.$('#gameScreen');
    const resultScreen = Utils.$('#resultScreen');
    const startButton = Utils.$('#startButton');
    const clickButton = Utils.$('#clickButton');
    const retryButton = Utils.$('#retryButton');
    const timerDisplay = Utils.$('#timer');
    const clickCountDisplay = Utils.$('#clickCount');
    const liveCpsDisplay = Utils.$('#liveCps');
    const finalScoreDisplay = Utils.$('#finalScore');
    const finalCpsDisplay = Utils.$('#finalCps');
    const newRecordDisplay = Utils.$('#newRecord');
    const bestScoreStart = Utils.$('#bestScoreStart');
    const bestScoreResult = Utils.$('#bestScoreResult');
    const registerButton = Utils.$('#registerButton');
    const registerStatus = Utils.$('#registerStatus');
    const rankingListStart = Utils.$('#rankingListStart');
    const rankingListResult = Utils.$('#rankingListResult');

    function updateBestScoreDisplay() {
        const best = getBestScore();
        bestScoreStart.textContent = `${best} 回`;
        bestScoreResult.textContent = `${best} 回`;
    }

    function showScreen(screen) {
        startScreen.classList.add('hidden');
        gameScreen.classList.add('hidden');
        resultScreen.classList.add('hidden');
        screen.classList.remove('hidden');
    }

    async function updateRankings(force = false) {
        const result = await Ranking.load(force);
        const data = result?.data || null;

        rankingListStart.outerHTML = Components.RankingList.render(data, 'rankingListStart');
        rankingListResult.outerHTML = Components.RankingList.render(data, 'rankingListResult');
    }

    function startGame() {
        clickCount = 0;
        gameActive = true;
        scoreRegistered = false;
        startTime = performance.now();

        clickCountDisplay.textContent = '0';
        timerDisplay.textContent = '10.0';
        timerDisplay.className = 'stat-value timer';
        liveCpsDisplay.textContent = '0.0';
        clickButton.disabled = false;
        registerButton.disabled = false;
        registerButton.style.display = 'none';
        registerStatus.textContent = '';
        registerStatus.className = 'save-status';

        showScreen(gameScreen);

        function updateTimer() {
            if (!gameActive) return;

            const elapsed = performance.now() - startTime;
            const remaining = Math.max(0, GAME_DURATION - elapsed);
            const remainingSeconds = remaining / 1000;

            timerDisplay.textContent = remainingSeconds.toFixed(1);

            if (remainingSeconds <= 1) {
                timerDisplay.className = 'stat-value timer danger';
            } else if (remainingSeconds <= 3) {
                timerDisplay.className = 'stat-value timer warning';
            } else {
                timerDisplay.className = 'stat-value timer';
            }

            if (elapsed > 0) {
                const cps = (clickCount / (elapsed / 1000)).toFixed(1);
                liveCpsDisplay.textContent = cps;
            }

            if (remaining > 0) {
                animationFrameId = requestAnimationFrame(updateTimer);
            } else {
                endGame();
            }
        }

        animationFrameId = requestAnimationFrame(updateTimer);
    }

    function endGame() {
        gameActive = false;
        clickButton.disabled = true;
        currentScore = clickCount;

        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }

        const finalCps = (clickCount / 10).toFixed(1);
        finalScoreDisplay.textContent = clickCount;
        finalCpsDisplay.textContent = finalCps;

        const bestScore = getBestScore();
        const isNewRecord = clickCount > bestScore;

        if (isNewRecord) {
            setBestScore(clickCount);
            updateBestScoreDisplay();
            newRecordDisplay.classList.add('show');
            registerButton.style.display = 'inline-block';
            createConfetti();
        } else {
            newRecordDisplay.classList.remove('show');
            registerButton.style.display = 'none';
        }

        showScreen(resultScreen);
        updateRankings();
    }

    function createConfetti() {
        const colors = ['#ff6b35', '#fcd34d', '#4ade80', '#60a5fa', '#a78bfa'];
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.className = 'confetti';
                confetti.style.left = Math.random() * 100 + 'vw';
                confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
                confetti.style.animationDelay = Math.random() * 0.5 + 's';
                document.body.appendChild(confetti);
                setTimeout(() => confetti.remove(), 4000);
            }, i * 30);
        }
    }

    function handleClick(e) {
        if (!gameActive) return;
        e.preventDefault();
        clickCount++;
        clickCountDisplay.textContent = clickCount;
        clickButton.classList.remove('clicked');
        void clickButton.offsetWidth;
        clickButton.classList.add('clicked');
    }

    // イベントリスナー
    startButton.addEventListener('click', startGame);
    retryButton.addEventListener('click', startGame);

    clickButton.addEventListener('mousedown', handleClick);
    clickButton.addEventListener('touchstart', handleClick, { passive: false });

    document.addEventListener('touchend', (e) => {
        if (e.target === clickButton) {
            e.preventDefault();
        }
    }, { passive: false });

    registerButton.addEventListener('click', async () => {
        if (scoreRegistered) return;

        const { user, userProfile } = App.state;

        if (user && !user.cached && userProfile) {
            // ログインユーザー: 直接登録
            registerButton.disabled = true;
            registerButton.textContent = '登録中...';

            const success = await Ranking.submit(null, currentScore);
            if (success) {
                scoreRegistered = true;
                registerStatus.textContent = '登録しました！';
                registerStatus.className = 'save-status success';
                await updateRankings(true);
            } else {
                registerStatus.textContent = '登録に失敗しました';
                registerStatus.className = 'save-status error';
                registerButton.disabled = false;
            }
            registerButton.textContent = 'ランキング登録';
        } else {
            // 未ログイン: 名前入力モーダル
            Modals.showNameInput(async (name) => {
                registerButton.disabled = true;
                registerButton.textContent = '登録中...';

                const success = await Ranking.submit(name, currentScore);

                if (success) {
                    scoreRegistered = true;
                    Modals.close();
                    registerStatus.textContent = '登録しました！';
                    registerStatus.className = 'save-status success';
                    registerButton.disabled = true;
                    await updateRankings(true);
                } else {
                    registerStatus.textContent = '登録に失敗しました';
                    registerStatus.className = 'save-status error';
                }

                registerButton.textContent = 'ランキング登録';
            });
        }
    });

    // 初期化
    updateBestScoreDisplay();
    updateRankings();
}
