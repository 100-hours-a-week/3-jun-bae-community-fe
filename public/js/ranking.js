import { API_BASE, TIMEOUT_MS } from "./core/defaults.js";
import { getSessionUser } from "./core/session.js";

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
        const user = getSessionUser();
        if (!user) {
            showError("로그인이 필요합니다.");
            return;
        }

        try {
            const [myScoreResponse, rankingResponse] = await Promise.all([
                fetchWithTimeout(`${API_BASE}/users/me/vote-score`, {
                    method: "GET",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    timeout: TIMEOUT_MS
                }),
                fetchWithTimeout(`${API_BASE}/rankings?limit=20`, {
                    method: "GET",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    timeout: TIMEOUT_MS
                })
            ]);

            if (!myScoreResponse.ok) {
                console.warn("내 점수 정보를 불러오지 못했습니다.");
            } else {
                const myData = await myScoreResponse.json();
                renderMyScore(myData);
            }

            if (!rankingResponse.ok) {
                throw new Error("랭킹 정보를 불러오지 못했습니다.");
            }

            const rankingData = await rankingResponse.json();
            renderRankingList(rankingData);

            scoreContainer.removeAttribute("hidden");

        } catch (error) {
            console.error(error);
            showError(error.message);
        } finally {
            loading.setAttribute("hidden", "true");
        }
    }

    function renderMyScore(data) {
        // Assuming data structure based on typical requirements
        const score = data.score ?? 0;
        const totalVotes = data.totalVotes ?? 0;
        const correctVotes = data.correctVotes ?? 0;

        totalScoreEl.textContent = formatNumber(score);
        totalVotesEl.textContent = formatNumber(totalVotes);
        correctVotesEl.textContent = formatNumber(correctVotes);

        const accuracy = totalVotes > 0 ? (correctVotes / totalVotes) * 100 : 0;
        accuracyEl.textContent = `${accuracy.toFixed(1)}%`;
    }

    function renderRankingList(data) {
        const list = document.getElementById("ranking-list");
        if (!list) return;

        list.innerHTML = "";

        // Assuming data is an array of user objects
        const rankings = Array.isArray(data) ? data : (data.items || []);

        if (rankings.length === 0) {
            const row = document.createElement("tr");
            row.innerHTML = `<td colspan="4" style="text-align: center;">랭킹 정보가 없습니다.</td>`;
            list.appendChild(row);
            return;
        }

        rankings.forEach((user, index) => {
            const row = document.createElement("tr");
            const score = user.score ?? 0;
            const totalVotes = user.totalVotes ?? 0;
            const correctVotes = user.correctVotes ?? 0;
            const accuracy = totalVotes > 0 ? (correctVotes / totalVotes) * 100 : 0;

            row.innerHTML = `
                <th scope="row">${index + 1}</th>
                <td>${user.nickname ?? "익명"}</td>
                <td>${formatNumber(score)}</td>
                <td>${accuracy.toFixed(1)}%</td>
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
