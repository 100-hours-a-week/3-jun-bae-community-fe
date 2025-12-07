import { API_BASE, TIMEOUT_MS } from "./core/defaults.js";
import { getSessionUser, ensureSession } from "./core/session.js";

document.addEventListener("DOMContentLoaded", () => {
    const loading = document.getElementById("loading");
    const scoreContainer = document.getElementById("score-container");
    const errorContainer = document.getElementById("error-message");
    const errorText = document.getElementById("error-text");

    const totalScoreEl = document.getElementById("total-score");
    const totalVotesEl = document.getElementById("total-votes");
    const correctVotesEl = document.getElementById("correct-votes");
    const accuracyEl = document.getElementById("accuracy");

    init();

    async function init() {
        const user = await ensureSession();
        if (!user) {
            showError("로그인이 필요합니다.");
            return;
        }

        try {
            // Updated to single API call
            const response = await fetchWithTimeout(`${API_BASE}/rankings?limit=20`, {
                method: "GET",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                timeout: TIMEOUT_MS
            });

            if (!response.ok) {
                throw new Error("랭킹 정보를 불러오지 못했습니다.");
            }

            const result = await response.json();

            if (!result.success || !result.data) {
                throw new Error("잘못된 응답 형식입니다.");
            }

            const { myRanking, rankings } = result.data;

            if (myRanking) {
                renderMyScore(myRanking);
            }
            renderRankingList(rankings);

            scoreContainer.removeAttribute("hidden");

        } catch (error) {
            console.error(error);
            showError(error.message);
        } finally {
            loading.setAttribute("hidden", "true");
        }
    }

    function renderMyScore(data) {
        const score = data.voteScore ?? 0;
        const totalVotes = data.totalVotes ?? 0;
        const correctVotes = data.correctVotes ?? 0;
        const accuracy = data.accuracy ?? 0;

        totalScoreEl.textContent = formatNumber(score);
        totalVotesEl.textContent = formatNumber(totalVotes);
        correctVotesEl.textContent = formatNumber(correctVotes);

        // Use provided accuracy or calculate if missing (though API provides it)
        accuracyEl.textContent = `${Number(accuracy).toFixed(1)}%`;
    }

    function renderRankingList(rankings) {
        const list = document.getElementById("ranking-list");
        if (!list) return;

        list.innerHTML = "";

        const items = Array.isArray(rankings) ? rankings : [];

        if (items.length === 0) {
            const row = document.createElement("tr");
            row.innerHTML = `<td colspan="4" style="text-align: center;">랭킹 정보가 없습니다.</td>`;
            list.appendChild(row);
            return;
        }

        items.forEach((user) => {
            const row = document.createElement("tr");
            const rank = user.rank ?? "-";
            const nickname = user.nickname ?? "익명";
            const score = user.voteScore ?? 0;
            const accuracy = user.accuracy ?? 0;

            row.innerHTML = `
                <th scope="row">${rank}</th>
                <td>${nickname}</td>
                <td>${formatNumber(score)}</td>
                <td>${Number(accuracy).toFixed(1)}%</td>
            `;
            list.appendChild(row);
        });
    }

    function showError(message) {
        loading.setAttribute("hidden", "true");
        scoreContainer.setAttribute("hidden", "true");
        errorContainer.removeAttribute("hidden");
        errorText.textContent = message;
    }

    function formatNumber(value) {
        return new Intl.NumberFormat("ko-KR").format(value ?? 0);
    }
});

function fetchWithTimeout(resource, options = {}) {
    const { timeout = TIMEOUT_MS, ...config } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const finalConfig = { ...config, signal: controller.signal };
    return fetch(resource, finalConfig).finally(() => clearTimeout(id));
}
