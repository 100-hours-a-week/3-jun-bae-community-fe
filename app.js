require("dotenv").config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

app.set('port', process.env.PORT || 3000);

app.get('/', (req, res) => {
    res.redirect('/index.html');
});

const DEFAULT_CONFIG = Object.freeze({
    APP_NAME: 'MyCommunity',
    API_BASE: 'https://api.community.junbeom.site/api',
    TIMEOUT_MS: 10_000,
});

app.get('/js/core/defaults.js', (req, res) => {
    const timeout = Number.parseInt(process.env.TIMEOUT_MS ?? '', 10);
    const config = {
        APP_NAME: process.env.APP_NAME || DEFAULT_CONFIG.APP_NAME,
        API_BASE: process.env.API_BASE || DEFAULT_CONFIG.API_BASE,
        TIMEOUT_MS: Number.isFinite(timeout) ? timeout : DEFAULT_CONFIG.TIMEOUT_MS,
    };

    const script = `const defaults = Object.freeze(${JSON.stringify(config, null, 4)});

export const { APP_NAME, API_BASE, TIMEOUT_MS } = defaults;
`;

    res.type('application/javascript').send(script);
});

app.use(express.static('public'));
app.use(express.static('assets'));

// 백엔드 프록시 도메인 달라서 필요한 경우 사용 (스프링 부트: http://localhost:8080)
app.use('/pages', createProxyMiddleware({
    target: process.env.BACKEND_HOST,
    changeOrigin: true,
    pathRewrite: { '^': '/pages' },
    proxyTimeout: 30_000,
    onError(err, req, res) {
        console.error('Proxy error:', err?.message);
        if (!res.headersSent) {
            res.status(502).json({ message: 'Upstream unavailable' });
        }
    },
}));

if (require.main === module) {
    app.listen(app.get('port'), () => {
        console.log(app.get('port'), '번 포트에서 대기 중');
    });
}

module.exports = app;