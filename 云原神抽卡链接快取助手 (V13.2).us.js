// ==UserScript==
// @name         云原神抓包 V13.2
// @namespace    http://tampermonkey.net/
// @version     13.2
// @description  游戏画面正中央实时读秒，不弹窗骚扰，结果原位展示
// @author       You
// @match        *://ys.mihoyo.com/cloud*
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    // 1. 样式定义
    const style = document.createElement('style');
    style.textContent = `
        #ys-launcher-panel {
            position: fixed; right: 15px; bottom: 15px; z-index: 2147483647 !important;
            background: rgba(10, 10, 10, 0.9); backdrop-filter: blur(4px);
            padding: 10px; border-radius: 14px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.7); display: flex; flex-direction: column; gap: 8px;
            color: #fff; min-width: 110px; font-family: sans-serif;
            pointer-events: auto !important; border: 1px solid rgba(255,255,255,0.1);
        }
        #ys-btn-catch {
            padding: 12px 10px; border: none; border-radius: 8px; font-size: 14px;
            font-weight: bold; color: #fff; cursor: pointer; touch-action: manipulation;
            width: 100%; text-align: center; background: linear-gradient(135deg, #FF9800, #E65100);
        }
        #ys-btn-catch:active { opacity: 0.7; }
        @media (max-width: 600px) {
            #ys-launcher-panel { right: 10px; bottom: 10px; padding: 8px; min-width: 90px; }
            #ys-btn-catch { padding: 12px 6px; font-size: 13px; }
        }

        /* ----- 读秒悬浮提示框 ----- */
        #ys-readout {
            position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%);
            z-index: 2147483647 !important; pointer-events: none; /* 保证不挡住游戏交互 */
            background: rgba(0, 0, 0, 0.75); border-radius: 30px;
            padding: 30px 50px; display: none;
            flex-direction: column; align-items: center; justify-content: center;
            backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.2);
            min-width: 200px;
        }
        #ys-readout .icon { font-size: 40px; margin-bottom: 10px; }
        #ys-readout .timer-text { font-size: 28px; font-weight: bold; color: #fff; font-family: sans-serif; }
        #ys-readout .sub-text { font-size: 14px; color: #aaa; margin-top: 5px; }

        /* ----- 结果展示悬浮框 ----- */
        #ys-result-box {
            position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%);
            width: 90%; max-width: 450px; z-index: 2147483647 !important;
            background: #1a1a1a; color: #fff; padding: 24px; border-radius: 18px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.8); font-family: sans-serif;
            display: none; flex-direction: column; gap: 15px;
            border: 1px solid #444;
        }
        #ys-result-box textarea {
            width: 100%; min-height: 200px; padding: 12px; font-size: 13px;
            border: 1px solid #444; border-radius: 10px; background: #2c2c2c;
            color: #ffeb3b; resize: vertical; box-sizing: border-box; word-break: break-all; line-height: 1.6;
        }
        #ys-result-close {
            padding: 14px; background: #ff5722; border: none;
            color: white; width: 100%; border-radius: 10px; font-size: 16px; font-weight: bold; pointer-events: auto;
        }
    `;
    document.head.appendChild(style);

    // 2. 构建 HTML
    const panel = document.createElement('div');
    panel.id = 'ys-launcher-panel';
    panel.innerHTML = `<button id="ys-btn-catch">📋 抓取链接</button>`;
    document.body.appendChild(panel);

    // 读秒提示框
    const readout = document.createElement('div');
    readout.id = 'ys-readout';
    readout.innerHTML = `
        <div class="icon">⏳</div>
        <div class="timer-text" id="ys-timer-text">8 秒</div>
        <div class="sub-text">正在等待云服务器响应...</div>
    `;
    document.body.appendChild(readout);

    // 结果展示框
    const resultBox = document.createElement('div');
    resultBox.id = 'ys-result-box';
    resultBox.innerHTML = `
        <div style="font-size:18px; font-weight:bold; color:#ffeb3b; text-align:center;">✅ 抓取成功</div>
        <div style="background: #c62828; color: #fff; padding: 8px; border-radius: 6px; text-align:center; font-size:13px;">⚠️ 含私人 authkey，请勿发给任何人</div>
        <div style="font-size:13px; color:#aaa;">👆 手机用户请直接长按下方链接复制</div>
        <textarea id="ys-final-link" readonly></textarea>
        <button id="ys-result-close">关闭并继续</button>
    `;
    document.body.appendChild(resultBox);

    document.getElementById('ys-result-close').addEventListener('click', () => {
        document.getElementById('ys-result-box').style.display = 'none';
    });

    // 3. 终极不死守卫
    setInterval(() => {
        if (document.body && !document.getElementById('ys-launcher-panel')) {
            document.body.appendChild(panel);
        }
    }, 800);

    // 4. 抓取逻辑（原位实时读秒）
    document.addEventListener('click', function(e) {
        if (e.target.id === 'ys-btn-catch') {
            handleGachaCatch();
        }
    });

    async function handleGachaCatch() {
        const userConfirm = confirm("⚠️ 准备抓取！\n\n确保已【手动】在游戏内点开了【抽卡记录】窗口。\n点「确定」开始等待并抓取。");
        if (!userConfirm) return;

        // 显示中间的读秒面板
        const timerText = document.getElementById('ys-timer-text');
        readout.style.display = 'flex';

        // 开始倒计时（8秒）
        let secondsLeft = 8;
        const countdownInterval = setInterval(() => {
            secondsLeft--;
            if (secondsLeft > 0) {
                timerText.innerText = secondsLeft + ' 秒';
            } else {
                timerText.innerText = '正在抓取...';
                clearInterval(countdownInterval);
            }
        }, 1000);

        // 实际等待 8 秒
        await new Promise(r => setTimeout(r, 8000));

        // 收起读秒框
        readout.style.display = 'none';

        // 开始抓取
        const iframe = document.querySelector('iframe.mhy-webview_frame');
        let finalUrl = null;
        if (iframe && iframe.src && iframe.src.includes('webstatic.mihoyo.com')) {
            finalUrl = iframe.src;
        } else {
            const fullHTML = document.documentElement.outerHTML;
            const regex = /(https:\/\/webstatic\.mihoyo\.com\/hk4e\/event\/e20190909gacha[^\s"']*?authkey=[^\s"']*?)(?:["'\s]|$)/;
            const matched = fullHTML.match(regex);
            if (matched) finalUrl = matched[1];
        }

        if (finalUrl) {
            try { GM_setClipboard(finalUrl); } catch(e) {}

            const textarea = document.getElementById('ys-final-link');
            textarea.value = finalUrl;
            document.getElementById('ys-result-box').style.display = 'flex';
        } else {
            alert(`❌ 8秒后依然没抓到链接。\n\n建议：\n1. 关掉抽卡记录，重新【手动】点开一次。\n2. 确保点开后，在抽卡记录页面停留超过 8 秒。\n3. 再次点击【抓取链接】按钮。`);
        }
    }
})();